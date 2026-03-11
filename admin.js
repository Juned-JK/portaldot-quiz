/* ============================================================
   PORTALDOT QUIZ — ADMIN DASHBOARD
   ============================================================ */
'use strict';

/* ---- Auth guard ---- */
if (!sessionStorage.getItem('pdq_admin_auth')) {
  window.location.replace('admin-login.html');
}

/* ---- State ---- */
let managingQuizId = null;

/* ---- Utilities ---- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function effectiveStatus(quiz) {
  if (quiz.status === 'draft') return 'draft';
  if (!quiz.startTime) return 'draft';
  const now   = Date.now();
  const start = new Date(quiz.startTime).getTime();
  const end   = quiz.endTime ? new Date(quiz.endTime).getTime() : null;
  if (now < start) return 'scheduled';
  if (!end || now <= end) return 'live';
  return 'ended';
}

function toDatetimeLocal(isoStr) {
  if (!isoStr) return '';
  const d   = new Date(isoStr);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateTime(isoStr) {
  if (!isoStr) return 'Not set';
  try {
    return new Date(isoStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return isoStr; }
}

function fmtDateTimeParts(isoStr) {
  if (!isoStr) return { month: '---', day: '--', time: '--:--' };
  try {
    const d = new Date(isoStr);
    return {
      month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day:   d.getDate(),
      time:  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  } catch { return { month: '---', day: '--', time: '--:--' }; }
}

/* ---- DOM refs ---- */
const adminUsername  = document.getElementById('adminUsername');
const logoutBtn      = document.getElementById('logoutBtn');
const sidebarToggle  = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebar        = document.getElementById('adminSidebar');
const navItems       = document.querySelectorAll('.sb-nav-item[data-view]');
const toastEl        = document.getElementById('toast');

const panels = {
  overview:     document.getElementById('panelOverview'),
  quizzes:      document.getElementById('panelQuizzes'),
  quizForm:     document.getElementById('panelQuizForm'),
  questions:    document.getElementById('panelQuestions'),
  questionForm: document.getElementById('panelQuestionForm'),
  participants: document.getElementById('panelParticipants'),
  schedule:     document.getElementById('panelSchedule'),
};

/* ---- Panel switch ---- */
function showPanel(name) {
  Object.values(panels).forEach(p => p.classList.add('hidden'));
  panels[name]?.classList.remove('hidden');

  const map = { overview: 'overview', quizzes: 'quizzes', 'new-quiz': 'quizForm', schedule: 'schedule' };
  navItems.forEach(b => b.classList.toggle('active', map[b.dataset.view] === name));
}

/* ---- Toast ---- */
let _toastTimer;
function showToast(msg, ms = 2600) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ---- Form error ---- */
function showFormError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; setTimeout(() => el.textContent = '', 4000); }
}

/* ---- Loading state ---- */
function setLoading(id, msg = 'Loading…') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><span>${msg}</span></div>`;
}

/* ---- DB status badge ---- */
function updateDbBadge() {
  const badge = document.getElementById('dbStatusBadge');
  if (!badge) return;
  if (DB.isCloud) {
    badge.textContent = '☁️ Supabase';
    badge.className   = 'db-badge db-cloud';
    badge.title       = 'Connected to Supabase (PostgreSQL)';
  } else {
    badge.textContent = '💾 Local only';
    badge.className   = 'db-badge db-local';
    badge.title       = 'Supabase not configured — fill in supabase-config.js';
  }
}

/* ============================================================
   OVERVIEW
   ============================================================ */
async function renderOverview() {
  showPanel('overview');
  setLoading('recentQuizzesList');

  const quizzes = await DB.getQuizzes();
  const totalQ  = quizzes.reduce((s, q) => s + (q.questions?.length || 0), 0);

  document.getElementById('statTotalQuizzes').textContent   = quizzes.length;
  document.getElementById('statTotalQuestions').textContent = totalQ;
  document.getElementById('statScheduled').textContent      = quizzes.filter(q => effectiveStatus(q) === 'scheduled').length;
  document.getElementById('statLive').textContent           = quizzes.filter(q => effectiveStatus(q) === 'live').length;

  // Load total participant count across all non-draft quizzes
  const partEl = document.getElementById('statTotalParticipants');
  const nonDraft = quizzes.filter(q => effectiveStatus(q) !== 'draft');
  if (nonDraft.length === 0) {
    partEl.textContent = '0';
  } else {
    Promise.all(nonDraft.map(q => DB.getLeaderboard(q.id).catch(() => [])))
      .then(results => {
        const total = results.reduce((s, list) => s + list.length, 0);
        partEl.textContent = total;
      });
  }

  const el = document.getElementById('recentQuizzesList');

  if (quizzes.length === 0) {
    el.innerHTML = `<div class="empty-state">No quizzes yet. <button class="btn-link" onclick="initQuizForm()" style="margin-left:6px">Create your first quiz →</button></div>`;
    return;
  }

  el.innerHTML = quizzes.slice(0, 6).map(q => {
    const status = effectiveStatus(q);
    return `
    <div class="aq-row">
      <div class="aq-info">
        <div class="aq-title">${escHtml(q.title)}</div>
        <div class="aq-meta">${q.questions?.length || 0} questions &middot; ${fmtDateTime(q.startTime)}</div>
      </div>
      <div class="aq-actions">
        <span class="status-badge status-${status}">${status}</span>
        <button class="btn-icon" title="Edit Quiz"        onclick="initQuizForm('${q.id}')">✏️</button>
        <button class="btn-icon" title="Manage Questions" onclick="initQuestions('${q.id}')">📝</button>
        <button class="btn-icon" title="View Participants" onclick="initParticipants('${q.id}')">👥</button>
      </div>
    </div>
  `}).join('');
}

/* ============================================================
   QUIZZES LIST
   ============================================================ */
async function renderQuizzesList() {
  showPanel('quizzes');
  setLoading('quizzesListContainer');

  const quizzes = await DB.getQuizzes();
  const el      = document.getElementById('quizzesListContainer');

  if (quizzes.length === 0) {
    el.innerHTML = `<div class="empty-state">No quizzes yet. Click <strong>+ New Quiz</strong> to get started.</div>`;
    return;
  }

  el.innerHTML = quizzes.map(q => {
    const status = effectiveStatus(q);
    const hasParticipants = status === 'live' || status === 'ended';
    return `
    <div class="quiz-row" id="qrow-${q.id}">
      <div class="qr-left">
        <div class="qr-title">${escHtml(q.title)}</div>
        <div class="qr-desc">${escHtml(q.description || 'No description')}</div>
        <div class="qr-meta">
          <span class="status-badge status-${status}">${status}</span>
          <span class="qr-tag">📝 ${q.questions?.length || 0} questions</span>
          ${hasParticipants ? `<span class="qr-tag" id="ptag-${q.id}">👥 …</span>` : ''}
          ${q.startTime ? `<span class="qr-tag">🕐 Start: ${fmtDateTime(q.startTime)}</span>` : ''}
          ${q.endTime   ? `<span class="qr-tag">🕐 End: ${fmtDateTime(q.endTime)}</span>` : ''}
          ${q.reward    ? `<span class="qr-tag qr-tag-reward">🎁 ${escHtml(q.reward)}</span>` : ''}
          ${(q.tags || []).map(t => `<span class="qr-tag tag-pill">${escHtml(t)}</span>`).join('')}
        </div>
      </div>
      <div class="qr-actions">
        <button class="btn btn-ghost btn-sm" onclick="initQuestions('${q.id}')">Questions</button>
        <button class="btn btn-ghost btn-sm" onclick="initParticipants('${q.id}')">Participants</button>
        <button class="btn btn-ghost btn-sm" onclick="initQuizForm('${q.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteQuiz('${q.id}')">Delete</button>
      </div>
    </div>
  `}).join('');

  // Async load participant counts for live/ended quizzes
  quizzes.forEach(q => {
    const status = effectiveStatus(q);
    if (status !== 'live' && status !== 'ended') return;
    const tag = document.getElementById(`ptag-${q.id}`);
    if (!tag) return;
    DB.getLeaderboard(q.id)
      .then(list => { tag.textContent = `👥 ${list.length}`; })
      .catch(() => { tag.textContent = '👥 ?'; });
  });
}

/* ============================================================
   QUIZ FORM — create / edit
   ============================================================ */
async function initQuizForm(quizId = null) {
  let quiz = null;
  if (quizId) {
    const quizzes = await DB.getQuizzes();
    quiz = quizzes.find(q => q.id === quizId) || null;
  }

  document.getElementById('quizFormTitle').textContent      = quiz ? 'Edit Quiz' : 'New Quiz';
  document.getElementById('qfId').value                     = quiz?.id          || '';
  document.getElementById('qfTitle').value                  = quiz?.title       || '';
  document.getElementById('qfDescription').value            = quiz?.description || '';
  document.getElementById('qfTags').value                   = (quiz?.tags || []).join(', ');
  document.getElementById('qfReward').value                 = quiz?.reward      || '';
  document.getElementById('qfStartTime').value              = toDatetimeLocal(quiz?.startTime);
  document.getElementById('qfEndTime').value                = toDatetimeLocal(quiz?.endTime);
  document.getElementById('qfDraft').checked                = quiz ? quiz.status === 'draft' : false;
  document.getElementById('quizFormError').textContent      = '';

  showPanel('quizForm');
}

document.getElementById('quizForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const title = document.getElementById('qfTitle').value.trim();
  if (!title) { showFormError('quizFormError', 'Quiz title is required.'); return; }

  const startTimeRaw = document.getElementById('qfStartTime').value;
  const isDraft      = document.getElementById('qfDraft').checked;

  if (!isDraft && !startTimeRaw) {
    showFormError('quizFormError', 'Start date & time is required unless keeping as draft.');
    return;
  }

  const btn = this.querySelector('[type="submit"]');
  btn.textContent = 'Saving…';
  btn.disabled    = true;

  try {
    const existingId = document.getElementById('qfId').value;
    const id         = existingId || uid();
    const tags       = document.getElementById('qfTags').value
                         .split(',').map(t => t.trim()).filter(Boolean);
    const endTimeRaw = document.getElementById('qfEndTime').value;

    // Preserve existing questions when editing
    let questions = [];
    if (existingId) {
      const quizzes = await DB.getQuizzes();
      questions = quizzes.find(q => q.id === existingId)?.questions || [];
    }

    await DB.saveQuiz({
      id,
      title,
      description: document.getElementById('qfDescription').value.trim(),
      tags,
      reward:      document.getElementById('qfReward').value.trim(),
      startTime:   startTimeRaw ? new Date(startTimeRaw).toISOString() : null,
      endTime:     endTimeRaw   ? new Date(endTimeRaw).toISOString()   : null,
      status:      isDraft ? 'draft' : 'scheduled',
      questions,
    });

    showToast(existingId ? '✅ Quiz updated!' : '✅ Quiz created!');
    renderQuizzesList();
  } catch (err) {
    const msg = err?.message || String(err) || 'Unknown error';
    showFormError('quizFormError', `Save failed: ${msg}`);
    console.error('[Admin] saveQuiz error:', err);
  } finally {
    btn.textContent = 'Save Quiz';
    btn.disabled    = false;
  }
});

async function deleteQuiz(id) {
  const quizzes = await DB.getQuizzes();
  const quiz    = quizzes.find(q => q.id === id);
  if (!quiz) return;
  if (!confirm(`Delete "${quiz.title}" and all its questions?\nThis cannot be undone.`)) return;

  try {
    await DB.deleteQuiz(id);
    showToast('🗑️ Quiz deleted.');
    renderQuizzesList();
  } catch {
    showToast('❌ Delete failed. Check your connection.');
  }
}

/* ============================================================
   QUESTIONS LIST
   ============================================================ */
function initQuestions(quizId) {
  managingQuizId = quizId;
  renderQuestions();
}

async function renderQuestions() {
  showPanel('questions');
  setLoading('questionsListContainer');

  const quizzes = await DB.getQuizzes();
  const quiz    = quizzes.find(q => q.id === managingQuizId);
  if (!quiz) { renderQuizzesList(); return; }

  document.getElementById('questionsQuizTitle').textContent = quiz.title;
  const qs = quiz.questions || [];
  document.getElementById('questionsQuizCount').textContent =
    `${qs.length} question${qs.length !== 1 ? 's' : ''}`;

  const el = document.getElementById('questionsListContainer');

  if (qs.length === 0) {
    el.innerHTML = `<div class="empty-state">No questions yet. Click <strong>+ Add Question</strong> to get started.</div>`;
    return;
  }

  el.innerHTML = qs.map((q, idx) => `
    <div class="question-row">
      <div class="question-row-num">${idx + 1}</div>
      <div class="question-row-body">
        <div class="question-row-text">${escHtml(q.text)}</div>
        <div class="question-row-opts">
          ${q.options.map((opt, i) => `
            <span class="qopt ${i === q.answer ? 'qopt-correct' : ''}" title="${escHtml(opt)}">
              ${'ABCD'[i]}. ${escHtml(opt.length > 32 ? opt.slice(0, 32) + '…' : opt)}
            </span>
          `).join('')}
        </div>
        <span class="qr-tag">${escHtml(q.category || 'General')}</span>
      </div>
      <div class="qr-actions">
        <button class="btn btn-ghost btn-sm"  onclick="initQuestionForm('${managingQuizId}','${q.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteQuestion('${managingQuizId}','${q.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

/* ============================================================
   QUESTION FORM — create / edit
   ============================================================ */
async function initQuestionForm(quizId, questionId = null) {
  managingQuizId = quizId;

  const quizzes  = await DB.getQuizzes();
  const quiz     = quizzes.find(q => q.id === quizId);
  const question = questionId ? quiz?.questions?.find(q => q.id === questionId) : null;

  document.getElementById('questionFormTitle').textContent = question ? 'Edit Question' : 'Add Question';
  document.getElementById('qqId').value       = question?.id       || '';
  document.getElementById('qqQuizId').value   = quizId;
  document.getElementById('qqText').value     = question?.text     || '';
  document.getElementById('qqCategory').value = question?.category || '';
  document.getElementById('qqOptionA').value  = question?.options?.[0] || '';
  document.getElementById('qqOptionB').value  = question?.options?.[1] || '';
  document.getElementById('qqOptionC').value  = question?.options?.[2] || '';
  document.getElementById('qqOptionD').value  = question?.options?.[3] || '';
  document.getElementById('questionFormError').textContent = '';

  const ans = question?.answer ?? 0;
  document.querySelectorAll('input[name="qqAnswer"]').forEach(r => {
    r.checked = parseInt(r.value) === ans;
  });

  showPanel('questionForm');
}

document.getElementById('questionForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const text     = document.getElementById('qqText').value.trim();
  const category = document.getElementById('qqCategory').value.trim();
  const options  = [
    document.getElementById('qqOptionA').value.trim(),
    document.getElementById('qqOptionB').value.trim(),
    document.getElementById('qqOptionC').value.trim(),
    document.getElementById('qqOptionD').value.trim(),
  ];
  const answerEl = document.querySelector('input[name="qqAnswer"]:checked');
  const answer   = answerEl ? parseInt(answerEl.value) : 0;
  const quizId   = document.getElementById('qqQuizId').value;
  const id       = document.getElementById('qqId').value || uid();

  if (!text)                 { showFormError('questionFormError', 'Question text is required.'); return; }
  if (options.some(o => !o)) { showFormError('questionFormError', 'All 4 options must be filled in.'); return; }

  const btn = this.querySelector('[type="submit"]');
  btn.textContent = 'Saving…';
  btn.disabled    = true;

  try {
    const quizzes = await DB.getQuizzes();
    const quiz    = quizzes.find(q => q.id === quizId);
    if (!quiz) { showFormError('questionFormError', 'Quiz not found.'); return; }

    if (!quiz.questions) quiz.questions = [];
    const existing = quiz.questions.find(q => q.id === id);

    if (existing) {
      Object.assign(existing, { text, category, options, answer });
    } else {
      quiz.questions.push({ id, text, category, options, answer });
    }

    await DB.saveQuiz(quiz);
    showToast(existing ? '✅ Question updated!' : '✅ Question added!');
    managingQuizId = quizId;
    renderQuestions();
  } catch (err) {
    const msg = err?.message || String(err) || 'Unknown error';
    showFormError('questionFormError', `Save failed: ${msg}`);
    console.error('[Admin] saveQuestion error:', err);
  } finally {
    btn.textContent = 'Save Question';
    btn.disabled    = false;
  }
});

async function deleteQuestion(quizId, questionId) {
  if (!confirm('Delete this question?')) return;
  try {
    const quizzes = await DB.getQuizzes();
    const quiz    = quizzes.find(q => q.id === quizId);
    if (!quiz) return;
    quiz.questions = quiz.questions.filter(q => q.id !== questionId);
    await DB.saveQuiz(quiz);
    showToast('🗑️ Question deleted.');
    renderQuestions();
  } catch {
    showToast('❌ Delete failed. Check your connection.');
  }
}

/* ============================================================
   PARTICIPANTS
   ============================================================ */
let _participantsQuizId = null;

function initParticipants(quizId) {
  _participantsQuizId = quizId;
  renderParticipants();
}

async function renderParticipants() {
  showPanel('participants');

  const quizId = _participantsQuizId;
  const container = document.getElementById('participantsContainer');
  setLoading('participantsContainer', 'Loading participants…');

  try {
    const quizzes = await DB.getQuizzes();
    const quiz    = quizzes.find(q => q.id === quizId);

    if (!quiz) {
      renderQuizzesList();
      return;
    }

    document.getElementById('participantsQuizTitle').textContent = quiz.title;

    let participants = [];
    try {
      participants = await DB.getLeaderboard(quizId);
    } catch (e) {
      console.warn('[Admin] getLeaderboard failed:', e.message);
    }

    const status = effectiveStatus(quiz);
    const metaText = `${participants.length} participant${participants.length !== 1 ? 's' : ''} · Status: ${status}`;
    document.getElementById('participantsQuizMeta').textContent = metaText;

    if (participants.length === 0) {
      container.innerHTML = `<div class="empty-state">No participants yet for this quiz.</div>`;
      return;
    }

    const rows = participants.map((p, i) => {
      const rank  = i + 1;
      const pct   = p.total > 0 ? Math.round((p.score / p.total) * 100) : 0;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const mins  = Math.floor((p.timeTaken || 0) / 60);
      const secs  = (p.timeTaken || 0) % 60;
      const time  = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      return `
        <div class="participant-row ${rank <= 3 ? 'participant-top' : ''}">
          <div class="pr-rank">${medal}</div>
          <div class="pr-info">
            <div class="pr-username">${escHtml(p.username)}</div>
            <div class="pr-time">⏱ ${time}</div>
          </div>
          <div class="pr-score">
            <span class="pr-score-num">${p.score}</span>
            <span class="pr-score-den">/ ${p.total}</span>
            <span class="pr-score-pct">${pct}%</span>
          </div>
        </div>`;
    }).join('');

    const leaderboardLink = `<a href="leaderboard.html?id=${quizId}" target="_blank" class="btn btn-ghost btn-sm" style="margin-top:20px;display:inline-flex">View Public Leaderboard ↗</a>`;

    container.innerHTML = `<div class="participants-list">${rows}</div>${leaderboardLink}`;

  } catch (e) {
    container.innerHTML = `<div class="empty-state">Failed to load participants. Check your connection.</div>`;
    console.error('[Admin] renderParticipants error:', e);
  }
}

/* ============================================================
   SCHEDULE
   ============================================================ */
async function renderSchedule() {
  showPanel('schedule');
  setLoading('scheduleContainer');

  const quizzes = await DB.getQuizzes();
  const el      = document.getElementById('scheduleContainer');

  if (quizzes.length === 0) {
    el.innerHTML = `<div class="empty-state">No quizzes yet. <button class="btn-link" onclick="initQuizForm()" style="margin-left:4px">Create one →</button></div>`;
    return;
  }

  // Sort quizzes with startTime first, then drafts without time
  const withTime    = quizzes.filter(q => q.startTime).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const withoutTime = quizzes.filter(q => !q.startTime);

  let html = '';

  if (withTime.length > 0) {
    html += `<div class="schedule-section-title">Scheduled Quizzes</div>`;
    html += withTime.map(q => {
      const status = effectiveStatus(q);
      const parts  = fmtDateTimeParts(q.startTime);
      return `
      <div class="schedule-row">
        <div class="sr-date-block">
          <span class="sr-month">${parts.month}</span>
          <span class="sr-day">${parts.day}</span>
          <span class="sr-time">${parts.time}</span>
        </div>
        <div class="sr-info">
          <div class="sr-title">${escHtml(q.title)}</div>
          <div class="sr-meta">
            ${q.questions?.length || 0} questions
            <span class="status-badge status-${status}">${status}</span>
            ${q.endTime ? `<span class="qr-tag">Ends: ${fmtDateTime(q.endTime)}</span>` : ''}
            ${(q.tags || []).slice(0, 3).map(t => `<span class="qr-tag tag-pill">${escHtml(t)}</span>`).join('')}
          </div>
        </div>
        <div class="qr-actions">
          <button class="btn btn-ghost btn-sm" onclick="initQuestions('${q.id}')">Questions</button>
          <button class="btn btn-ghost btn-sm" onclick="initQuizForm('${q.id}')">Edit</button>
        </div>
      </div>
      `;
    }).join('');
  }

  if (withoutTime.length > 0) {
    html += `<div class="schedule-section-title" style="margin-top:32px">Unscheduled Drafts</div>`;
    html += withoutTime.map(q => `
      <div class="schedule-row unscheduled">
        <div class="sr-date-block">
          <span class="sr-month" style="color:var(--text-muted)">NO</span>
          <span class="sr-day"   style="color:var(--text-muted);font-size:16px">DATE</span>
        </div>
        <div class="sr-info">
          <div class="sr-title">${escHtml(q.title)}</div>
          <div class="sr-meta">
            ${q.questions?.length || 0} questions
            <span class="status-badge status-draft">draft</span>
          </div>
        </div>
        <div class="qr-actions">
          <button class="btn btn-primary btn-sm" onclick="initQuizForm('${q.id}')">Set Schedule</button>
        </div>
      </div>
    `).join('');
  }

  el.innerHTML = html;
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function openSidebar()  { sidebar.classList.add('open');    sidebarOverlay.classList.add('visible'); }
function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); }

sidebarToggle.addEventListener('click', () =>
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar()
);
sidebarOverlay.addEventListener('click', closeSidebar);

navItems.forEach(btn => {
  btn.addEventListener('click', () => {
    closeSidebar();
    const v = btn.dataset.view;
    if (v === 'overview')  renderOverview();
    if (v === 'quizzes')   renderQuizzesList();
    if (v === 'new-quiz')  initQuizForm();
    if (v === 'schedule')  renderSchedule();
  });
});

/* ============================================================
   BUTTON WIRING
   ============================================================ */
document.getElementById('cancelQuizForm').addEventListener('click',    renderQuizzesList);
document.getElementById('cancelQuizForm2').addEventListener('click',   renderQuizzesList);
document.getElementById('backToQuizzes').addEventListener('click',     renderQuizzesList);
document.getElementById('cancelQuestionForm').addEventListener('click',  renderQuestions);
document.getElementById('cancelQuestionForm2').addEventListener('click', renderQuestions);
document.getElementById('addQuestionBtn').addEventListener('click', () => {
  if (managingQuizId) initQuestionForm(managingQuizId);
});
document.getElementById('backToQuizzesFromParts').addEventListener('click', renderQuizzesList);
document.querySelector('.sb-header-row .btn-link')?.addEventListener('click', renderQuizzesList);

/* ============================================================
   LOGOUT
   ============================================================ */
logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('pdq_admin_auth');
  sessionStorage.removeItem('pdq_admin_user');
  window.location.replace('admin-login.html');
});

/* ============================================================
   INIT
   ============================================================ */
adminUsername.textContent = sessionStorage.getItem('pdq_admin_user') || 'Admin';
updateDbBadge();
renderOverview();
