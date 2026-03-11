/* ============================================================
   PORTALDOT QUIZ — QUIZ ENGINE
   ============================================================ */
'use strict';

const QUIZ_ID = new URLSearchParams(window.location.search).get('id');
let quizData        = null;
let _countdownInt   = null;
let _statusPollInt  = null;

/* ---- Quiz taking state ---- */
let qState = {
  username:   '',
  startedAt:  null,
  current:    0,
  selected:   null,
  answered:   false,
  score:      0,
  results:    [],
  timer:      null,
  timeLeft:   30,
  endWatcher: null,   // interval that force-ends the quiz when endTime passes
};

/* ---- effectiveStatus ---- */
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

/* ---- Screen switch ---- */
function showScreen(id) {
  document.querySelectorAll('.quiz-screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

/* ---- XSS-safe escape ---- */
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/* ---- Helpers ---- */
function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function fmtCountdown(ms) {
  const s   = Math.max(0, Math.floor(ms / 1000));
  const d   = Math.floor(s / 86400);
  const h   = Math.floor((s % 86400) / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return { d, h: pad(h), m: pad(m), s: pad(sec), total: s };
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  showScreen('s-loading');
  try {
    if (!QUIZ_ID) {
      await renderQuizList();
    } else {
      await checkAndRenderQuiz();
    }
  } catch (e) {
    console.error('[Quiz] init error:', e);
    showScreen('s-notfound');
  }
}

/* ============================================================
   QUIZ LIST (no ?id param)
   ============================================================ */
async function renderQuizList() {
  const quizzes = await DB.getQuizzes();
  const visible = quizzes.filter(q => effectiveStatus(q) !== 'draft');
  const el      = document.getElementById('quizListContainer');

  if (visible.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:60px 20px;font-size:15px">No quizzes available yet. Check back soon!</div>';
    showScreen('s-list');
    return;
  }

  const live      = visible.filter(q => effectiveStatus(q) === 'live');
  const scheduled = visible.filter(q => effectiveStatus(q) === 'scheduled');
  const ended     = visible.filter(q => effectiveStatus(q) === 'ended');

  el.innerHTML = [...live, ...scheduled, ...ended].map(q => renderQuizCard(q)).join('');
  showScreen('s-list');
}

function renderQuizCard(quiz) {
  const status   = effectiveStatus(quiz);
  const isLive   = status === 'live';
  const isSched  = status === 'scheduled';
  const isEnded  = status === 'ended';
  const qCount   = quiz.questions?.length || 0;
  const tags     = (quiz.tags || []).slice(0, 3).map(t => `<span class="sc-tag">${escHtml(t)}</span>`).join('');

  let badgeHtml = '';
  if (isLive)  badgeHtml = `<span class="status-badge" style="background:rgba(34,197,94,0.1);color:#4ade80;border:1px solid rgba(34,197,94,0.25);font-size:11px;padding:3px 10px;border-radius:99px;font-weight:700;">🟢 Live</span>`;
  if (isSched) badgeHtml = `<span class="status-badge" style="background:rgba(139,92,246,0.12);color:var(--purple-3);border:1px solid var(--border);font-size:11px;padding:3px 10px;border-radius:99px;font-weight:700;">📅 Upcoming</span>`;
  if (isEnded) badgeHtml = `<span class="status-badge status-ended" style="font-size:11px;padding:3px 10px;border-radius:99px;font-weight:700;">🏁 Ended</span>`;

  let ctaHtml = '';
  if (isLive) {
    ctaHtml = `
      <div class="qc-btn-group">
        <a href="quiz.html?id=${quiz.id}" class="btn btn-primary btn-sm">Join Now →</a>
        <a href="leaderboard.html?id=${quiz.id}" class="btn btn-ghost btn-sm">Leaderboard</a>
      </div>`;
  }
  if (isSched) {
    const ms  = new Date(quiz.startTime).getTime() - Date.now();
    const { d, h, m } = fmtCountdown(ms);
    const cdText = d > 0 ? `${d}d ${h}h ${m}m` : `${h}:${m}`;
    ctaHtml = `<div style="font-size:12px;color:var(--text-muted)">Starts in <strong style="color:var(--neon)">${cdText}</strong></div>
               <a href="quiz.html?id=${quiz.id}" class="btn btn-ghost btn-sm" style="margin-top:8px">View Details</a>`;
  }
  if (isEnded) {
    const msLeft = quiz.endTime
      ? Math.max(0, (6 * 3600 * 1000) - (Date.now() - new Date(quiz.endTime).getTime()))
      : 0;
    const hLeft  = Math.floor(msLeft / 3600000);
    const mLeft  = Math.floor((msLeft % 3600000) / 60000);
    const expiryNote = msLeft > 0
      ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">Removed in ${hLeft}h ${mLeft}m</div>`
      : '';
    ctaHtml = `
      <div class="qc-btn-group">
        <a href="leaderboard.html?id=${quiz.id}" class="btn btn-ghost btn-sm">View Leaderboard →</a>
      </div>
      ${expiryNote}`;
  }

  const rewardHtml = quiz.reward
    ? `<div class="qc-reward"><span class="reward-icon">🎁</span><span class="reward-text">${escHtml(quiz.reward)}</span></div>`
    : '';

  return `
    <div class="qc-card ${isLive ? 'qc-live' : ''} ${isEnded ? 'qc-ended' : ''}">
      <div class="qc-info">
        <div class="qc-title">${escHtml(quiz.title)}</div>
        <div class="qc-desc">${escHtml(quiz.description || '')}</div>
        <div class="qc-meta">
          ${badgeHtml}
          <span style="font-size:12px;color:var(--text-muted)">📝 ${qCount} questions</span>
          ${tags}
        </div>
        ${rewardHtml}
      </div>
      <div class="qc-cta">${ctaHtml}</div>
    </div>`;
}

/* ============================================================
   CHECK AND RENDER SPECIFIC QUIZ
   ============================================================ */
async function checkAndRenderQuiz() {
  const quizzes = await DB.getQuizzes();
  quizData = quizzes.find(q => q.id === QUIZ_ID);

  if (!quizData) { showScreen('s-notfound'); return; }

  const status = effectiveStatus(quizData);

  if (status === 'draft')     { showScreen('s-notfound'); return; }
  if (status === 'scheduled') { renderWaitScreen(quizData); return; }
  if (status === 'live') {
    const done = localStorage.getItem(`pdq_done_${QUIZ_ID}`);
    if (done) {
      window.location.replace(`leaderboard.html?id=${QUIZ_ID}`);
      return;
    }
    renderJoinScreen(quizData);
    return;
  }
  if (status === 'ended') { renderEndedScreen(quizData); return; }
}

/* ============================================================
   WAIT SCREEN (scheduled)
   ============================================================ */
function renderWaitScreen(quiz) {
  document.getElementById('wcTitle').textContent = quiz.title;
  document.getElementById('wcDesc').textContent  = quiz.description || '';
  document.getElementById('wcStart').textContent = fmtDateTime(quiz.startTime);
  document.getElementById('wcEnd').textContent   = quiz.endTime ? fmtDateTime(quiz.endTime) : 'Open';

  const tagsEl = document.getElementById('wcTags');
  tagsEl.innerHTML = (quiz.tags || []).map(t => `<span class="sc-tag">${escHtml(t)}</span>`).join('');

  const wcReward = document.getElementById('wcReward');
  if (quiz.reward) {
    wcReward.innerHTML = `<span class="reward-icon">🎁</span><div class="reward-body"><span class="reward-label">Prize</span><span class="reward-text">${escHtml(quiz.reward)}</span></div>`;
    wcReward.classList.remove('hidden');
  } else {
    wcReward.classList.add('hidden');
  }

  showScreen('s-wait');

  // Start countdown
  clearInterval(_countdownInt);

  function tick() {
    const ms = new Date(quiz.startTime).getTime() - Date.now();
    if (ms <= 0) {
      clearInterval(_countdownInt);
      _countdownInt = null;
      checkAndRenderQuiz();
      return;
    }
    const { d, h, m, s } = fmtCountdown(ms);
    document.getElementById('cdDays').textContent  = String(d).padStart(2, '0');
    document.getElementById('cdHours').textContent = h;
    document.getElementById('cdMins').textContent  = m;
    document.getElementById('cdSecs').textContent  = s;
  }

  tick();
  _countdownInt = setInterval(tick, 1000);
}

/* ============================================================
   JOIN SCREEN (live)
   ============================================================ */
function renderJoinScreen(quiz) {
  document.getElementById('jcTitle').textContent  = quiz.title;
  document.getElementById('jcDesc').textContent   = quiz.description || '';
  document.getElementById('jcQCount').textContent = `${quiz.questions?.length || 0} questions`;

  const jcReward = document.getElementById('jcReward');
  if (quiz.reward) {
    jcReward.innerHTML = `<span class="reward-icon">🎁</span><div class="reward-body"><span class="reward-label">Prize</span><span class="reward-text">${escHtml(quiz.reward)}</span></div>`;
    jcReward.classList.remove('hidden');
  } else {
    jcReward.classList.add('hidden');
  }

  showScreen('s-join');

  // Poll every 30s to check if quiz ended
  clearInterval(_statusPollInt);
  _statusPollInt = setInterval(async () => {
    await checkAndRenderQuiz();
  }, 30000);
}

/* ============================================================
   ENDED SCREEN
   ============================================================ */
function renderEndedScreen(quiz) {
  clearInterval(_countdownInt);
  clearInterval(_statusPollInt);
  _countdownInt  = null;
  _statusPollInt = null;
  stopEndWatcher();

  document.getElementById('ecTitle').textContent = quiz.title;
  document.getElementById('seeLeaderboardBtn').onclick = () => {
    window.location.href = `leaderboard.html?id=${QUIZ_ID}`;
  };
  showScreen('s-ended');
}

/* ============================================================
   USERNAME VALIDATION
   ============================================================ */
function validateUsername(val) {
  if (!val)             return 'Username is required.';
  if (val.length < 3)   return 'Must be at least 3 characters.';
  if (val.length > 24)  return 'Max 24 characters.';
  if (/\s/.test(val))   return 'No spaces allowed.';
  if (!/^[a-zA-Z0-9_\-.]+$/.test(val)) return 'Letters, numbers, _ - . only.';
  return null;
}

/* ============================================================
   START QUIZ BUTTON
   ============================================================ */
document.getElementById('startQuizBtn')?.addEventListener('click', async () => {
  const raw = document.getElementById('usernameInput').value.trim();
  const err = validateUsername(raw);

  const errEl = document.getElementById('usernameError');
  if (err) { errEl.textContent = err; return; }
  errEl.textContent = '';

  const btn = document.getElementById('startQuizBtn');
  btn.textContent = 'Checking…';
  btn.disabled    = true;

  try {
    const already = await DB.hasParticipated(QUIZ_ID, raw);
    if (already) {
      errEl.innerHTML = `
        <span>Each username can only participate once. <strong>${raw}</strong> already has an entry.</span>
        <a href="leaderboard.html?id=${QUIZ_ID}" style="display:inline-block;margin-top:8px;font-size:12px;color:var(--neon);text-decoration:underline;">View Leaderboard →</a>`;
      btn.textContent = 'Join Quiz →';
      btn.disabled    = false;
      return;
    }
  } catch (e) {
    console.warn('[Quiz] hasParticipated error:', e.message);
    // Proceed anyway on DB error
  }

  // Guard: quiz must have questions
  if (!quizData.questions || quizData.questions.length === 0) {
    errEl.textContent = 'This quiz has no questions yet. Check back later.';
    btn.textContent = 'Join Quiz →';
    btn.disabled    = false;
    return;
  }

  clearInterval(_statusPollInt);
  _statusPollInt = null;

  qState.username  = raw;
  qState.startedAt = Date.now();
  qState.current   = 0;
  qState.score     = 0;
  qState.results   = [];
  qState.answered  = false;
  qState.selected  = null;

  document.getElementById('displayUsername').textContent = '👤 ' + raw;
  showScreen('s-active');

  try {
    renderQuestion();
  } catch (e) {
    console.error('[Quiz] renderQuestion failed:', e);
    errEl.textContent = 'Failed to load questions. Please refresh and try again.';
    btn.textContent = 'Join Quiz →';
    btn.disabled    = false;
    showScreen('s-join');
    return;
  }

  // Watch for quiz end-time while user is actively answering
  startEndWatcher();
});

/* ---- Clear error on input ---- */
document.getElementById('usernameInput')?.addEventListener('input', () => {
  document.getElementById('usernameError').textContent = '';
});

document.getElementById('usernameInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('startQuizBtn')?.click();
});

/* ============================================================
   RENDER QUESTION
   ============================================================ */
function renderQuestion() {
  const q     = quizData.questions[qState.current];
  const total = quizData.questions.length;

  if (!q) throw new Error(`Question ${qState.current} not found in quiz data.`);
  if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`Question ${qState.current} has invalid options.`);

  // Progress
  const pct = (qState.current / total) * 100;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent  = (qState.current + 1) + ' / ' + total;

  // Meta
  document.getElementById('questionNumber').textContent   = 'Question ' + (qState.current + 1);
  document.getElementById('questionCategory').textContent = q.category || 'General';
  document.getElementById('questionText').textContent     = q.text;

  // Options
  const grid    = document.getElementById('optionsGrid');
  const letters = ['A', 'B', 'C', 'D'];
  grid.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    const letter = document.createElement('span');
    letter.className   = 'opt-letter';
    letter.textContent = letters[i];
    const text = document.createElement('span');
    text.textContent = opt;
    btn.appendChild(letter);
    btn.appendChild(text);
    btn.addEventListener('click', () => selectOption(i));
    grid.appendChild(btn);
  });

  // Reset state
  qState.selected = null;
  qState.answered = false;

  const nextBtn = document.getElementById('nextBtn');
  nextBtn.disabled    = true;
  nextBtn.textContent = (qState.current === total - 1) ? 'Finish →' : 'Next →';

  // Live score
  document.getElementById('liveScore').textContent = qState.score;

  // Timer
  startTimer(30);
}

/* ============================================================
   SELECT OPTION
   ============================================================ */
function selectOption(index) {
  if (qState.answered) return;

  qState.selected = index;
  qState.answered = true;
  stopTimer();

  const q       = quizData.questions[qState.current];
  const correct = q.answer;
  const isRight = index === correct;

  if (isRight) qState.score++;

  qState.results.push({
    question: q.text,
    selected: index,
    correct:  correct,
    skipped:  false,
  });

  // Update option styles
  const btns = document.getElementById('optionsGrid').querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct)              btn.classList.add('correct');
    else if (i === index && !isRight) btn.classList.add('wrong');
  });

  document.getElementById('liveScore').textContent   = qState.score;
  document.getElementById('nextBtn').disabled        = false;
}

/* ============================================================
   NEXT BUTTON
   ============================================================ */
document.getElementById('nextBtn')?.addEventListener('click', () => {
  // If unanswered (time ran out), record as skipped
  if (!qState.answered) {
    const q = quizData.questions[qState.current];
    qState.results.push({
      question: q.text,
      selected: null,
      correct:  q.answer,
      skipped:  true,
    });
    // Show correct answer
    const btns = document.getElementById('optionsGrid').querySelectorAll('.option-btn');
    btns.forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.answer) btn.classList.add('correct');
    });
    qState.answered = true;
  }

  qState.current++;
  if (qState.current >= quizData.questions.length) {
    finishQuiz();
  } else {
    renderQuestion();
  }
});

/* ============================================================
   FINISH QUIZ
   ============================================================ */
async function finishQuiz() {
  stopTimer();
  stopEndWatcher();
  clearInterval(_statusPollInt);
  _statusPollInt = null;

  const total     = quizData.questions.length;
  const correct   = qState.results.filter(r => !r.skipped && r.selected === r.correct).length;
  const skipped   = qState.results.filter(r => r.skipped).length;
  const wrong     = total - correct - skipped;
  const timeTaken = Math.round((Date.now() - qState.startedAt) / 1000);

  // Save to localStorage immediately
  localStorage.setItem(`pdq_done_${QUIZ_ID}`, JSON.stringify({
    username: qState.username, score: correct, total, timeTaken
  }));

  // Save to DB
  try {
    await DB.saveParticipant({
      quizId:   QUIZ_ID,
      username: qState.username,
      score:    correct,
      total,
      timeTaken,
    });
  } catch (e) {
    console.warn('[Quiz] Save participant failed:', e.message);
  }

  // Populate result screen
  document.getElementById('resultsUsername').textContent = qState.username;
  document.getElementById('scoreDisplay').textContent   = correct;
  document.getElementById('scoreDenom').textContent     = '/ ' + total;
  document.getElementById('correctCount').textContent   = correct;
  document.getElementById('wrongCount').textContent     = wrong;
  document.getElementById('skippedCount').textContent   = skipped;

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  let icon, label;
  if (pct === 100)   { icon = '🏆'; label = 'Perfect Score! Legendary!'; }
  else if (pct >= 80){ icon = '🌟'; label = 'Excellent! Well done!'; }
  else if (pct >= 60){ icon = '✅'; label = 'Good job! Keep learning!'; }
  else if (pct >= 40){ icon = '📚'; label = 'Not bad — room to grow!'; }
  else               { icon = '💪'; label = "Keep studying — you've got this!"; }

  document.getElementById('resultsIcon').textContent = icon;
  document.getElementById('scoreLabel').textContent  = label;

  const resultsReward = document.getElementById('resultsReward');
  if (quizData.reward) {
    resultsReward.innerHTML = `<span class="reward-icon">🎁</span><div class="reward-body"><span class="reward-label">Quiz Reward</span><span class="reward-text">${escHtml(quizData.reward)}</span></div>`;
    resultsReward.classList.remove('hidden');
  } else {
    resultsReward.classList.add('hidden');
  }

  // Progress fill to 100%
  document.getElementById('progressFill').style.width = '100%';
  document.getElementById('progressText').textContent = total + ' / ' + total;

  // Ring animation
  const circ = 2 * Math.PI * 52; // ~327
  setTimeout(() => {
    const rf = document.getElementById('ringFill');
    rf.style.strokeDashoffset = circ * (1 - (total > 0 ? correct / total : 0));

    const svg = rf.closest('svg');
    if (!svg.querySelector('defs')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `<linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#7c3aed"/>
        <stop offset="50%"  stop-color="#4f46e5"/>
        <stop offset="100%" stop-color="#3b82f6"/>
      </linearGradient>`;
      svg.insertBefore(defs, svg.firstChild);
      rf.setAttribute('stroke', 'url(#scoreGradient)');
    }
  }, 100);

  document.getElementById('viewLeaderboardBtn').onclick = () => {
    window.location.href = `leaderboard.html?id=${QUIZ_ID}`;
  };

  showScreen('s-result');
}

/* ============================================================
   END-TIME WATCHER (force-finish if quiz closes mid-session)
   ============================================================ */
function startEndWatcher() {
  stopEndWatcher();
  if (!quizData?.endTime) return; // no end time set — quiz stays open

  qState.endWatcher = setInterval(() => {
    const now = Date.now();
    const end = new Date(quizData.endTime).getTime();
    if (now >= end) {
      stopEndWatcher();
      stopTimer();
      // If currently on active screen, force-finish
      const activeScreen = document.getElementById('s-active');
      if (activeScreen && !activeScreen.classList.contains('hidden')) {
        // Record current question as skipped if unanswered
        if (!qState.answered && quizData.questions[qState.current]) {
          const q = quizData.questions[qState.current];
          qState.results.push({
            question: q.text,
            selected: null,
            correct:  q.answer,
            skipped:  true,
          });
        }
        finishQuiz();
      }
    }
  }, 5000); // check every 5 seconds
}

function stopEndWatcher() {
  if (qState.endWatcher) {
    clearInterval(qState.endWatcher);
    qState.endWatcher = null;
  }
}

/* ============================================================
   TIMER
   ============================================================ */
function startTimer(seconds) {
  stopTimer();
  qState.timeLeft  = seconds;
  qState.totalTime = seconds;
  updateTimerDisplay();

  qState.timer = setInterval(() => {
    qState.timeLeft--;
    updateTimerDisplay();
    if (qState.timeLeft <= 0) {
      stopTimer();
      autoNext();
    }
  }, 1000);
}

function stopTimer() {
  if (qState.timer) {
    clearInterval(qState.timer);
    qState.timer = null;
  }
}

function updateTimerDisplay() {
  const numEl  = document.getElementById('timerNum');
  const ringEl = document.getElementById('timerRingFill');
  if (!numEl) return;

  const t     = qState.timeLeft;
  const total = qState.totalTime || 30;
  const C     = 2 * Math.PI * 18;                       // circumference ≈ 113.1
  const offset = C * (1 - Math.max(0, t / total));      // 0 = full, C = empty

  numEl.textContent = t;
  if (ringEl) ringEl.style.strokeDashoffset = offset;

  const danger = t <= 5;
  numEl.classList.toggle('danger', danger);
  if (ringEl) ringEl.classList.toggle('danger', danger);
}

function autoNext() {
  if (!qState.answered) {
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.click();
    }
  }
}

/* ============================================================
   BOOT
   ============================================================ */
init();
