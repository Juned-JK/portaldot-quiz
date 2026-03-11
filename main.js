/* ============================================================
   PORTALDOT QUIZ — MAIN / SHARED JS
   ============================================================ */

/* ══════════════════════════════════════════════
   CURSOR GLOW (follows mouse with lag, no dot)
   ══════════════════════════════════════════════ */
(function initCursorGlow() {
  if (window.matchMedia('(hover: none)').matches) return;

  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.appendChild(glow);

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let gx = mx, gy = my;

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

  (function animateGlow() {
    gx += (mx - gx) * 0.07;
    gy += (my - gy) * 0.07;
    glow.style.transform = `translate(${gx - 250}px, ${gy - 250}px)`;
    requestAnimationFrame(animateGlow);
  })();

  document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { glow.style.opacity = '1'; });
})();

/* ══════════════════════════════════════════════
   BUTTON RIPPLE
   ══════════════════════════════════════════════ */
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;

  const rect   = btn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height) * 2.2;
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  ripple.style.cssText = `
    width:${size}px; height:${size}px;
    top:${e.clientY - rect.top  - size / 2}px;
    left:${e.clientX - rect.left - size / 2}px;
  `;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
});

/* ══════════════════════════════════════════════
   TEXT SCRAMBLE — hero gradient text
   ══════════════════════════════════════════════ */
(function initScramble() {
  const el = document.querySelector('.home-hero-inner .gradient-text');
  if (!el) return;

  const CHARS   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*!?';
  const FINAL   = el.textContent;
  const DURATION = 1100;
  const start   = performance.now();

  el.style.minWidth = el.offsetWidth + 'px'; // prevent layout shift

  function frame(now) {
    const t        = Math.min((now - start) / DURATION, 1);
    const resolved = Math.floor(t * FINAL.length);
    let   text     = FINAL.slice(0, resolved);
    for (let i = resolved; i < FINAL.length; i++) {
      text += FINAL[i] === ' ' ? ' ' : CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    el.textContent = text;
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = FINAL;
  }

  // Start after the hero entrance animation delay
  setTimeout(() => requestAnimationFrame(frame), 320);
})();

/* ══════════════════════════════════════════════
   NAV LINK STAGGER ENTRANCE
   ══════════════════════════════════════════════ */
document.querySelectorAll('.nav-link').forEach((link, i) => {
  link.style.animation = `navLinkIn 0.5s cubic-bezier(0.16,1,0.3,1) ${0.08 + i * 0.06}s both`;
});

/* ══════════════════════════════════════════════
   STAT COUNTER — about page
   ══════════════════════════════════════════════ */
(function initStatCounters() {
  const els = document.querySelectorAll('.ab-stat-num');
  if (!els.length) return;

  const NUMERIC = /^(\d+\.?\d*)(.*)$/;
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      counterObs.unobserve(el);

      const match = NUMERIC.exec(el.textContent.trim());
      if (!match) {
        // Non-numeric (Free, No, Live) — just pop-in
        el.classList.add('counting');
        return;
      }

      const target = parseFloat(match[1]);
      const suffix = match[2];
      const dur    = 1400;
      const t0     = performance.now();
      el.classList.add('counting');

      function tick(now) {
        const p = Math.min((now - t0) / dur, 1);
        const v = 1 - Math.pow(1 - p, 3); // ease-out cubic
        el.textContent = (target % 1 === 0 ? Math.round(v * target) : (v * target).toFixed(1)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = match[1] + suffix;
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });

  els.forEach(el => counterObs.observe(el));
})();

/* ---------- Hamburger Menu ---------- */
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('open');
    }
  });

  // Close on link click
  mobileMenu.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('open');
    });
  });
}

/* ---------- Navbar scroll style ---------- */
const navbar = document.querySelector('.navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar.style.boxShadow = '0 4px 32px rgba(0,0,0,0.4)';
    } else {
      navbar.style.boxShadow = 'none';
    }
  }, { passive: true });
}

/* ---------- Scroll reveal (extended) ---------- */
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -32px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Staggered grid reveals
function registerStaggeredGroup(selector, baseDelay = 0, step = 80) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.classList.add('reveal-item');
    el.style.transitionDelay = (baseDelay + i * step) + 'ms';
    observer.observe(el);
  });
}

registerStaggeredGroup('.feature-card',    0,  90);
registerStaggeredGroup('.resource-card',   0,  90);
registerStaggeredGroup('.ab-topic',        0,  60);
registerStaggeredGroup('.ab-step',         0, 120);
registerStaggeredGroup('.ab-stat-card',    0,   0);
registerStaggeredGroup('.ab-mission-card', 0,   0);
registerStaggeredGroup('.ab-logo-card',    0,   0);
registerStaggeredGroup('.ab-cta-card',     0,   0);

/* ---------- Floating Particle Canvas ---------- */
(function initParticles() {
  const hero = document.querySelector('.home-hero, .ab-hero, .lb-section');
  if (!hero) return;

  const wrap = document.createElement('div');
  wrap.className = 'hero-particles';
  hero.prepend(wrap);

  const canvas = document.createElement('canvas');
  canvas.style.filter = 'blur(2px)';
  wrap.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const COLORS = ['rgba(124,58,237,', 'rgba(99,102,241,', 'rgba(59,130,246,', 'rgba(129,140,248,'];
  const COUNT  = 25;

  let W, H, dots;

  function resize() {
    W = canvas.width  = wrap.offsetWidth  || window.innerWidth;
    H = canvas.height = wrap.offsetHeight || window.innerHeight;
  }

  function makeDot() {
    const r = Math.random() * 1.6 + 0.4;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      r,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.22,
      alpha: Math.random() * 0.5 + 0.15,
      targetAlpha: Math.random() * 0.5 + 0.15,
      alphaSpeed: (Math.random() * 0.008 + 0.003) * (Math.random() > 0.5 ? 1 : -1),
      color
    };
  }

  function init() {
    resize();
    dots = Array.from({ length: COUNT }, makeDot);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    dots.forEach(d => {
      d.x += d.vx;
      d.y += d.vy;
      d.alpha += d.alphaSpeed;
      if (d.alpha <= 0.05 || d.alpha >= 0.65) d.alphaSpeed *= -1;
      if (d.x < -10) d.x = W + 10;
      if (d.x > W + 10) d.x = -10;
      if (d.y < -10) d.y = H + 10;
      if (d.y > H + 10) d.y = -10;

      ctx.beginPath();
      ctx.fillStyle = d.color + d.alpha + ')';
      ctx.arc(d.x, d.y, d.r * 4, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  init();
  draw();
  window.addEventListener('resize', () => { resize(); dots.forEach(d => { if (d.x > W) d.x = Math.random() * W; if (d.y > H) d.y = Math.random() * H; }); }, { passive: true });
})();

/* ---------- Magnetic Card Tilt ---------- */
(function initMagneticTilt() {
  const STRENGTH = 8; // max tilt degrees

  function attachTilt(selector) {
    document.querySelectorAll(selector).forEach(card => {
      card.classList.add('tilt-card');

      card.addEventListener('mousemove', e => {
        const rect   = card.getBoundingClientRect();
        const cx     = rect.left + rect.width  / 2;
        const cy     = rect.top  + rect.height / 2;
        const dx     = (e.clientX - cx) / (rect.width  / 2);
        const dy     = (e.clientY - cy) / (rect.height / 2);
        const rotateX = -dy * STRENGTH;
        const rotateY =  dx * STRENGTH;
        card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  attachTilt('.schedule-card');
  attachTilt('.quiz-card');
  attachTilt('.ab-stat-card');
  attachTilt('.ab-mission-card');
  attachTilt('.ab-logo-card');
  attachTilt('.ab-cta-card');
})();

/* ---------- Countdown tick animation ---------- */
function animateCountdownTick(el) {
  if (!el) return;
  el.classList.remove('tick');
  void el.offsetWidth; // reflow
  el.classList.add('tick');
}

/* ============================================================
   DYNAMIC SCHEDULE (index.html only)
   ============================================================ */

// Per-card countdown timer handles
const _scheduleCountdownTimers = {};

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

function fmtCountdownShort(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s <= 0) return 'Starting now…';
  const d   = Math.floor(s / 86400);
  const h   = Math.floor((s % 86400) / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

async function loadDynamicSchedule() {
  const grid = document.getElementById('scheduleGrid');
  if (!grid || typeof DB === 'undefined') return;

  // Clear existing countdown timers
  Object.values(_scheduleCountdownTimers).forEach(id => clearInterval(id));
  Object.keys(_scheduleCountdownTimers).forEach(k => delete _scheduleCountdownTimers[k]);

  try {
    const quizzes   = await DB.getQuizzes();
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const live      = quizzes.filter(q => effectiveStatus(q) === 'live');
    const scheduled = quizzes
      .filter(q => effectiveStatus(q) === 'scheduled')
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    const recentEnded = quizzes
      .filter(q => {
        if (effectiveStatus(q) !== 'ended') return false;
        if (!q.endTime) return false;
        return (Date.now() - new Date(q.endTime).getTime()) <= SIX_HOURS;
      })
      .sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
    const visible   = [...live, ...scheduled, ...recentEnded].slice(0, 6);

    if (visible.length === 0) {
      grid.innerHTML = `
        <div class="schedule-card featured" style="justify-content:center;align-items:center;text-align:center;padding:60px 40px;">
          <div class="sc-info" style="padding-right:0;text-align:center;">
            <div style="font-size:40px;margin-bottom:16px;opacity:0.5">📅</div>
            <h3 class="sc-title" style="padding-right:0;font-size:18px;margin-bottom:8px;">No quizzes scheduled yet</h3>
            <p class="sc-desc" style="-webkit-line-clamp:unset;overflow:visible;">Check back soon — new quiz events are coming!</p>
          </div>
        </div>`;
      return;
    }

    grid.innerHTML = visible.map((q, i) => {
      const status  = effectiveStatus(q);
      const isLive  = status === 'live';
      const isEnded = status === 'ended';
      const isFirst = i === 0;

      const refDate = isEnded ? (q.endTime || q.startTime) : q.startTime;
      let cardDate = null;
      try { cardDate = new Date(refDate); } catch { /* ignore */ }

      const monthStr = cardDate
        ? cardDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
        : '';
      const dayStr = cardDate ? cardDate.getDate() : '';

      // Badge — all cards get one
      let badge = '';
      if (isLive) {
        badge = `<div class="sc-badge sc-badge-live"><span class="sc-live-dot"></span>Live Now</div>`;
      } else if (isEnded) {
        badge = `<div class="sc-badge sc-badge-ended">🏁 Ended</div>`;
      } else if (isFirst) {
        badge = `<div class="sc-badge sc-badge-upcoming">Next Up</div>`;
      } else {
        badge = `<div class="sc-badge sc-badge-upcoming">Upcoming</div>`;
      }

      // Actions
      let actions = '';
      if (isLive) {
        actions = `
          <div class="sc-btn-group">
            <a href="quiz.html?id=${q.id}" class="btn btn-primary btn-sm">Join Now →</a>
            <a href="leaderboard.html?id=${q.id}" class="btn btn-ghost btn-sm">Leaderboard</a>
          </div>`;
      } else if (isEnded) {
        const msLeft = q.endTime
          ? Math.max(0, (6 * 3600 * 1000) - (Date.now() - new Date(q.endTime).getTime()))
          : 0;
        const hLeft = Math.floor(msLeft / 3600000);
        const mLeft = Math.floor((msLeft % 3600000) / 60000);
        actions = `
          <div class="sc-btn-group">
            <a href="leaderboard.html?id=${q.id}" class="btn btn-ghost btn-sm">View Leaderboard →</a>
          </div>
          <div class="sc-expiry">⏳ Removed in ${hLeft}h ${mLeft}m</div>`;
      } else {
        actions = `
          <div class="sc-countdown-wrap">
            <span class="sc-countdown-label">Starts in</span>
            <span class="sc-countdown-val" id="scd-${q.id}">—</span>
          </div>
          <a href="quiz.html?id=${q.id}" class="btn btn-ghost btn-sm" style="margin-top:14px">View Details →</a>`;
      }

      // Card classes
      const cardCls = [
        'schedule-card',
        isFirst && !isEnded ? 'featured' : '',
        isLive   ? 'sc-live'  : '',
        isEnded  ? 'sc-ended' : '',
      ].filter(Boolean).join(' ');

      return `
        <div class="${cardCls}" id="sc-card-${q.id}">
          ${badge}
          <div class="sc-date">
            <span class="sc-month">${monthStr}</span>
            <span class="sc-day">${dayStr}</span>
          </div>
          <div class="sc-info">
            <h3 class="sc-title">${esc(q.title)}</h3>
            <p class="sc-desc">${esc(q.description || '')}</p>
            <div class="sc-meta">
              ${(q.tags || []).map(t => `<span class="sc-tag">${esc(t)}</span>`).join('')}
            </div>
            ${q.reward ? `<div class="sc-reward-strip"><span class="sc-reward-icon">🎁</span><span class="sc-reward-text">${esc(q.reward)}</span></div>` : ''}
            ${actions}
          </div>
        </div>`;
    }).join('');

    // Start countdown timers for scheduled quizzes
    scheduled.forEach(q => {
      const el = document.getElementById(`scd-${q.id}`);
      if (!el) return;

      function tick() {
        const ms = new Date(q.startTime).getTime() - Date.now();
        el.textContent = fmtCountdownShort(ms);
        if (ms <= 0) {
          clearInterval(_scheduleCountdownTimers[q.id]);
          delete _scheduleCountdownTimers[q.id];
          loadDynamicSchedule(); // refresh when quiz goes live
        }
      }
      tick();
      _scheduleCountdownTimers[q.id] = setInterval(tick, 1000);
    });

    // Re-observe new cards for staggered scroll animation
    grid.querySelectorAll('.schedule-card').forEach((el, idx) => {
      el.classList.add('reveal-item');
      el.style.transitionDelay = (idx * 90) + 'ms';
      observer.observe(el);
    });

  } catch (e) {
    console.warn('[Schedule] Failed to load:', e.message);
    if (grid) {
      grid.innerHTML = `
        <div class="schedule-card featured" style="justify-content:center;align-items:center;text-align:center;padding:60px 40px;">
          <div class="sc-info" style="padding-right:0;text-align:center;">
            <div style="font-size:36px;margin-bottom:16px;opacity:0.4">⚠️</div>
            <h3 class="sc-title" style="padding-right:0;margin-bottom:8px;">Schedule unavailable</h3>
            <p class="sc-desc" style="-webkit-line-clamp:unset;overflow:visible;">Please refresh the page to try again.</p>
          </div>
        </div>`;
    }
  }
}

// Only run schedule logic on pages that have the scheduleGrid element
if (document.getElementById('scheduleGrid')) {
  loadDynamicSchedule();
  // Refresh schedule every 60 seconds
  setInterval(loadDynamicSchedule, 60000);
}
