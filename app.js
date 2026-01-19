const APP_NAME = 'Mathis Cool';
const APP_VERSION = (typeof window !== 'undefined' && window.__MATHIS_COOL_VERSION__) ? window.__MATHIS_COOL_VERSION__ : 'v0';

const STORAGE_KEY = 'mathis_cool_state_v1';

const MIN_ALLOWED_MIN_TIME_MS = 1500;

const DEFAULT_CONFIG = {
  soundOn: true,
  theme: 'light',
  maxAdd: 20,
  maxSub: 20,
  maxMul: 12,
  maxDiv: 12,
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
  cfg.theme = cfg.theme === 'light' ? 'light' : 'dark';
  cfg.maxAdd = clamp(Math.floor(Number(cfg.maxAdd) || DEFAULT_CONFIG.maxAdd), 1, 999);
  cfg.maxSub = clamp(Math.floor(Number(cfg.maxSub) || DEFAULT_CONFIG.maxSub), 1, 999);
  cfg.maxMul = clamp(Math.floor(Number(cfg.maxMul) || DEFAULT_CONFIG.maxMul), 1, 999);
  cfg.maxDiv = clamp(Math.floor(Number(cfg.maxDiv) || DEFAULT_CONFIG.maxDiv), 1, 999);
  cfg.minTimeMs = clamp(Number(cfg.minTimeMs) || DEFAULT_CONFIG.minTimeMs, MIN_ALLOWED_MIN_TIME_MS, 60_000);
  cfg.startTimeMs = clamp(Number(cfg.startTimeMs) || DEFAULT_CONFIG.startTimeMs, cfg.minTimeMs, 120_000);
}

function applyThemeFromState(state) {
  const theme = state?.config?.theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
}

function mergeState(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  const out = base;
  if (incoming.config) out.config = { ...base.config, ...incoming.config };
  if (incoming.operation === 'add' || incoming.operation === 'sub' || incoming.operation === 'mul' || incoming.operation === 'div') out.operation = incoming.operation;
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

function exportLocalStorage() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    data[key] = localStorage.getItem(key);
  }

  const payload = {
    meta: {
      app: APP_NAME,
      exportedAt: new Date().toISOString()
    },
    data
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mathis-cool-localstorage-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function clearUserCacheAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignore
  }

  window.location.reload();
}

async function importLocalStorageFromFile(file) {
  if (!file) return;
  const text = await file.text();
  const parsed = JSON.parse(text);

  const data = parsed?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid import format');
  }

  const ok = window.confirm('Importer ces données va remplacer TOUTES les données locales (localStorage) sur cet appareil. Continuer ?');
  if (!ok) return;

  localStorage.clear();
  for (const [k, v] of Object.entries(data)) {
    if (typeof k !== 'string') continue;
    if (v === null || v === undefined) continue;
    localStorage.setItem(k, String(v));
  }
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

function opSymbol(op) {
  if (op === 'sub') return '−';
  if (op === 'mul') return '×';
  if (op === 'div') return '÷';
  return '+';
}

function opLabel(op) {
  if (op === 'sub') return 'Soustraction';
  if (op === 'mul') return 'Multiplication';
  if (op === 'div') return 'Division';
  return 'Addition';
}

function factorRangeForLevel(level) {
  const t = clamp(level, 1, 12);
  if (t <= 2) return { min: 0, max: 5 };
  if (t <= 4) return { min: 0, max: 10 };
  if (t <= 6) return { min: 0, max: 12 };
  if (t <= 8) return { min: 0, max: 15 };
  if (t <= 10) return { min: 0, max: 20 };
  return { min: 0, max: 25 };
}

function divisionRangesForLevel(level) {
  const t = clamp(level, 1, 12);
  if (t <= 2) return { divisorMax: 5, quotientMax: 5 };
  if (t <= 4) return { divisorMax: 8, quotientMax: 8 };
  if (t <= 6) return { divisorMax: 10, quotientMax: 10 };
  if (t <= 8) return { divisorMax: 12, quotientMax: 12 };
  if (t <= 10) return { divisorMax: 15, quotientMax: 15 };
  return { divisorMax: 20, quotientMax: 20 };
}

function generateQuestion(state) {
  const op = state.operation === 'sub' || state.operation === 'mul' || state.operation === 'div' ? state.operation : 'add';
  const cfg = state.config || DEFAULT_CONFIG;

  let a;
  let b;
  let answer;

  if (op === 'mul') {
    const r = factorRangeForLevel(state.level);
    const cap = Math.max(1, Number(cfg.maxMul) || DEFAULT_CONFIG.maxMul);
    const max = Math.max(r.min, Math.min(r.max, cap));
    a = randInt(r.min, max);
    b = randInt(r.min, max);
    answer = a * b;
  } else if (op === 'div') {
    const { divisorMax, quotientMax } = divisionRangesForLevel(state.level);
    const cap = Math.max(1, Number(cfg.maxDiv) || DEFAULT_CONFIG.maxDiv);
    const divMax = Math.max(1, Math.min(divisorMax, cap));
    const divisor = randInt(1, divMax);
    const qMax = Math.max(0, Math.min(quotientMax, Math.floor(cap / divisor)));
    const quotient = randInt(0, qMax);
    a = divisor * quotient;
    b = divisor;
    answer = quotient;
  } else {
    const r = numberRangeForLevel(state.level);
    const cap = op === 'sub'
      ? Math.max(1, Number(cfg.maxSub) || DEFAULT_CONFIG.maxSub)
      : Math.max(1, Number(cfg.maxAdd) || DEFAULT_CONFIG.maxAdd);
    const max = Math.max(r.min, Math.min(r.max, cap));
    a = randInt(r.min, max);
    b = randInt(r.min, max);
    if (a === 0 && max >= 1) a = randInt(1, max);
    if (b === 0 && max >= 1) b = randInt(1, max);
    if (op === 'sub' && b > a) {
      const t = a;
      a = b;
      b = t;
    }
    if (op === 'sub' && b === 0 && max >= 1) b = randInt(1, max);
    answer = op === 'sub' ? a - b : a + b;
  }

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

function levelStarsBadge(state) {
  return h('div', { class: 'badge badge-2l' }, [
    h('div', { class: 'badge-top', text: `Niveau ${state.level}` }),
    h('div', { class: 'badge-bottom', text: `⭐ ${state.rewards.stars}` })
  ]);
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
          h('div', { class: 'sub', text: 'Jeu de calcul mental' })
        ])
      ]),
      h('div', { class: 'btn-row' }, [
        titleRight || levelStarsBadge(state),
        progressButton,
        soundToggle,
        settingsButton
      ])
    ]),
    content,
    h('div', { class: 'footer' }, [
      h('div', { text: `Hors ligne • Sans pub • Données locales • ${APP_VERSION}` }),
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
        ]),
        h('button', {
          class: `op-tile ${state.operation === 'mul' ? 'selected' : ''}`,
          onclick: () => {
            const s = loadState();
            s.operation = 'mul';
            saveState(s);
            render();
          },
          'aria-label': 'Multiplication'
        }, [
          h('div', { class: 'op-icon', text: '×' }),
          h('div', { class: 'op-label', text: 'Multiplication' })
        ]),
        h('button', {
          class: `op-tile ${state.operation === 'div' ? 'selected' : ''}`,
          onclick: () => {
            const s = loadState();
            s.operation = 'div';
            saveState(s);
            render();
          },
          'aria-label': 'Division'
        }, [
          h('div', { class: 'op-icon', text: '÷' }),
          h('div', { class: 'op-label', text: 'Division' })
        ])
      ]),
      h('div', { class: 'btn-row' }, [
        h('button', { class: 'btn btn-primary btn-full', onclick: () => setRoute('/play'), text: 'Jouer' })
      ])
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
          h('div', { class: 'sub', text: 'Thème' }),
          h('div', { class: 'btn-row' }, [
            h('button', {
              class: `btn ${state.config.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`,
              onclick: () => {
                const s = loadState();
                s.config.theme = 'dark';
                saveState(s);
                applyThemeFromState(s);
                render();
              },
              text: 'Sombre'
            }),
            h('button', {
              class: `btn ${state.config.theme === 'light' ? 'btn-primary' : 'btn-secondary'}`,
              onclick: () => {
                const s = loadState();
                s.config.theme = 'light';
                saveState(s);
                applyThemeFromState(s);
                render();
              },
              text: 'Clair'
            })
          ]),
          h('div', { class: 'sub', text: 'Nombres max (plafonds)' }),
          h('div', { class: 'sub', text: 'Addition (valeur max pour chaque nombre a et b)' }),
          h('input', {
            class: 'input',
            type: 'number',
            step: '1',
            min: '1',
            value: String(state.config.maxAdd),
            'data-cap-add': ''
          }),
          h('div', { class: 'sub', text: 'Soustraction (valeur max pour chaque nombre a et b)' }),
          h('input', {
            class: 'input',
            type: 'number',
            step: '1',
            min: '1',
            value: String(state.config.maxSub),
            'data-cap-sub': ''
          }),
          h('div', { class: 'sub', text: 'Multiplication (ex: 12 → au pire 12 × 12)' }),
          h('input', {
            class: 'input',
            type: 'number',
            step: '1',
            min: '1',
            value: String(state.config.maxMul),
            'data-cap-mul': ''
          }),
          h('div', { class: 'sub', text: 'Division (plafond sur le dividende et le diviseur, divisions entières)' }),
          h('input', {
            class: 'input',
            type: 'number',
            step: '1',
            min: '1',
            value: String(state.config.maxDiv),
            'data-cap-div': ''
          }),
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
          h('div', { class: 'sub', text: 'Temps minimum (limite basse)' }),
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
          h('div', { class: 'sub', text: 'Temps de départ (limite haute)' }),
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
                const capAddEl = document.querySelector('[data-cap-add]');
                const capSubEl = document.querySelector('[data-cap-sub]');
                const capMulEl = document.querySelector('[data-cap-mul]');
                const capDivEl = document.querySelector('[data-cap-div]');

                const minSec = Number(String(minEl?.value ?? '').replace(',', '.'));
                const startSec = Number(String(startEl?.value ?? '').replace(',', '.'));
                const capAdd = Math.floor(Number(String(capAddEl?.value ?? '').replace(',', '.')));
                const capSub = Math.floor(Number(String(capSubEl?.value ?? '').replace(',', '.')));
                const capMul = Math.floor(Number(String(capMulEl?.value ?? '').replace(',', '.')));
                const capDiv = Math.floor(Number(String(capDivEl?.value ?? '').replace(',', '.')));

                if (!Number.isFinite(minSec) || !Number.isFinite(startSec)) {
                  render();
                  return;
                }

                const minMs = Math.round(minSec * 1000);
                const startMs = Math.round(startSec * 1000);

                s.config.minTimeMs = clamp(minMs, MIN_ALLOWED_MIN_TIME_MS, 60_000);
                s.config.startTimeMs = clamp(startMs, s.config.minTimeMs, 120_000);

                if (Number.isFinite(capAdd)) s.config.maxAdd = clamp(capAdd, 1, 999);
                if (Number.isFinite(capSub)) s.config.maxSub = clamp(capSub, 1, 999);
                if (Number.isFinite(capMul)) s.config.maxMul = clamp(capMul, 1, 999);
                if (Number.isFinite(capDiv)) s.config.maxDiv = clamp(capDiv, 1, 999);

                saveState(s);
                render();
              },
              text: 'Enregistrer'
            }),
            h('button', {
              class: 'btn btn-secondary',
              onclick: async () => {
                await clearUserCacheAndReload();
              },
              text: 'Vider le cache'
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
          h('div', { class: 'sub', text: `Contraintes : minimum ≥ ${(MIN_ALLOWED_MIN_TIME_MS / 1000).toFixed(1)}s et départ ≥ minimum.` }),
          (() => {
            const fileInput = h('input', {
              type: 'file',
              accept: 'application/json',
              style: 'display:none'
            });

            fileInput.addEventListener('change', async (e) => {
              const f = e.currentTarget?.files?.[0];
              try {
                await importLocalStorageFromFile(f);
                window.location.reload();
              } catch {
                window.alert("Impossible d'importer ce fichier.");
              } finally {
                e.currentTarget.value = '';
              }
            });

            return h('div', { class: 'btn-row' }, [
              h('button', {
                class: 'btn btn-secondary',
                onclick: () => {
                  try {
                    exportLocalStorage();
                  } catch {
                    window.alert("Impossible d'exporter les données.");
                  }
                },
                text: 'Exporter'
              }),
              h('button', {
                class: 'btn btn-secondary',
                onclick: () => fileInput.click(),
                text: 'Importer'
              }),
              fileInput
            ]);
          })()
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

function badgeLabel(id) {
  const map = {
    m10: 'Badge 10 questions',
    m25: 'Badge 25 questions',
    m50: 'Badge 50 questions',
    m100: 'Badge 100 questions',
    acc80: 'Badge précision 80%',
    acc90: 'Badge précision 90%'
  };
  return map[id] || id;
}

function renderProgress() {
  const state = loadState();
  const avg = computeAvgTimeMs(state.totals);
  const acc = computeAccuracy(state.totals);

  function progressRow(label, value, max, pct, detail) {
    const p = clamp(Number.isFinite(pct) ? pct : 0, 0, 1);
    const w = `${Math.round(p * 100)}%`;
    const d = detail ?? `${value} / ${max}`;
    return h('div', { class: 'progress-row' }, [
      h('div', { class: 'k', text: label }),
      h('div', { class: 'progress progress-meter' }, [
        h('div', { class: 'progress-fill', style: `width: ${w};` }, []),
        h('div', { class: 'progress-label', text: d })
      ])
    ]);
  }

  const maxBadges = 6;
  const nextStarSteps = 5;
  const nextStar = state.totals.correct % nextStarSteps;

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

  const progressBars = h('div', { class: 'card' }, [
    h('div', { class: 'card-inner grid' }, [
      h('div', { class: 'sub', text: 'Barres' }),
      progressRow(
        'Précision',
        state.totals.correct,
        Math.max(1, state.totals.played),
        acc,
        `${Math.round(acc * 100)}% (${state.totals.correct} / ${state.totals.played})`
      ),
      progressRow(
        'Niveau',
        state.level,
        state.config.levelMax,
        state.config.levelMax ? state.level / state.config.levelMax : 0,
        `${state.level} / ${state.config.levelMax}`
      ),
      progressRow(
        'Prochaine étoile',
        nextStar,
        nextStarSteps,
        nextStar / nextStarSteps,
        `${nextStar} / ${nextStarSteps}`
      ),
      progressRow(
        'Badges',
        state.rewards.badges.length,
        maxBadges,
        state.rewards.badges.length / maxBadges,
        `${state.rewards.badges.length} / ${maxBadges}`
      )
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

    ])
  ]);

  const page = renderShell({
    titleRight: h('button', { class: 'btn btn-secondary', onclick: () => setRoute('/'), text: 'Retour' }),
    content: h('div', { class: 'grid grid-2' }, [summary, rewards, progressBars, graphCard])
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

  const seenCorrect = new Set();

  function questionKey(q) {
    if (!q) return '';
    if (q.op === 'add' || q.op === 'mul') {
      const x = Math.min(q.a, q.b);
      const y = Math.max(q.a, q.b);
      return `${q.op}|${x}|${y}`;
    }
    return `${q.op}|${q.a}|${q.b}`;
  }

  function pickNextQuestion(st) {
    const maxAttempts = 60;
    let q = generateQuestion(st);
    for (let i = 0; i < maxAttempts; i++) {
      const k = questionKey(q);
      if (!k || !seenCorrect.has(k)) return q;
      q = generateQuestion(st);
    }
    return q;
  }

  let current = pickNextQuestion(state);
  let startedAt = 0;
  let timerId = null;
  let progressRaf = null;
  let answered = false;
  let timeLimitMs = calcTimeLimitMs(state);
  const sessionTotal = 10;
  let sessionIndex = 1;

  function getAnswerInput() {
    return page?.querySelector?.('[data-answer]') || null;
  }

  function submitAnswer() {
    const input = getAnswerInput();
    const raw = String(input?.value ?? '').trim();
    const v = raw === '' ? null : Number(raw);
    const ok = v !== null && Number.isFinite(v) && v === current.answer;
    onAnswered({ correct: ok, value: v !== null && Number.isFinite(v) ? v : null, timedOut: false });
    keepFocus();
    window.setTimeout(keepFocus, 0);
  }

  function keepFocus() {
    const input = getAnswerInput();
    if (!input) return;
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
  }

  function appendDigit(d) {
    const input = getAnswerInput();
    if (!input) return;
    input.value = `${String(input.value ?? '')}${String(d)}`;
    keepFocus();
  }

  function backspace() {
    const input = getAnswerInput();
    if (!input) return;
    const s = String(input.value ?? '');
    input.value = s.slice(0, -1);
    keepFocus();
  }

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

  function updateSessionCounter() {
    const counter = page.querySelector('[data-session-counter]');
    if (!counter) return;
    counter.textContent = `Question ${sessionIndex} / ${sessionTotal}`;
  }

  function nextQuestion() {
    const st = loadState();
    timeLimitMs = calcTimeLimitMs(st);
    current = pickNextQuestion(st);

    const math = page.querySelector('[data-math]');
    const input = page.querySelector('[data-answer]');
    const toast = page.querySelector('[data-toast]');
    const sparkle = page.querySelector('[data-sparkle]');
    const firework = page.querySelector('[data-firework]');

    if (sparkle) sparkle.classList.remove('on');
    if (firework) {
      firework.classList.remove('on');
      firework.textContent = '🎆';
    }
    if (toast) {
      toast.className = 'toast';
      toast.textContent = `Tu as ${formatMs(timeLimitMs)} pour répondre.`;
    }

    updateSessionCounter();

    if (math) math.textContent = `${current.a} ${opSymbol(current.op)} ${current.b}`;
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
      seenCorrect.add(questionKey(current));
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
    const firework = page.querySelector('[data-firework]');

    if (toast) {
      toast.className = `toast ${correct ? 'good' : 'bad'}`;
      toast.textContent = correct ? pick(POSITIVE) : pickEncouraging();
    }

    if (sparkle) {
      sparkle.classList.add('on');
      window.setTimeout(() => sparkle.classList.remove('on'), 520);
    }

    if (firework) {
      if (correct) {
        firework.textContent = '🎆';
        firework.classList.add('on');
        window.setTimeout(() => firework.classList.remove('on'), 720);
      } else {
        firework.textContent = `= ${current.answer}`;
        firework.classList.add('on');
      }
    }

    playTone({ on: s.config.soundOn, type: correct ? 'good' : 'bad' });

    window.setTimeout(keepFocus, 0);

    if (sessionIndex >= sessionTotal) {
      const counter = page.querySelector('[data-session-counter]');
      if (counter) counter.textContent = `Terminé ! ${sessionTotal} / ${sessionTotal}`;

      const t = page.querySelector('[data-toast]');
      if (t) {
        t.className = 'toast good';
        t.textContent = 'Bravo ! Partie terminée.';
      }

      window.setTimeout(() => {
        setRoute('/progress');
      }, 1200);
      return;
    }

    sessionIndex += 1;

    const delayMs = correct ? 550 : 2500;
    window.setTimeout(() => {
      nextQuestion();
    }, delayMs);
  }

  const page = renderShell({
    titleRight: levelStarsBadge(state),
    content: h('div', { class: 'grid' }, [
      h('div', { class: 'card sparkle', 'data-sparkle': '' }, [
        h('div', { class: 'card-inner grid' }, [
          h('div', { class: 'sub', text: `Mode: ${opLabel(state.operation)} • Une seule question. Pas de stress !` }),
          h('div', { class: 'badge session-counter', 'data-session-counter': '', text: `Question ${sessionIndex} / ${sessionTotal}` }),
          h('div', { class: 'question-line' }, [
            h('div', { class: 'math', 'data-math': '', text: `${current.a} ${opSymbol(current.op)} ${current.b}` }),
            h('div', { class: 'firework', 'data-firework': '', text: '🎆' })
          ]),
          h('div', { class: 'progress' }, [h('div', { class: 'progress-fill', 'data-progress-inner': '' })]),
          h('form', {
            class: 'answer-form',
            onsubmit: (e) => {
              e.preventDefault();
              submitAnswer();
            }
          }, [
            h('input', {
              class: 'input',
              inputmode: 'none',
              pattern: '[0-9]*',
              readonly: '',
              autocomplete: 'off',
              autocapitalize: 'off',
              autocorrect: 'off',
              spellcheck: 'false',
              onpointerdown: (e) => e.preventDefault(),
              placeholder: 'Ta réponse',
              'data-answer': ''
            }),
            h('button', { class: 'submit-hidden', type: 'submit', tabindex: '-1' }, []),
            h('div', { class: 'keypad', 'data-keypad': '' }, [
              h('div', { class: 'keypad-grid' }, [
                ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => h('button', {
                  class: 'btn btn-secondary keypad-btn',
                  type: 'button',
                  'aria-label': `Chiffre ${d}`,
                  onpointerdown: (e) => e.preventDefault(),
                  onclick: () => appendDigit(d)
                }, [h('span', { text: d })])),
                h('button', {
                  class: 'btn btn-secondary keypad-btn keypad-btn-wide',
                  type: 'button',
                  'aria-label': 'Chiffre 0',
                  onpointerdown: (e) => e.preventDefault(),
                  onclick: () => appendDigit('0')
                }, [h('span', { text: '0' })]),
                h('button', {
                  class: 'btn btn-secondary keypad-btn',
                  type: 'button',
                  'aria-label': 'Effacer',
                  onpointerdown: (e) => e.preventDefault(),
                  onclick: () => backspace()
                }, [h('span', { text: '⌫' })]),
                h('button', {
                  class: 'btn btn-success keypad-btn keypad-btn-wide keypad-verify',
                  type: 'submit',
                  'aria-label': 'Vérifier la réponse'
                }, [h('span', { text: 'Vérifier' })])
              ])
            ])
          ]),
          h('div', { class: 'btn-row' }, [
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
    updateSessionCounter();
    scheduleTimeout();
  });

  // cleanup if route changes
  window.addEventListener('hashchange', stopTimers, { once: true });

  return page;
}

function render() {
  const route = getRoute();

  applyThemeFromState(loadState());

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

let didRegisterServiceWorker = false;

function registerServiceWorker() {
  if (didRegisterServiceWorker) return;
  didRegisterServiceWorker = true;
  if (!('serviceWorker' in navigator)) return;

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  navigator.serviceWorker.register('/sw.js').then((reg) => {
    try {
      reg.update();
    } catch {
      // ignore
    }

    if (reg.waiting) {
      try {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch {
        // ignore
      }
    }
  }).catch(() => {
    // ignore
  });
}

window.addEventListener('hashchange', render);
registerServiceWorker();
render();
