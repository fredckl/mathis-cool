import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Layout from '../components/Layout.jsx';
import {
  CHALLENGE_SETTINGS,
  DEFAULT_CONFIG,
  DEFAULT_STATE,
  MIN_ALLOWED_MIN_TIME_MS,
  STORAGE_KEY
} from '../constants.js';
import { useAppState } from '../state/AppContext.jsx';
import { clamp } from '../lib/math.js';
import { clone, sanitizeChallengeCap } from '../lib/storage.js';
import { clearUserCacheAndReload, exportLocalStorage, importLocalStorageFromFile } from '../lib/localData.js';
import { computeAccuracy, formatMs } from '../lib/gameLogic.js';

const MAX_TIME_MS = 120_000;
const MAX_MIN_TIME_MS = 60_000;
const MAX_CAP = 999;

function buildForm(config = DEFAULT_CONFIG) {
  return {
    theme: config.theme === 'dark' ? 'dark' : 'light',
    maxAdd: String(config.maxAdd ?? DEFAULT_CONFIG.maxAdd),
    maxSub: String(config.maxSub ?? DEFAULT_CONFIG.maxSub),
    maxMul: String(config.maxMul ?? DEFAULT_CONFIG.maxMul),
    maxDiv: String(config.maxDiv ?? DEFAULT_CONFIG.maxDiv),
    minTimeSec: (Number(config.minTimeMs ?? DEFAULT_CONFIG.minTimeMs) / 1000).toFixed(1),
    startTimeSec: (Number(config.startTimeMs ?? DEFAULT_CONFIG.startTimeMs) / 1000).toFixed(1),
    challengeDurationSec: String(config.challengeDurationSec ?? DEFAULT_CONFIG.challengeDurationSec)
  };
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { state, setState } = useAppState();
  const [form, setForm] = useState(() => buildForm(state.config));
  const [feedback, setFeedback] = useState('');
  const importInputRef = useRef(null);

  useEffect(() => {
    setForm(buildForm(state.config));
  }, [state.config]);

  const handleInputChange = useCallback((field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleThemeChange = useCallback(
    (theme) => {
      setForm((prev) => ({ ...prev, theme }));
      setState((prev) => {
        const next = clone(prev);
        next.config.theme = theme === 'dark' ? 'dark' : 'light';
        return next;
      });
    },
    [setState]
  );

  const parseFloatSafe = (value) => {
    if (typeof value !== 'string') return Number(value);
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const handleSave = useCallback(
    (event) => {
      event.preventDefault();
      const minSec = parseFloatSafe(form.minTimeSec);
      const startSec = parseFloatSafe(form.startTimeSec);
      const challengeSec = parseFloatSafe(form.challengeDurationSec);
      const caps = ['maxAdd', 'maxSub', 'maxMul', 'maxDiv'].reduce((acc, key) => {
        acc[key] = parseFloatSafe(form[key]);
        return acc;
      }, {});

      if (!Number.isFinite(minSec) || !Number.isFinite(startSec)) {
        setFeedback('Merci de vérifier les valeurs de temps.');
        return;
      }

      setState((prev) => {
        const next = clone(prev);
        const minMs = Math.round(clamp(minSec * 1000, MIN_ALLOWED_MIN_TIME_MS, MAX_MIN_TIME_MS));
        const startMs = Math.round(clamp(startSec * 1000, minMs, MAX_TIME_MS));

        next.config.minTimeMs = minMs;
        next.config.startTimeMs = startMs;
        next.config.maxAdd = sanitizeChallengeCap(caps.maxAdd, DEFAULT_CONFIG.maxAdd);
        next.config.maxSub = sanitizeChallengeCap(caps.maxSub, DEFAULT_CONFIG.maxSub);
        next.config.maxMul = sanitizeChallengeCap(caps.maxMul, DEFAULT_CONFIG.maxMul);
        next.config.maxDiv = sanitizeChallengeCap(caps.maxDiv, DEFAULT_CONFIG.maxDiv);
        if (Number.isFinite(challengeSec)) {
          next.config.challengeDurationSec = clamp(
            Math.round(challengeSec),
            CHALLENGE_SETTINGS.minDurationSec,
            CHALLENGE_SETTINGS.maxDurationSec
          );
        }
        setFeedback('Réglages enregistrés !');
        return next;
      });
    },
    [form, parseFloatSafe, setState]
  );

  const handleReset = useCallback(() => {
    const ok = window.confirm('Réinitialiser supprimera toutes les données locales. Continuer ?');
    if (!ok) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setState(() => clone(DEFAULT_STATE));
    navigate('/');
  }, [navigate, setState]);

  const handleExport = useCallback(() => {
    try {
      exportLocalStorage();
    } catch (error) {
      console.error(error);
      window.alert("Impossible d'exporter les données.");
    }
  }, []);

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    try {
      await importLocalStorageFromFile(file);
      window.location.reload();
    } catch (error) {
      console.error(error);
      window.alert("Impossible d'importer ce fichier.");
    } finally {
      event.target.value = '';
    }
  }, []);

  const accuracyPct = Math.round(computeAccuracy(state.totals) * 100);

  const titleRight = (
    <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Retour</button>
  );

  return (
    <Layout titleRight={titleRight}>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-inner grid">
            <div className="kids-big">Réglages</div>
            <div className="sub">Réservé aux parents (ou avec un adulte).</div>
            <div className="sub">Thème</div>
            <div className="btn-row">
              <button
                type="button"
                className={`btn ${form.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleThemeChange('dark')}
              >
                Sombre
              </button>
              <button
                type="button"
                className={`btn ${form.theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleThemeChange('light')}
              >
                Clair
              </button>
            </div>

            <div className="sub">Nombres max (plafonds)</div>
            <label className="sub" htmlFor="cap-add">Addition</label>
            <input
              id="cap-add"
              className="input"
              type="number"
              min="1"
              max={MAX_CAP}
              step="1"
              value={form.maxAdd}
              onChange={handleInputChange('maxAdd')}
            />
            <label className="sub" htmlFor="cap-sub">Soustraction</label>
            <input
              id="cap-sub"
              className="input"
              type="number"
              min="1"
              max={MAX_CAP}
              step="1"
              value={form.maxSub}
              onChange={handleInputChange('maxSub')}
            />
            <label className="sub" htmlFor="cap-mul">Multiplication</label>
            <input
              id="cap-mul"
              className="input"
              type="number"
              min="1"
              max={MAX_CAP}
              step="1"
              value={form.maxMul}
              onChange={handleInputChange('maxMul')}
            />
            <label className="sub" htmlFor="cap-div">Division</label>
            <input
              id="cap-div"
              className="input"
              type="number"
              min="1"
              max={MAX_CAP}
              step="1"
              value={form.maxDiv}
              onChange={handleInputChange('maxDiv')}
            />

            <div className="stats">
              <div className="stat">
                <div className="k">Questions</div>
                <div className="v">{state.totals.played}</div>
              </div>
              <div className="stat">
                <div className="k">Précision</div>
                <div className="v">{accuracyPct}%</div>
              </div>
              <div className="stat">
                <div className="k">Temps départ</div>
                <div className="v">{formatMs(state.config.startTimeMs)}</div>
              </div>
              <div className="stat">
                <div className="k">Temps minimum</div>
                <div className="v">{formatMs(state.config.minTimeMs)}</div>
              </div>
            </div>
            <div className="toast">Astuce: tu peux activer/désactiver les sons en haut.</div>
          </div>
        </div>

        <div className="card">
          <div className="card-inner grid">
            <div className="sub">Personnalisation du temps (secondes)</div>
            <label className="sub" htmlFor="min-time">Temps minimum</label>
            <input
              id="min-time"
              className="input"
              type="number"
              step="0.1"
              min={(MIN_ALLOWED_MIN_TIME_MS / 1000).toFixed(1)}
              value={form.minTimeSec}
              onChange={handleInputChange('minTimeSec')}
            />
            <label className="sub" htmlFor="start-time">Temps de départ</label>
            <input
              id="start-time"
              className="input"
              type="number"
              step="0.1"
              min={form.minTimeSec}
              value={form.startTimeSec}
              onChange={handleInputChange('startTimeSec')}
            />
            <label className="sub" htmlFor="challenge-duration">Mode Challenge (durée en secondes)</label>
            <input
              id="challenge-duration"
              className="input"
              type="number"
              min={CHALLENGE_SETTINGS.minDurationSec}
              max={CHALLENGE_SETTINGS.maxDurationSec}
              step="1"
              value={form.challengeDurationSec}
              onChange={handleInputChange('challengeDurationSec')}
            />
            <div className="sub">
              Entre {CHALLENGE_SETTINGS.minDurationSec}s et {CHALLENGE_SETTINGS.maxDurationSec}s.
            </div>

            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={clearUserCacheAndReload}>
                Vider le cache
              </button>
              <button type="button" className="btn btn-danger" onClick={handleReset}>
                Réinitialiser
              </button>
            </div>
            {feedback && <div className="toast">{feedback}</div>}
            <div className="sub">
              Contraintes : minimum ≥ {(MIN_ALLOWED_MIN_TIME_MS / 1000).toFixed(1)}s et départ ≥ minimum.
            </div>

            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={handleExport}>
                Exporter
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleImportClick}>
                Importer
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={handleImportChange}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
