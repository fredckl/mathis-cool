import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Layout from '../components/Layout.jsx';
import { CelebrationShow, CELEBRATION_DURATION_MS } from '../components/CelebrationShow.jsx';
import { useAppState } from '../state/AppContext.jsx';
import { DEVICE } from '../lib/device.js';
import { now } from '../lib/math.js';
import {
  CHALLENGE_SETTINGS,
  DEFAULT_CONFIG
} from '../constants.js';
import {
  challengeCapsFromConfig,
  clampChallengeDurationSec,
  generateChallengeQuestion,
  opSymbol,
  pickEncouraging,
  pickPositive
} from '../lib/gameLogic.js';
import { stopFx, triggerFireworkFx, triggerFlashFx } from '../lib/fx.js';
import { playTone } from '../lib/audio.js';

const INTRO_TOAST = 'Enchaîne le plus de réponses possibles !';
const createInitialStats = () => ({ answered: 0, correct: 0, streak: 0, bestStreak: 0 });

export default function ChallengePage() {
  const navigate = useNavigate();
  const { state } = useAppState();

  const challengeCaps = useMemo(() => challengeCapsFromConfig(state.config || DEFAULT_CONFIG), [state.config]);
  const resultCap = useMemo(
    () => Math.max(challengeCaps.add, challengeCaps.sub, challengeCaps.mul, challengeCaps.div),
    [challengeCaps]
  );
  const challengeRange = useMemo(
    () => ({
      resultMin: CHALLENGE_SETTINGS.resultMin,
      resultMax: resultCap
    }),
    [resultCap]
  );
  const durationSec = clampChallengeDurationSec(state.config.challengeDurationSec);
  const durationMs = durationSec * 1000;

  const zeroSafeRange = useMemo(
    () => ({
      ...challengeRange,
      preventZeroOperand: true
    }),
    [challengeRange]
  );

  const [currentQuestion, setCurrentQuestion] = useState(() =>
    generateChallengeQuestion(null, zeroSafeRange, challengeCaps, resultCap)
  );
  const [answerValue, setAnswerValue] = useState('');
  const [toast, setToast] = useState(INTRO_TOAST);
  const [toastTone, setToastTone] = useState('');
  const [answerReveal, setAnswerReveal] = useState('');
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(() => createInitialStats());
  const [timeRemainingMs, setTimeRemainingMs] = useState(durationMs);
  const [isFinished, setIsFinished] = useState(false);
  const [acceptingAnswers, setAcceptingAnswers] = useState(true);
  const [sparkle, setSparkle] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);

  const inputRef = useRef(null);
  const timerRafRef = useRef(null);
  const timerTimeoutRef = useRef(null);
  const startedAtRef = useRef(0);
  const acceptingRef = useRef(true);
  const finishedRef = useRef(false);
  const statsRef = useRef(stats);
  const progressFillRef = useRef(null);
  const lastDisplayedSecondsRef = useRef(Math.ceil(durationMs / 1000));
  const celebrationTimeoutRef = useRef(null);

  const hideCelebration = useCallback(() => {
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
    setShowCelebration(false);
  }, []);

  const updateProgressFill = useCallback((ratio) => {
    const el = progressFillRef.current;
    if (!el) return;
    el.style.transform = `scaleX(${Math.min(Math.max(ratio, 0), 1)})`;
  }, []);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const focusInput = useCallback(() => {
    const input = inputRef.current;
    if (!input || DEVICE.shouldAvoidNativeKeyboard) return;
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
  }, []);

  const stopCountdown = useCallback(() => {
    if (timerTimeoutRef.current) {
      window.clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }
    if (timerRafRef.current) {
      cancelAnimationFrame(timerRafRef.current);
      timerRafRef.current = null;
    }
  }, []);

  const finishChallenge = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsFinished(true);
    setAcceptingAnswers(false);
    acceptingRef.current = false;
    stopCountdown();
    setTimeRemainingMs(0);
    updateProgressFill(0);
    setToast(`Terminé ! ${statsRef.current.correct} bonnes réponses sur ${statsRef.current.answered}.`);
    setToastTone('good');
    const snapshot = { correct: statsRef.current.correct, total: statsRef.current.answered };
    setCelebrationData(snapshot);
    setShowCelebration(true);
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current);
    }
    celebrationTimeoutRef.current = window.setTimeout(() => {
      setShowCelebration(false);
      celebrationTimeoutRef.current = null;
    }, CELEBRATION_DURATION_MS);
  }, [stopCountdown, updateProgressFill]);

  const startCountdown = useCallback(() => {
    startedAtRef.current = now();
    setTimeRemainingMs(durationMs);
    stopCountdown();
    finishedRef.current = false;
    setIsFinished(false);
    setAcceptingAnswers(true);
    acceptingRef.current = true;
    lastDisplayedSecondsRef.current = Math.ceil(durationMs / 1000);
    updateProgressFill(1);

    const tick = () => {
      const elapsed = now() - startedAtRef.current;
      const remaining = Math.max(0, durationMs - elapsed);
      updateProgressFill(remaining / durationMs);
      const nextSeconds = Math.max(0, Math.ceil(remaining / 1000));
      if (nextSeconds !== lastDisplayedSecondsRef.current) {
        lastDisplayedSecondsRef.current = nextSeconds;
        setTimeRemainingMs(remaining);
      }
      if (remaining <= 0) {
        finishChallenge();
        return;
      }
      timerRafRef.current = requestAnimationFrame(tick);
    };

    timerRafRef.current = requestAnimationFrame(tick);
    timerTimeoutRef.current = window.setTimeout(finishChallenge, durationMs + 16);
  }, [durationMs, finishChallenge, stopCountdown, updateProgressFill]);

  useEffect(() => {
    startCountdown();
    focusInput();
    return () => {
      stopCountdown();
      stopFx();
      hideCelebration();
    };
  }, [focusInput, hideCelebration, startCountdown, stopCountdown]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, []);

  const appendDigit = useCallback(
    (digit) => {
      if (!acceptingRef.current) return;
      setAnswerValue((prev) => `${prev}${digit}`);
      focusInput();
    },
    [focusInput]
  );

  const backspace = useCallback(() => {
    if (!acceptingRef.current) return;
    setAnswerValue((prev) => prev.slice(0, -1));
    focusInput();
  }, [focusInput]);

  const addHistoryEntry = useCallback((entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev];
      return next.slice(0, CHALLENGE_SETTINGS.historyLimit);
    });
  }, []);

  const loadNextQuestion = useCallback(() => {
    setCurrentQuestion((prev) => generateChallengeQuestion(prev.answer, zeroSafeRange, challengeCaps, resultCap));
    setAnswerValue('');
    setAnswerReveal('');
    focusInput();
  }, [challengeCaps, focusInput, resultCap, zeroSafeRange]);

  const restartChallenge = useCallback(() => {
    setHistory([]);
    setStats(createInitialStats());
    setAnswerValue('');
    setAnswerReveal('');
    setToast(INTRO_TOAST);
    setToastTone('');
    setSparkle(false);
    setShowCelebration(false);
    setCurrentQuestion(() => generateChallengeQuestion(null, zeroSafeRange, challengeCaps, resultCap));
    startCountdown();
    focusInput();
  }, [challengeCaps, focusInput, resultCap, startCountdown, zeroSafeRange]);

  const handleAnswer = useCallback(
    () => {
      if (!acceptingRef.current || finishedRef.current) return;
      const trimmed = answerValue.trim();
      const value = trimmed === '' ? null : Number(trimmed);
      const numeric = value !== null && Number.isFinite(value) ? value : null;
      const isCorrect = numeric !== null && numeric === currentQuestion.answer;

      setStats((prev) => {
        const answered = prev.answered + 1;
        const correct = prev.correct + (isCorrect ? 1 : 0);
        const streak = isCorrect ? prev.streak + 1 : 0;
        const bestStreak = Math.max(prev.bestStreak, streak);
        return { answered, correct, streak, bestStreak };
      });

      addHistoryEntry({
        a: currentQuestion.a,
        b: currentQuestion.b,
        answer: currentQuestion.answer,
        value: numeric,
        correct: isCorrect,
        op: currentQuestion.op
      });

      setToast(isCorrect ? pickPositive() : pickEncouraging());
      setToastTone(isCorrect ? 'good' : 'bad');

      if (isCorrect) {
        setAnswerReveal('');
        setSparkle(true);
        setTimeout(() => setSparkle(false), 520);
        triggerFireworkFx();
      } else {
        setAnswerReveal(`= ${currentQuestion.answer}`);
        triggerFlashFx();
      }

      playTone({ on: state.config.soundOn, type: isCorrect ? 'good' : 'bad' });
      loadNextQuestion();
    },
    [addHistoryEntry, answerValue, currentQuestion, loadNextQuestion, state.config.soundOn]
  );

  const handleFormSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (!acceptingRef.current) return;
      handleAnswer();
    },
    [handleAnswer]
  );

  const handleQuit = useCallback(() => {
    stopCountdown();
    stopFx();
    hideCelebration();
    navigate('/');
  }, [hideCelebration, navigate, stopCountdown]);

  const timerSeconds = Math.max(0, Math.ceil(timeRemainingMs / 1000));
  const timerLabel = isFinished ? 'Temps écoulé !' : `Temps restant : ${timerSeconds}s`;
  const progressTimerLabel = isFinished ? 'Terminé !' : `${timerSeconds}s`;
  const scoreLabel = `Score : ${stats.correct} / ${stats.answered}`;
  const streakLabel = `Meilleure série : ${stats.bestStreak}`;

  const titleRight = (
    <button type="button" className="btn btn-secondary" onClick={handleQuit}>
      Retour
    </button>
  );

  return (
    <Layout titleRight={titleRight} disableNav={!isFinished}>
      <div className="play-overlay" role="dialog" aria-modal="true" aria-label="Défi en cours">
        <div className="play-overlay-backdrop" aria-hidden="true" />
        <div className="play-overlay-card">
          <button type="button" className="play-overlay-close" aria-label="Quitter le défi" onClick={handleQuit}>
            <span aria-hidden="true">×</span>
          </button>
          <div className="grid">
            <div className={`card sparkle ${sparkle ? 'on' : ''}`} tabIndex={-1}>
              <div className="card-inner grid">
            <div className="kids-big">Mode Challenge</div>
            <div className="sub">Enchaîne les calculs pendant {durationSec}s.</div>

            {isFinished && (
              <div className="challenge-metrics challenge-metrics-summary">
                <div className="badge">{scoreLabel}</div>
                <div className="badge">{streakLabel}</div>
              </div>
            )}
            <div className="question-line">
              <div className="math">{`${currentQuestion.a} ${opSymbol(currentQuestion.op)} ${currentQuestion.b}`}</div>
              <div className={`answer-reveal ${answerReveal ? 'show' : ''}`}>{answerReveal}</div>
            </div>
            <div className="feedback-slot">
              <div className={`toast ${toastTone}`.trim()}>{toast}</div>
            </div>
            <div className="progress-meter" aria-label="Temps restant">
              <div className="progress">
                <div ref={progressFillRef} className="progress-fill" style={{ transform: 'scaleX(1)' }} />
              </div>
              <div className="progress-label" role="status" aria-live="polite">
                {progressTimerLabel}
              </div>
            </div>
            <form className="answer-form" onSubmit={handleFormSubmit}>
              <input
                ref={inputRef}
                className="input"
                value={answerValue}
                readOnly
                inputMode="none"
                pattern="[0-9]*"
                enterKeyHint="done"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Ta réponse"
                onFocus={(event) => {
                  if (DEVICE.shouldAvoidNativeKeyboard) {
                    try {
                      event.currentTarget.blur();
                    } catch {
                      // ignore
                    }
                  }
                }}
                onKeyDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
              <button className="submit-hidden" type="submit" tabIndex={-1} aria-hidden="true" />
              <div className="keypad" data-keypad>
                <div className="keypad-grid">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      className="btn btn-secondary keypad-btn"
                      aria-label={`Chiffre ${digit}`}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => appendDigit(digit)}
                    >
                      <span>{digit}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary keypad-btn keypad-btn-wide"
                    aria-label="Chiffre 0"
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => appendDigit('0')}
                  >
                    <span>0</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary keypad-btn"
                    aria-label="Effacer"
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={backspace}
                  >
                    <span>⌫</span>
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success keypad-btn keypad-btn-wide keypad-verify"
                    aria-label="Valider la réponse"
                  >
                    <span>Valider</span>
                  </button>
                </div>
              </div>
            </form>
            {isFinished && (
              <div className="challenge-metrics challenge-metrics-summary">
                <div className="badge">{scoreLabel}</div>
                <div className="badge">{streakLabel}</div>
              </div>
            )}
            {isFinished && (
              <>
                <div className="sub">Historique récent</div>
                <div className="challenge-history-list">
                  {history.map((entry, idx) => (
                    <div
                      key={`${entry.a}-${entry.b}-${entry.value}-${idx}`}
                      className={`toast challenge-history-item ${entry.correct ? 'good' : 'bad'}`}
                    >
                      <div className="k">{`${entry.a} ${opSymbol(entry.op)} ${entry.b}`}</div>
                      <div className="v">{entry.correct ? `✓ ${entry.value}` : `✗ ${entry.value ?? '?'}`}</div>
                      <div className="v">= {entry.answer}</div>
                    </div>
                  ))}
                </div>
                <div className="btn-row">
                  <button type="button" className="btn btn-primary" onClick={restartChallenge}>
                    Recommencer le challenge
                  </button>
                </div>
              </>
            )}

              </div>
            </div>
          </div>
        </div>
      </div>
      <CelebrationShow data={celebrationData} visible={showCelebration} flavor="challenge" />
    </Layout>
  );
}
