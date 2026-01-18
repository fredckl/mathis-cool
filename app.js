const APP_NAME = 'Mathis Cool';

const STORAGE_KEY = 'mathis_cool_state_v1';

const MIN_ALLOWED_MIN_TIME_MS = 1500;

const DEFAULT_CONFIG = {
  soundOn: true,
  minTimeMs: 2200,
  startTimeMs: 5000,
  timeStepMs: 150,
  streakToSpeedUp: 3,
  streakToLevelUp: 5,
  levelMax: 12
};

const DEFAULT_STATE = {
  config: DEFAULT_CONFIG,
  operation: 'add',
  level: 1,
  streak: 0,
  totals: {
    played: 0,
    correct: 0,
    totalAnswerTimeMs: 0
  },
  history: [],
  rewards: {
    stars: 0,
    badges: []
  }
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function now() {
  return Date.now();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    const merged = mergeState(structuredClone(DEFAULT_STATE), parsed);
    normalizeConfig(merged);
    return merged;
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function normalizeConfig(state) {
  if (!state || !state.config) return;

  const cfg = state.config;
  cfg.minTimeMs = clamp(Number(cfg.minTimeMs) || DEFAULT_CONFIG.minTimeMs, MIN_ALLOWED_MIN_TIME_MS, 60_000);
  cfg.startTimeMs = clamp(Number(cfg.startTimeMs) || DEFAULT_CONFIG.startTimeMs, cfg.minTimeMs, 120_000);
}

function mergeState(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  const out = base;
  if (incoming.config) out.config = { ...base.config, ...incoming.config };
  if (incoming.operation === 'add' || incoming.operation === 'sub') out.operation = incoming.operation;
  if (typeof incoming.level === 'number') out.level = incoming.level;
  if (typeof incoming.streak === 'number') out.streak = incoming.streak;
  if (incoming.totals) out.totals = { ...base.totals, ...incoming.totals };
  if (Array.isArray(incoming.history)) out.history = incoming.history;
  if (incoming.rewards) out.rewards = { ...base.rewards, ...incoming.rewards };
  return out;
}

function saveState(state) {
  normalizeConfig(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0.0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

function computeAccuracy(totals) {
  if (!totals.played) return 0;
  return totals.correct / totals.played;
}

function computeAvgTimeMs(totals) {
  const answered = totals.played;
  if (!answered) return 0;
  return totals.totalAnswerTimeMs / answered;
}

function calcTimeLimitMs(state) {
  const { config } = state;
  const levelPenalty = (state.level - 1) * (config.timeStepMs * 2);
  const streakPenalty = Math.floor(state.streak / config.streakToSpeedUp) * config.timeStepMs;
  return clamp(config.startTimeMs - levelPenalty - streakPenalty, config.minTimeMs, config.startTimeMs);
}

function numberRangeForLevel(level) {
  const t = clamp(level, 1, 12);
  if (t <= 2) return { min: 0, max: 5 };
  if (t <= 4) return { min: 0, max: 9 };
  if (t <= 6) return { min: 3, max: 12 };
  if (t <= 8) return { min: 5, max: 18 };
  if (t <= 10) return { min: 8, max: 25 };
  return { min: 10, max: 40 };
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQuestion(state) {
  const r = numberRangeForLevel(state.level);
  let a = randInt(r.min, r.max);
  let b = randInt(r.min, r.max);

  const op = state.operation === 'sub' ? 'sub' : 'add';
  if (op === 'sub' && b > a) {
    const t = a;
    a = b;
    b = t;
  }

  const answer = op === 'sub' ? a - b : a + b;
  return {
    op,
    a,
    b,
    answer
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ENCOURAGING = [
  'Bien essayé !',
  'Continue, tu progresses !',
  'Super effort !',
  'Tu vas y arriver !',
  'Pas grave, on réessaie !',
  'C’est en s’entraînant qu’on devient fort !',
  'Tu es sur la bonne voie !',
  'On continue doucement, tu peux le faire.',
  'Ce n’est pas grave de se tromper.',
  'Chaque essai te rend meilleur !',
  'Bravo d’avoir essayé !',
  'Tu progresses à ton rythme.',
  'On recommence, tranquillement.',
  'Tu es courageux, continue !',
  'Ça arrive à tout le monde !',
  'On apprend en jouant.',
  'Tu peux être fier de toi.',
  'Encore un petit effort !',
  'Tu vas y arriver, j’en suis sûr.',
  'On passe à la suite, sans stress.'
];

const POSITIVE = [
  'Bravo !',
  'Génial !',
  'Excellent !',
  'Trop fort !',
  'Super !',
  'Magnifique !',
  'Incroyable !',
  'Bien joué !',
  'Parfait !',
  'Formidable !',
  'Tu assures !',
  'Ça, c’est du rapide !',
  'Champion !',
  'Top !',
  'Ouiiii !',
  'Quelle belle réponse !'
];

let lastEncouragingIndex = -1;

function pickEncouraging() {
  if (ENCOURAGING.length <= 1) return ENCOURAGING[0] || '';
  let idx = Math.floor(Math.random() * ENCOURAGING.length);
  if (idx === lastEncouragingIndex) idx = (idx + 1) % ENCOURAGING.length;
  lastEncouragingIndex = idx;
  return ENCOURAGING[idx];
}

function ensureBadge(state, id, label) {
  if (state.rewards.badges.includes(id)) return false;
  state.rewards.badges.push(id);
  state.lastBadgeLabel = label;
  return true;
}

function updateRewards(state) {
  const { played, correct } = state.totals;

  const milestones = [
    { n: 10, id: 'm10', label: 'Badge 10 questions' },
    { n: 25, id: 'm25', label: 'Badge 25 questions' },
    { n: 50, id: 'm50', label: 'Badge 50 questions' },
    { n: 100, id: 'm100', label: 'Badge 100 questions' }
  ];

  for (const m of milestones) {
    if (played >= m.n) ensureBadge(state, m.id, m.label);
  }

  const acc = computeAccuracy(state.totals);
  if (played >= 20 && acc >= 0.8) ensureBadge(state, 'acc80', 'Badge précision 80%' );
  if (played >= 50 && acc >= 0.9) ensureBadge(state, 'acc90', 'Badge précision 90%' );

  if (correct && correct % 5 === 0) {
    state.rewards.stars += 1;
  }
}

function playTone({ on, type }) {
  if (!on) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);

    if (type === 'good') {
      o.type = 'triangle';
      o.frequency.value = 740;
      g.gain.value = 0.06;
    } else {
      o.type = 'sine';
      o.frequency.value = 220;
      g.gain.value = 0.05;
    }

    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);

    o.start();
    o.stop(t0 + 0.2);

    o.onended = () => ctx.close();
  } catch {
    // ignore
  }
}

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) el.append(c);
  return el;
}

function setRoute(route) {
  window.location.hash = route;
}

function getRoute() {
  const r = (window.location.hash || '#/').replace('#', '');
  return r.startsWith('/') ? r : '/';
}

function mount(node) {
  const root = document.getElementById('app');
  root.replaceChildren(node);
}

function renderShell({ titleRight, content }) {
  const state = loadState();

  const soundToggle = h('div', {
    class: 'toggle',
    onclick: () => {
      const s = loadState();
      s.config.soundOn = !s.config.soundOn;
      saveState(s);
      render();
    }
  }, [
    h('div', { class: `switch ${state.config.soundOn ? 'on' : ''}` }),
    h('div', { class: 'sub', text: state.config.soundOn ? 'Sons: ON' : 'Sons: OFF' })
  ]);

  const progressButton = h('button', {
    class: 'btn btn-secondary',
    onclick: () => setRoute('/progress'),
    'aria-label': 'Mes progrès',
    title: 'Mes progrès'
  }, [
    h('span', { text: 'Mes progrès' })
  ]);

  const settingsButton = h('button', {
    class: 'btn btn-secondary',
    onclick: () => setRoute('/settings'),
    'aria-label': 'Réglages',
    title: 'Réglages'
  }, [
    h('span', {
      'aria-hidden': 'true',
      style: 'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;'
    }, [
      (() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');

        const gear = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        gear.setAttribute('d', 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.5a2 2 0 0 1-1 1.74l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '3');

        svg.append(gear, circle);
        return svg;
      })()
    ])
  ]);

  return h('div', { class: 'shell' }, [
    h('div', { class: 'header' }, [
      h('div', { class: 'brand' }, [
        h('div', { class: 'logo', 'aria-hidden': 'true' }),
        h('div', {}, [
          h('div', { class: 'h1', text: APP_NAME }),
          h('div', { class: 'sub', text: 'Jeu de calcul mental (addition)' })
        ])
      ]),
      h('div', { class: 'btn-row' }, [
        soundToggle,
        progressButton,
        settingsButton,
        titleRight || h('div', { class: 'badge', text: `Niveau ${state.level}` })
      ])
    ]),
    content,
    h('div', { class: 'footer' }, [
      h('div', { text: 'Hors ligne • Sans pub • Données locales' }),
      h('a', { href: '#/', text: 'Accueil' })
    ])
  ]);
}

function renderHome() {
  const state = loadState();

  const left = h('div', { class: 'card' }, [
    h('div', { class: 'card-inner grid' }, [
      h('div', { class: 'kids-big', text: 'Prêt à jouer ?' }),
      h('div', { class: 'sub', text: 'Une question à la fois. Tu réponds vite, et tu progresses !' }),
      h('div', { class: 'sub', text: 'Choisis ton jeu :' }),
      h('div', { class: 'op-grid' }, [
        h('button', {
          class: `op-tile ${state.operation === 'add' ? 'selected' : ''}`,
          onclick: () => {
            const s = loadState();
            s.operation = 'add';
            saveState(s);
            render();
          },
          'aria-label': 'Addition'
        }, [
          h('div', { class: 'op-icon', text: '+' }),
          h('div', { class: 'op-label', text: 'Addition' })
        ]),
        h('button', {
          class: `op-tile ${state.operation === 'sub' ? 'selected' : ''}`,
          onclick: () => {
            const s = loadState();
            s.operation = 'sub';
            saveState(s);
            render();
          },
          'aria-label': 'Soustraction'
        }, [
          h('div', { class: 'op-icon', text: '−' }),
          h('div', { class: 'op-label', text: 'Soustraction' })
        ])
      ]),
      h('div', { class: 'btn-row' }, [
        h('button', { class: 'btn btn-primary btn-full', onclick: () => setRoute('/play'), text: 'Jouer' })
      ]),
      h('div', { class: 'toast', text: `Niveau actuel: ${state.level} • Étoiles: ${state.rewards.stars}` })
    ])
  ]);

  return renderShell({
    content: h('div', { class: 'grid' }, [left])
  });
}

function renderSettings() {
  const state = loadState();

  const page = renderShell({
    titleRight: h('button', { class: 'btn btn-secondary', onclick: () => setRoute('/'), text: 'Retour' }),
    content: h('div', { class: 'grid grid-2' }, [
      h('div', { class: 'card' }, [
        h('div', { class: 'card-inner grid' }, [
          h('div', { class: 'kids-big', text: 'Réglages' }),
          h('div', { class: 'sub', text: 'Réservé aux parents (ou avec un adulte).' }),
          h('div', { class: 'stats' }, [
            stat('Questions', String(state.totals.played)),
            stat('Précision', `${Math.round(computeAccuracy(state.totals) * 100)}%`),
            stat('Temps (départ)', formatMs(state.config.startTimeMs)),
            stat('Temps (minimum)', formatMs(state.config.minTimeMs))
          ]),
          h('div', { class: 'sub', text: 'Astuce: tu peux activer/désactiver les sons en haut.' })
        ])
      ]),
      h('div', { class: 'card' }, [
        h('div', { class: 'card-inner grid' }, [
          h('div', { class: 'sub', text: 'Personnalisation du temps (en secondes)' }),
          h('input', {
            class: 'input',
            type: 'number',
            step: '0.1',
            min: String(MIN_ALLOWED_MIN_TIME_MS / 1000),
            value: String((state.config.minTimeMs / 1000).toFixed(1)),
            'data-min-time': '',
            oninput: (e) => {
              const minEl = e.currentTarget;
              const startEl = document.querySelector('[data-start-time]');

              const minSec = Number(String(minEl.value ?? '').replace(',', '.'));
              if (!Number.isFinite(minSec) || !startEl) return;

              const normalizedMinSec = Math.max(minSec, MIN_ALLOWED_MIN_TIME_MS / 1000);
              startEl.min = String(normalizedMinSec);

              const startSec = Number(String(startEl.value ?? '').replace(',', '.'));
              if (Number.isFinite(startSec) && startSec < normalizedMinSec) {
                startEl.value = String(normalizedMinSec.toFixed(1));
              }
            }
          }),
          h('input', {
            class: 'input',
            type: 'number',
            step: '0.1',
            min: String((state.config.minTimeMs / 1000).toFixed(1)),
            value: String((state.config.startTimeMs / 1000).toFixed(1)),
            'data-start-time': '',
            onchange: (e) => {
              const startEl = e.currentTarget;
              const minEl = document.querySelector('[data-min-time]');
              if (!minEl) return;

              const minSec = Number(String(minEl.value ?? '').replace(',', '.'));
              const normalizedMinSec = Math.max(minSec, MIN_ALLOWED_MIN_TIME_MS / 1000);

              const startSec = Number(String(startEl.value ?? '').replace(',', '.'));
              if (!Number.isFinite(startSec)) return;

              if (startSec < normalizedMinSec) {
                startEl.value = String(normalizedMinSec.toFixed(1));
              }
            }
          }),
          h('div', { class: 'btn-row' }, [
            h('button', {
              class: 'btn btn-secondary',
              onclick: () => {
                const s = loadState();

                const minEl = document.querySelector('[data-min-time]');
                const startEl = document.querySelector('[data-start-time]');

                const minSec = Number(String(minEl?.value ?? '').replace(',', '.'));
                const startSec = Number(String(startEl?.value ?? '').replace(',', '.'));

                if (!Number.isFinite(minSec) || !Number.isFinite(startSec)) {
                  render();
                  return;
                }

                const minMs = Math.round(minSec * 1000);
                const startMs = Math.round(startSec * 1000);

                s.config.minTimeMs = clamp(minMs, MIN_ALLOWED_MIN_TIME_MS, 60_000);
                s.config.startTimeMs = clamp(startMs, s.config.minTimeMs, 120_000);

                saveState(s);
                render();
              },
              text: 'Enregistrer'
            }),
            h('button', {
              class: 'btn btn-danger',
              onclick: () => {
                localStorage.removeItem(STORAGE_KEY);
                setRoute('/');
              },
              text: 'Réinitialiser'
            })
          ]),
          h('div', { class: 'sub', text: `Contraintes : minimum ≥ ${(MIN_ALLOWED_MIN_TIME_MS / 1000).toFixed(1)}s et départ ≥ minimum.` })
        ])
      ])
    ])
  });

  return page;
}

function stat(k, v) {
  return h('div', { class: 'stat' }, [
    h('div', { class: 'k', text: k }),
    h('div', { class: 'v', text: v })
  ]);
}

function renderProgress() {
  const state = loadState();
  const avg = computeAvgTimeMs(state.totals);
  const acc = computeAccuracy(state.totals);

  const summary = h('div', { class: 'card' }, [
    h('div', { class: 'card-inner grid' }, [
      h('div', { class: 'kids-big', text: 'Mes progrès' }),
      h('div', { class: 'stats' }, [
        stat('Questions', String(state.totals.played)),
        stat('Bonnes', String(state.totals.correct)),
        stat('Temps moyen', formatMs(avg)),
        stat('Niveau', String(state.level))
      ]),
      h('div', { class: 'toast', text: `Précision: ${Math.round(acc * 100)}% • Étoiles: ${state.rewards.stars}` })
    ])
  ]);

  const graphCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-inner grid' }, [
      h('div', { class: 'sub', text: 'Évolution (dernières 30 questions)' }),
      h('div', { class: 'canvas-wrap' }, [
        h('canvas', { id: 'chart', width: '820', height: '170' })
      ]),
      h('div', { class: 'sub', text: 'Vert = bonne réponse, Jaune = à retravailler' })
    ])
  ]);

  const rewards = h('div', { class: 'card' }, [
    h('div', { class: 'card-inner grid' }, [
      h('div', { class: 'sub', text: 'Récompenses' }),
      h('div', { class: 'toast', text: `Étoiles: ${state.rewards.stars}` }),
      h('div', { class: 'toast', text: state.rewards.badges.length ? `Badges: ${state.rewards.badges.length}` : 'Badges: aucun pour le moment' }),
      h('div', { class: 'sub', text: state.rewards.badges.length ? state.rewards.badges.join(' • ') : 'Joue encore pour débloquer des badges.' })
    ])
  ]);

  const page = renderShell({
    titleRight: h('button', { class: 'btn btn-secondary', onclick: () => setRoute('/'), text: 'Retour' }),
    content: h('div', { class: 'grid grid-2' }, [summary, rewards, graphCard])
  });

  queueMicrotask(() => drawChart(state));
  return page;
}

function drawChart(state) {
  const canvas = document.getElementById('chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.scale(dpr, dpr);

  const items = state.history.slice(-30);

  ctx.clearRect(0, 0, cssW, cssH);

  // background grid
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = (cssH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cssW, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (!items.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '800 14px ui-rounded, system-ui';
    ctx.fillText('Joue une partie pour voir le graphique.', 14, 28);
    return;
  }

  const maxT = Math.max(...items.map((x) => x.answerTimeMs || 0), 1);
  const pad = 10;
  const w = cssW - pad * 2;
  const h = cssH - pad * 2;

  const barW = Math.max(6, Math.floor(w / items.length) - 4);

  items.forEach((it, idx) => {
    const x = pad + idx * (barW + 4);
    const r = (it.answerTimeMs || 0) / maxT;
    const bh = clamp(r, 0.12, 1) * h;
    const y = pad + (h - bh);

    ctx.fillStyle = it.correct ? 'rgba(34, 197, 94, 0.92)' : 'rgba(245, 158, 11, 0.92)';
    ctx.fillRect(x, y, barW, bh);
  });
}

function renderPlay() {
  const state = loadState();

  let current = generateQuestion(state);
  let startedAt = 0;
  let timerId = null;
  let progressRaf = null;
  let answered = false;
  let timeLimitMs = calcTimeLimitMs(state);

  function stopTimers() {
    if (timerId) window.clearTimeout(timerId);
    timerId = null;
    if (progressRaf) cancelAnimationFrame(progressRaf);
    progressRaf = null;
  }

  function scheduleTimeout() {
    stopTimers();
    startedAt = now();
    answered = false;

    const bar = page.querySelector('[data-progress-inner]');
    const tick = () => {
      const elapsed = now() - startedAt;
      const pct = clamp((elapsed / timeLimitMs) * 100, 0, 100);
      if (bar) bar.style.width = `${pct}%`;
      if (elapsed < timeLimitMs && !answered) progressRaf = requestAnimationFrame(tick);
    };
    progressRaf = requestAnimationFrame(tick);

    timerId = window.setTimeout(() => {
      if (answered) return;
      onAnswered({ correct: false, value: null, timedOut: true });
    }, timeLimitMs);
  }

  function nextQuestion() {
    const st = loadState();
    timeLimitMs = calcTimeLimitMs(st);
    current = generateQuestion(st);

    const math = page.querySelector('[data-math]');
    const input = page.querySelector('[data-answer]');
    const toast = page.querySelector('[data-toast]');
    const sparkle = page.querySelector('[data-sparkle]');

    if (sparkle) sparkle.classList.remove('on');
    if (toast) {
      toast.className = 'toast';
      toast.textContent = `Tu as ${formatMs(timeLimitMs)} pour répondre.`;
    }

    if (math) math.textContent = current.op === 'sub' ? `${current.a} − ${current.b}` : `${current.a} + ${current.b}`;
    if (input) {
      input.value = '';
      input.focus();
    }

    scheduleTimeout();
  }

  function onAnswered({ correct, value, timedOut }) {
    if (answered) return;
    answered = true;
    stopTimers();

    const s = loadState();

    const answerTimeMs = clamp(now() - startedAt, 0, 60_000);

    s.totals.played += 1;
    s.totals.totalAnswerTimeMs += answerTimeMs;

    if (correct) {
      s.totals.correct += 1;
      s.streak += 1;
      if (s.streak % s.config.streakToLevelUp === 0) {
        s.level = clamp(s.level + 1, 1, s.config.levelMax);
      }
    } else {
      s.streak = 0;
      // gentle adaptation: if accuracy is low, ease level a bit
      const acc = computeAccuracy(s.totals);
      if (s.totals.played >= 12 && acc < 0.45) {
        s.level = clamp(s.level - 1, 1, s.config.levelMax);
      }
    }

    s.history.push({
      ts: now(),
      op: current.op,
      a: current.a,
      b: current.b,
      correct,
      answerTimeMs,
      timedOut: Boolean(timedOut),
      value
    });

    updateRewards(s);
    saveState(s);

    const toast = page.querySelector('[data-toast]');
    const sparkle = page.querySelector('[data-sparkle]');

    if (toast) {
      toast.className = `toast ${correct ? 'good' : 'bad'}`;
      toast.textContent = correct ? pick(POSITIVE) : pickEncouraging();
    }

    if (sparkle) {
      sparkle.classList.add('on');
      window.setTimeout(() => sparkle.classList.remove('on'), 520);
    }

    playTone({ on: s.config.soundOn, type: correct ? 'good' : 'bad' });

    const delayMs = correct ? 550 : 2500;
    window.setTimeout(() => {
      nextQuestion();
    }, delayMs);
  }

  const page = renderShell({
    titleRight: h('div', { class: 'badge', text: `Niveau ${state.level}` }),
    content: h('div', { class: 'grid' }, [
      h('div', { class: 'card sparkle', 'data-sparkle': '' }, [
        h('div', { class: 'card-inner grid' }, [
          h('div', { class: 'sub', text: `Mode: ${state.operation === 'sub' ? 'Soustraction' : 'Addition'} • Une seule question. Pas de stress !` }),
          h('div', { class: 'math', 'data-math': '', text: current.op === 'sub' ? `${current.a} − ${current.b}` : `${current.a} + ${current.b}` }),
          h('div', { class: 'progress' }, [h('div', { 'data-progress-inner': '' })]),
          h('input', {
            class: 'input',
            inputmode: 'numeric',
            pattern: '[0-9]*',
            placeholder: 'Ta réponse',
            'data-answer': '',
            onkeydown: (e) => {
              if (e.key === 'Enter') {
                const input = e.currentTarget;
                const raw = String(input.value ?? '').trim();
                const v = raw === '' ? null : Number(raw);
                const ok = v !== null && Number.isFinite(v) && v === current.answer;
                onAnswered({ correct: ok, value: v !== null && Number.isFinite(v) ? v : null, timedOut: false });
              }
            }
          }),
          h('div', { class: 'btn-row' }, [
            h('button', {
              class: 'btn btn-success',
              onclick: () => {
                const input = page.querySelector('[data-answer]');
                const raw = String(input?.value ?? '').trim();
                const v = raw === '' ? null : Number(raw);
                const ok = v !== null && Number.isFinite(v) && v === current.answer;
                onAnswered({ correct: ok, value: v !== null && Number.isFinite(v) ? v : null, timedOut: false });
              },
              text: 'Valider'
            }),
            h('button', { class: 'btn btn-secondary', onclick: () => setRoute('/'), text: 'Quitter' })
          ]),
          h('div', { class: 'toast', 'data-toast': '', text: `Tu as ${formatMs(timeLimitMs)} pour répondre.` })
        ])
      ])
    ])
  });

  queueMicrotask(() => {
    const input = page.querySelector('[data-answer]');
    if (input) input.focus();
    scheduleTimeout();
  });

  // cleanup if route changes
  window.addEventListener('hashchange', stopTimers, { once: true });

  return page;
}

function render() {
  const route = getRoute();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // ignore
    });
  }

  if (route === '/play') {
    mount(renderPlay());
    return;
  }

  if (route === '/progress') {
    mount(renderProgress());
    return;
  }

  if (route === '/settings') {
    mount(renderSettings());
    return;
  }

  mount(renderHome());
}

window.addEventListener('hashchange', render);
render();
