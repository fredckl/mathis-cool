import { CHALLENGE_SETTINGS, DEFAULT_CONFIG, DEFAULT_STATE, MIN_ALLOWED_MIN_TIME_MS, STORAGE_KEY } from '../constants.js';
import { clamp } from './math.js';

export function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function sanitizeChallengeCap(value, fallback) {
  return clamp(Math.floor(Number(value) || fallback), 1, 999);
}

export function normalizeConfig(state) {
  if (!state || !state.config) return;

  const cfg = state.config;
  cfg.theme = cfg.theme === 'light' ? 'light' : 'dark';
  cfg.maxAdd = sanitizeChallengeCap(cfg.maxAdd, DEFAULT_CONFIG.maxAdd);
  cfg.maxSub = sanitizeChallengeCap(cfg.maxSub, DEFAULT_CONFIG.maxSub);
  cfg.maxMul = sanitizeChallengeCap(cfg.maxMul, DEFAULT_CONFIG.maxMul);
  cfg.maxDiv = sanitizeChallengeCap(cfg.maxDiv, DEFAULT_CONFIG.maxDiv);
  cfg.minTimeMs = clamp(Number(cfg.minTimeMs) || DEFAULT_CONFIG.minTimeMs, MIN_ALLOWED_MIN_TIME_MS, 60_000);
  cfg.startTimeMs = clamp(Number(cfg.startTimeMs) || DEFAULT_CONFIG.startTimeMs, cfg.minTimeMs, 120_000);
  cfg.challengeDurationSec = clamp(
    Math.round(Number(cfg.challengeDurationSec) || DEFAULT_CONFIG.challengeDurationSec),
    CHALLENGE_SETTINGS.minDurationSec,
    CHALLENGE_SETTINGS.maxDurationSec
  );
}

export function mergeState(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  const out = clone(base);
  if (incoming.config) out.config = { ...out.config, ...incoming.config };
  if (['add', 'sub', 'mul', 'div'].includes(incoming.operation)) out.operation = incoming.operation;
  if (typeof incoming.level === 'number') out.level = incoming.level;
  if (typeof incoming.streak === 'number') out.streak = incoming.streak;
  if (incoming.totals) out.totals = { ...out.totals, ...incoming.totals };
  if (Array.isArray(incoming.history)) out.history = incoming.history;
  if (incoming.rewards) out.rewards = { ...out.rewards, ...incoming.rewards };
  return out;
}

export function loadState() {
  if (typeof window === 'undefined') return clone(DEFAULT_STATE);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    const merged = mergeState(DEFAULT_STATE, parsed);
    normalizeConfig(merged);
    return merged;
  } catch {
    return clone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  if (typeof window === 'undefined') return;
  try {
    const snapshot = clone(state);
    normalizeConfig(snapshot);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function applyThemeFromState(state) {
  if (typeof document === 'undefined') return;
  const theme = state?.config?.theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
}

export function resetState() {
  if (typeof window === 'undefined') return clone(DEFAULT_STATE);
  window.localStorage.removeItem(STORAGE_KEY);
  return clone(DEFAULT_STATE);
}
