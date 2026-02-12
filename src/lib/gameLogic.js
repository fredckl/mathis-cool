import { CHALLENGE_OPERATIONS, CHALLENGE_SETTINGS, DEFAULT_CONFIG } from '../constants.js';
import { clamp, randInt } from './math.js';
import { sanitizeChallengeCap } from './storage.js';

export function clampChallengeDurationSec(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n)) return DEFAULT_CONFIG.challengeDurationSec;
  return clamp(Math.round(n), CHALLENGE_SETTINGS.minDurationSec, CHALLENGE_SETTINGS.maxDurationSec);
}

export function challengeCapsFromConfig(cfg = DEFAULT_CONFIG) {
  const source = cfg || DEFAULT_CONFIG;
  return {
    add: sanitizeChallengeCap(source.maxAdd, DEFAULT_CONFIG.maxAdd),
    sub: sanitizeChallengeCap(source.maxSub, DEFAULT_CONFIG.maxSub),
    mul: sanitizeChallengeCap(source.maxMul, DEFAULT_CONFIG.maxMul),
    div: sanitizeChallengeCap(source.maxDiv, DEFAULT_CONFIG.maxDiv)
  };
}

const ZERO_FACTOR_BIAS = {
  mul: {
    cooldown: 0,
    probability: 0.15,
    cooldownMin: 3,
    cooldownMax: 6
  }
};

export function opSymbol(op) {
  if (op === 'sub') return '−';
  if (op === 'mul') return '×';
  if (op === 'div') return '÷';
  return '+';
}

export function opLabel(op) {
  if (op === 'sub') return 'Soustraction';
  if (op === 'mul') return 'Multiplication';
  if (op === 'div') return 'Division';
  return 'Addition';
}

export function questionUsesZeroOperand(question) {
  if (!question) return false;
  return question.a === 0 || question.b === 0;
}

export function repeatsZeroOperation(previousQuestion, candidate) {
  if (!previousQuestion || !candidate) return false;
  if (previousQuestion.op !== candidate.op) return false;
  return questionUsesZeroOperand(previousQuestion) && questionUsesZeroOperand(candidate);
}

export function numberRangeForLevel(level) {
  const t = clamp(level, 1, 12);
  if (t <= 2) return { min: 0, max: 5 };
  if (t <= 4) return { min: 0, max: 9 };
  if (t <= 6) return { min: 3, max: 12 };
  if (t <= 8) return { min: 5, max: 18 };
  if (t <= 10) return { min: 8, max: 25 };
  return { min: 10, max: 40 };
}

export function factorRangeForLevel(level) {
  const t = clamp(level, 1, 12);
  if (t <= 2) return { min: 0, max: 5 };
  if (t <= 4) return { min: 0, max: 10 };
  if (t <= 6) return { min: 0, max: 12 };
  if (t <= 8) return { min: 0, max: 15 };
  if (t <= 10) return { min: 0, max: 20 };
  return { min: 0, max: 25 };
}

export function divisionRangesForLevel(level) {
  const t = clamp(level, 1, 12);
  if (t <= 2) return { divisorMax: 5, quotientMax: 5 };
  if (t <= 4) return { divisorMax: 8, quotientMax: 8 };
  if (t <= 6) return { divisorMax: 10, quotientMax: 10 };
  if (t <= 8) return { divisorMax: 12, quotientMax: 12 };
  if (t <= 10) return { divisorMax: 15, quotientMax: 15 };
  return { divisorMax: 20, quotientMax: 20 };
}

export function pickMultiplicationFactor(range) {
  const limiter = ZERO_FACTOR_BIAS.mul;
  const zeroAllowed = range.min <= 0 && range.max >= 0 && limiter.cooldown <= 0;

  if (zeroAllowed && Math.random() < limiter.probability) {
    limiter.cooldown = randInt(limiter.cooldownMin, limiter.cooldownMax);
    return 0;
  }

  if (limiter.cooldown > 0) {
    limiter.cooldown -= 1;
  }

  const minNonZero = Math.max(1, range.min);
  if (minNonZero > range.max) {
    return range.max;
  }

  return randInt(minNonZero, range.max);
}

export function generateQuestion(state) {
  const op = state.operation === 'sub' || state.operation === 'mul' || state.operation === 'div' ? state.operation : 'add';
  const cfg = state.config || DEFAULT_CONFIG;

  let a;
  let b;
  let answer;

  if (op === 'mul') {
    const r = factorRangeForLevel(state.level);
    const cap = Math.max(1, Number(cfg.maxMul) || DEFAULT_CONFIG.maxMul);
    const max = Math.max(r.min, Math.min(r.max, cap));
    const range = { min: r.min, max };
    a = pickMultiplicationFactor(range);
    b = pickMultiplicationFactor(range);
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

export function tryBuildChallengeStep(op, base, min, max, caps = challengeCapsFromConfig()) {
  const a = base;
  if (!Number.isFinite(a)) return null;

  if (op === 'add') {
    const addCap = caps.add;
    const addMax = Math.max(0, Math.min(max - a, addCap));
    if (addMax < 1) return null;
    const b = randInt(1, addMax);
    return { op, a, b, answer: a + b };
  }

  if (op === 'sub') {
    const subCap = caps.sub;
    const subMax = Math.max(0, Math.min(a - min, subCap));
    if (subMax < 1) return null;
    const b = randInt(1, subMax);
    return { op, a, b, answer: a - b };
  }

  if (op === 'mul') {
    if (a === 0) {
      const b = randInt(1, Math.min(9, caps.mul));
      return { op, a, b, answer: 0 };
    }
    const absA = Math.abs(a);
    if (absA > caps.mul) return null;
    const maxFactorFromResult = Math.floor(max / Math.max(1, absA));
    const factorLimit = Math.max(0, Math.min(caps.mul, maxFactorFromResult));
    if (factorLimit < 1) return null;
    const b = randInt(1, factorLimit);
    const answer = a * b;
    if (answer < min || answer > max) return null;
    return { op, a, b, answer };
  }

  if (op === 'div') {
    if (a === 0) {
      const b = randInt(2, Math.min(9, caps.div));
      return { op, a, b, answer: 0 };
    }
    const divisors = [];
    const divisorCap = caps.div;
    for (let d = 2; d <= divisorCap; d++) {
      if (a % d !== 0) continue;
      const result = a / d;
      if (result < min || result > max) continue;
      if (Math.abs(result) > divisorCap) continue;
      divisors.push({ b: d, answer: result });
    }
    if (!divisors.length) return null;
    const pickedDiv = pick(divisors);
    return { op, a, b: pickedDiv.b, answer: pickedDiv.answer };
  }

  return null;
}

function pickNonZeroBetween(min, max) {
  for (let i = 0; i < 20; i += 1) {
    const candidate = randInt(min, max);
    if (candidate !== 0) return candidate;
  }
  if (min !== 0) return min;
  if (max !== 0) return max;
  return 0;
}

export function generateChallengeQuestion(prevValue, opts = {}, caps = challengeCapsFromConfig()) {
  const min = Number.isFinite(opts.resultMin) ? opts.resultMin : CHALLENGE_SETTINGS.resultMin;
  const max = Number.isFinite(opts.resultMax) ? opts.resultMax : CHALLENGE_SETTINGS.resultMax;
  const preventZeroOperand = Boolean(opts.preventZeroOperand);
  let base = Number.isFinite(prevValue) ? prevValue : randInt(min, max);
  if (preventZeroOperand && base === 0) {
    base = pickNonZeroBetween(min, max);
  }
  const maxAttempts = 80;

  for (let i = 0; i < maxAttempts; i++) {
    const op = pick(CHALLENGE_OPERATIONS);
    const candidate = tryBuildChallengeStep(op, base, min, max, caps);
    if (candidate) return candidate;
    if (!Number.isFinite(prevValue)) {
      base = randInt(min, max);
    }
  }

  const fallbackSubRange = Math.floor(Math.min(caps.sub, Math.max(0, base - min)));
  if (fallbackSubRange >= 1) {
    const b = fallbackSubRange;
    return { op: 'sub', a: base, b, answer: base - b };
  }

  const fallbackAddRange = Math.floor(Math.min(caps.add, Math.max(0, max - base)));
  if (fallbackAddRange >= 1) {
    const b = fallbackAddRange;
    return { op: 'add', a: base, b, answer: base + b };
  }

  return { op: 'add', a: clamp(base, min, max), b: 0, answer: clamp(base, min, max) };
}

export function pick(arr) {
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

export function pickEncouraging() {
  if (ENCOURAGING.length <= 1) return ENCOURAGING[0] || '';
  let idx = Math.floor(Math.random() * ENCOURAGING.length);
  if (idx === lastEncouragingIndex) idx = (idx + 1) % ENCOURAGING.length;
  lastEncouragingIndex = idx;
  return ENCOURAGING[idx];
}

export function pickPositive() {
  return pick(POSITIVE);
}

export function calcTimeLimitMs(state) {
  const { config } = state;
  const levelPenalty = (state.level - 1) * (config.timeStepMs * 2);
  const streakPenalty = Math.floor(state.streak / config.streakToSpeedUp) * config.timeStepMs;
  return clamp(config.startTimeMs - levelPenalty - streakPenalty, config.minTimeMs, config.startTimeMs);
}

export function formatMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0.0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

export function computeAccuracy(totals) {
  if (!totals.played) return 0;
  return totals.correct / totals.played;
}

export function computeAvgTimeMs(totals) {
  const answered = totals.played;
  if (!answered) return 0;
  return totals.totalAnswerTimeMs / answered;
}

function ensureBadge(state, id, label) {
  if (state.rewards.badges.includes(id)) return false;
  state.rewards.badges.push(id);
  state.lastBadgeLabel = label;
  return true;
}

export function updateRewards(state) {
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
  if (played >= 20 && acc >= 0.8) ensureBadge(state, 'acc80', 'Badge précision 80%');
  if (played >= 50 && acc >= 0.9) ensureBadge(state, 'acc90', 'Badge précision 90%');

  if (correct && correct % 5 === 0) {
    state.rewards.stars += 1;
  }
}
