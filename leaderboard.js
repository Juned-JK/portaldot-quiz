/* ============================================================
   PORTALDOT QUIZ — LEADERBOARD
   ============================================================ */
'use strict';

const QUIZ_ID = new URLSearchParams(window.location.search).get('id');

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

/* ---- Helpers ---- */
function fmtTime(secs) {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function rankMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  let allQuizzes = [];
  try {
    allQuizzes = await DB.getQuizzes();
  } catch (e) {
    console.warn('[Leaderboard] getQuizzes failed:', e.message);
  }

  const ended = allQuizzes.filter(q => effectiveStatus(q) === 'ended');
  renderPastQuizzes(ended);

  if (QUIZ_ID) {
    const quiz = allQuizzes.find(q => q.id === QUIZ_ID);
    if (quiz) {
      const lbSpecific = document.getElementById('lbSpecific');
      if (lbSpecific) lbSpecific.style.display = 'block';

      const titleEl = document.getElementById('lbQuizTitle');
      const metaEl  = document.getElementById('lbQuizMeta');
      if (titleEl) titleEl.textContent = quiz.title;
      if (metaEl) {
        const endedDate = quiz.endTime || quiz.startTime;
        metaEl.textContent = `${quiz.questions?.length || 0} questions · Ended ${fmtDateTime(endedDate)}`;
      }

      await renderLeaderboard(QUIZ_ID);
    } else {
      // Quiz not found — hide leaderboard section
      const loadingEl = document.getElementById('lbLoading');
      if (loadingEl) loadingEl.style.display = 'none';
      const emptyEl = document.getElementById('lbEmpty');
      if (emptyEl) emptyEl.classList.remove('hidden');
    }
  }
}

/* ============================================================
   RENDER SPECIFIC LEADERBOARD
   ============================================================ */
async function renderLeaderboard(quizId) {
  const loadingEl  = document.getElementById('lbLoading');
  const tableWrap  = document.getElementById('lbTableWrap');
  const tableBody  = document.getElementById('lbTableBody');
  const emptyEl    = document.getElementById('lbEmpty');

  let participants = [];
  try {
    participants = await DB.getLeaderboard(quizId);
  } catch (e) {
    console.warn('[Leaderboard] getLeaderboard failed:', e.message);
  }

  if (loadingEl) loadingEl.style.display = 'none';

  if (participants.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  // Get current user's submitted username from localStorage
  let myUsername = null;
  try {
    const myDone = JSON.parse(localStorage.getItem(`pdq_done_${quizId}`) || 'null');
    myUsername = myDone?.username || null;
  } catch { /* ignore */ }

  if (tableWrap) tableWrap.classList.remove('hidden');
  if (tableBody) {
    tableBody.innerHTML = participants.map((p, i) => {
      const rank  = i + 1;
      const isMe  = myUsername && p.username.toLowerCase() === myUsername.toLowerCase();
      const pct   = p.total > 0 ? Math.round((p.score / p.total) * 100) : 0;
      return `
        <tr class="${isMe ? 'lb-me' : ''}${rank <= 3 ? ' lb-top' : ''}">
          <td class="lb-rank">${rankMedal(rank)}</td>
          <td class="lb-name">
            ${escHtml(p.username)}
            ${isMe ? '<span class="lb-you-badge">You</span>' : ''}
          </td>
          <td class="lb-score">
            <span class="lb-score-num">${p.score}</span>
            <span class="lb-score-den">/ ${p.total}</span>
            <span class="lb-pct">${pct}%</span>
          </td>
          <td class="lb-time">${fmtTime(p.timeTaken)}</td>
        </tr>`;
    }).join('');
  }
}

/* ============================================================
   RENDER PAST QUIZZES GRID
   ============================================================ */
function renderPastQuizzes(ended) {
  const el = document.getElementById('pastQuizzesGrid');
  if (!el) return;

  if (ended.length === 0) {
    el.innerHTML = '<div class="empty-state" style="text-align:center;color:var(--text-muted);padding:40px">No completed quizzes yet.</div>';
    return;
  }

  el.innerHTML = ended.map(q => {
    const isActive = QUIZ_ID === q.id;
    return `
    <a href="leaderboard.html?id=${q.id}" class="pq-card ${isActive ? 'pq-active' : ''}">
      <div class="pq-header">
        <span class="status-badge status-ended">Ended</span>
        <span class="pq-count">${q.questions?.length || 0} questions</span>
      </div>
      <div class="pq-title">${escHtml(q.title)}</div>
      <div class="pq-date">${fmtDateTime(q.endTime || q.startTime)}</div>
      <div class="pq-cta">View Leaderboard →</div>
    </a>`;
  }).join('');
}

/* ============================================================
   BOOT
   ============================================================ */
init();
