import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Layout from '../components/Layout.jsx';
import { CelebrationShow, CELEBRATION_DURATION_MS } from '../components/CelebrationShow.jsx';
import { useAppState } from '../state/AppContext.jsx';
import { DEVICE } from '../lib/device.js';
import { clone } from '../lib/storage.js';
import { playTone } from '../lib/audio.js';
import { stopFx, triggerFireworkFx, triggerFlashFx } from '../lib/fx.js';
import {
  calcTimeLimitMs,
  computeAccuracy,
  formatMs,
  generateQuestion,
  opLabel,
  opSymbol,
  pickEncouraging,
  pickPositive,
  repeatsZeroOperation,
  updateRewards
} from '../lib/gameLogic.js';
import { clamp, now } from '../lib/math.js';

const SESSION_TOTAL = 10;

function questionKey(question) {
  if (!question) return '';
  if (question.op === 'add' || question.op === 'mul') {
    const x = Math.min(question.a, question.b);
    const y = Math.max(question.a, question.b);
    return `${question.op}|${x}|${y}`;
  }
  return `${question.op}|${question.a}|${question.b}`;
}

function pickNextQuestion(baseState, seenCorrect, previousQuestion = null) {
  const seen = seenCorrect || new Set();
  const maxAttempts = 60;
  let candidate = generateQuestion(baseState);
  for (let i = 0; i < maxAttempts; i += 1) {
    const key = questionKey(candidate);
    if (!repeatsZeroOperation(previousQuestion, candidate) && (!key || !seen.has(key))) {
      return candidate;
    }
    candidate = generateQuestion(baseState);
  }
  return candidate;
}

export default function PlayPage() {
  const navigate = useNavigate();
  const { state, setState } = useAppState();

  const seenCorrectRef = useRef(new Set());
  const [question, setQuestion] = useState(() => pickNextQuestion(state, seenCorrectRef.current));
  const [sessionIndex, setSessionIndex] = useState(1);
  const [answer, setAnswer] = useState('');
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState('');
  const [answerReveal, setAnswerReveal] = useState('');
  const [sparkle, setSparkle] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);

  const timeLimitMs = useMemo(
    () => calcTimeLimitMs(state),
    [
      state.config.minTimeMs,
      state.config.startTimeMs,
      state.config.timeStepMs,
      state.config.streakToSpeedUp,
      state.level,
      state.streak
    ]
  );

  const inputRef = useRef(null);
  const timerIdRef = useRef(null);
  const progressRafRef = useRef(null);
  const startedAtRef = useRef(0);
  const answeredRef = useRef(false);
  const timeoutsRef = useRef(new Set());
  const progressFillRef = useRef(null);
  const timeLimitRef = useRef(timeLimitMs);
  const sessionStatsRef = useRef({ played: 0, correct: 0 });

  const resetSessionStats = useCallback(() => {
    sessionStatsRef.current = { played: 0, correct: 0 };
  }, []);

  const updateProgressFill = useCallback((ratio) => {
    const el = progressFillRef.current;
    if (!el) return;
    el.style.transform = `scaleX(${ratio})`;
  }, []);

  const focusInput = useCallback(() => {
    const el = inputRef.current;
    if (!el || DEVICE.shouldAvoidNativeKeyboard) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }, []);

  const stopTimers = useCallback(() => {
    if (timerIdRef.current) {
      window.clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
    if (progressRafRef.current) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
  }, []);

  const setTrackedTimeout = useCallback((fn, delayMs) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current.delete(id);
      fn();
    }, delayMs);
    timeoutsRef.current.add(id);
    return id;
  }, []);

  const clearTrackedTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current.clear();
  }, []);

  const appendDigit = useCallback(
    (digit) => {
      if (answeredRef.current || isFinished) return;
      setAnswer((prev) => `${prev}${digit}`);
      focusInput();
    },
    [focusInput, isFinished]
  );

  const backspace = useCallback(() => {
    if (answeredRef.current || isFinished) return;
    setAnswer((prev) => prev.slice(0, -1));
    focusInput();
  }, [focusInput, isFinished]);

  const submitAnswer = useCallback(
    ({ timedOut = false } = {}) => {
      if (answeredRef.current || isFinished) return;
      answeredRef.current = true;
      stopTimers();

      const raw = answer.trim();
      const numeric = raw === '' ? null : Number(raw);
      const value = numeric !== null && Number.isFinite(numeric) ? numeric : null;
      const correct = value !== null && value === question.answer;
      const answerTimeMs = clamp(now() - startedAtRef.current, 0, 60_000);

      let updatedSnapshot = state;
      setState((prev) => {
        const next = clone(prev);
        next.totals.played += 1;
        next.totals.totalAnswerTimeMs += answerTimeMs;

        if (correct) {
          seenCorrectRef.current.add(questionKey(question));
          next.totals.correct += 1;
          next.streak += 1;
          if (next.streak % next.config.streakToLevelUp === 0) {
            next.level = clamp(next.level + 1, 1, next.config.levelMax);
          }
        } else {
          next.streak = 0;
          const acc = computeAccuracy(next.totals);
          if (next.totals.played >= 12 && acc < 0.45) {
            next.level = clamp(next.level - 1, 1, next.config.levelMax);
          }
        }

        next.history.push({
          ts: now(),
          op: question.op,
          a: question.a,
          b: question.b,
          correct,
          answerTimeMs,
          timedOut: Boolean(timedOut),
          value
        });

        updateRewards(next);
        updatedSnapshot = next;
        return next;
      });

      sessionStatsRef.current.played += 1;
      if (correct) {
        sessionStatsRef.current.correct += 1;
      }

      const tone = correct ? 'good' : 'bad';
      setToastTone(tone);
      setToast(correct ? pickPositive() : pickEncouraging());

      if (correct) {
        setAnswerReveal('');
        setSparkle(true);
        setTrackedTimeout(() => setSparkle(false), 520);
        triggerFireworkFx();
      } else {
        setAnswerReveal(`= ${question.answer}`);
        triggerFlashFx();
      }

      playTone({ on: state.config.soundOn, type: tone });
      setTrackedTimeout(() => focusInput(), 0);

      if (sessionIndex >= SESSION_TOTAL) {
        setIsFinished(true);
        setAnswer('');
        setAnswerReveal('');
        setSparkle(false);
        setToastTone('good');
        setToast('Bravo ! Partie terminée.');
        const statsSnapshot = { ...sessionStatsRef.current };
        setCelebrationData({ correct: statsSnapshot.correct, total: statsSnapshot.played });
        setShowCelebration(true);
        setTrackedTimeout(() => {
          setShowCelebration(false);
          navigate('/progress');
        }, CELEBRATION_DURATION_MS + 200);
        return;
      }

      setTrackedTimeout(() => {
        setSessionIndex((prev) => prev + 1);
        setQuestion(pickNextQuestion(updatedSnapshot, seenCorrectRef.current, question));
      }, correct ? 550 : 2500);
    },
    [answer, focusInput, isFinished, navigate, question, sessionIndex, setState, state.config.soundOn, stopTimers]
  );

  const submitAnswerRef = useRef(submitAnswer);
  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  }, [submitAnswer]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, []);

  useEffect(() => {
    timeLimitRef.current = timeLimitMs;
  }, [timeLimitMs]);

  useEffect(() => {
    if (isFinished) return undefined;
    answeredRef.current = false;
    startedAtRef.current = now();
    setAnswer('');
    setAnswerReveal('');
    setSparkle(false);
    const currentLimit = timeLimitRef.current;
    setToast(`Tu as ${formatMs(currentLimit)} pour répondre.`);
    setToastTone('');

    updateProgressFill(1);
    const tick = () => {
      const elapsed = now() - startedAtRef.current;
      const remainingRatio = clamp(1 - elapsed / currentLimit, 0, 1);
      updateProgressFill(remainingRatio);
      if (elapsed < currentLimit && !answeredRef.current) {
        progressRafRef.current = requestAnimationFrame(tick);
      }
    };
    progressRafRef.current = requestAnimationFrame(tick);

    timerIdRef.current = window.setTimeout(() => {
      submitAnswerRef.current({ timedOut: true });
    }, currentLimit);

    focusInput();
    return () => {
      stopTimers();
    };
  }, [focusInput, isFinished, question, stopTimers]);

  useEffect(() => () => {
    stopTimers();
    clearTrackedTimeouts();
    stopFx();
  }, [clearTrackedTimeouts, stopTimers]);

  useEffect(() => {
    resetSessionStats();
    return () => resetSessionStats();
  }, [resetSessionStats]);

  const handleFormSubmit = useCallback(
    (event) => {
      event.preventDefault();
      submitAnswer({ timedOut: false });
    },
    [submitAnswer]
  );

  const handleQuit = useCallback(() => {
    stopTimers();
    clearTrackedTimeouts();
    stopFx();
    navigate('/');
  }, [clearTrackedTimeouts, navigate, stopTimers]);

  return (
    <Layout disableNav={isFinished}>
      <div className="play-overlay" role="dialog" aria-modal="true" aria-label="Partie en cours">
        <div className="play-overlay-backdrop" aria-hidden="true" />
        <div className="play-overlay-card">
          <button type="button" className="play-overlay-close" aria-label="Quitter la partie" onClick={handleQuit}>
            <span aria-hidden="true">×</span>
          </button>
          <div className="grid">
            <div className={`card sparkle ${sparkle ? 'on' : ''}`} tabIndex={-1}>
              <div className="card-inner grid">
            <div className="sub">Mode: {opLabel(state.operation)} • Une seule question. Pas de stress !</div>
            <div className="badge session-counter">
              {isFinished ? 'Terminé !' : `Question ${sessionIndex} / ${SESSION_TOTAL}`}
            </div>
            <div className="question-line">
              <div className="math">{`${question.a} ${opSymbol(question.op)} ${question.b}`}</div>
              <div className={`answer-reveal ${answerReveal ? 'show' : ''}`}>{answerReveal}</div>
            </div>
            <div className="feedback-slot">
              <div className={`toast ${toastTone}`.trim()}>{toast}</div>
            </div>
            <div className="progress">
              <div ref={progressFillRef} className="progress-fill" style={{ transform: 'scaleX(1)' }} />
            </div>
            <form className="answer-form" onSubmit={handleFormSubmit}>
              <input
                ref={inputRef}
                className="input"
                value={answer}
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
              </div>
            </div>
          </div>
        </div>
      </div>
      <CelebrationShow data={celebrationData} visible={showCelebration} />
    </Layout>
  );
}
