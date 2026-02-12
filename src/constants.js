export const APP_NAME = 'Mathis Cool';
export const APP_VERSION = import.meta.env.MATHIS_COOL_VERSION;

export const STORAGE_KEY = 'mathis_cool_state_v1';

export const MIN_ALLOWED_MIN_TIME_MS = 1500;

export const CHALLENGE_SETTINGS = {
  minDurationSec: 10,
  maxDurationSec: 180,
  resultMin: 0,
  resultMax: 999,
  historyLimit: 6
};

export const CHALLENGE_OPERATIONS = ['add', 'sub', 'mul', 'div'];

export const DEFAULT_CONFIG = {
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
  levelMax: 12,
  challengeDurationSec: 30
};

export const DEFAULT_STATE = {
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
