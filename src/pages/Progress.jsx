import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import Layout from '../components/Layout.jsx';
import { useAppState } from '../state/AppContext.jsx';
import { computeAccuracy, computeAvgTimeMs, formatMs } from '../lib/gameLogic.js';

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}

function ProgressRow({ label, value, max, detail }) {
  const pct = max ? Math.min(Math.max(value / max, 0), 1) : 0;
  const width = `${Math.round(pct * 100)}%`;
  return (
    <div className="progress-row">
      <div className="k">{label}</div>
      <div className="progress progress-meter">
        <div className="progress-fill" style={{ width }} />
        <div className="progress-label">{detail || `${value} / ${max}`}</div>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const navigate = useNavigate();
  const { state } = useAppState();
  const canvasRef = useRef(null);

  const accuracy = computeAccuracy(state.totals);
  const avgTime = computeAvgTimeMs(state.totals);
  const nextStarSteps = 5;
  const nextStarValue = state.totals.correct % nextStarSteps;
  const maxBadges = 6;

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
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

    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i += 1) {
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

    items.forEach((item, idx) => {
      const x = pad + idx * (barW + 4);
      const ratio = (item.answerTimeMs || 0) / maxT;
      const barHeight = Math.max(0.12, Math.min(1, ratio)) * h;
      const y = pad + (h - barHeight);
      ctx.fillStyle = item.correct ? 'rgba(34,197,94,0.92)' : 'rgba(245,158,11,0.92)';
      ctx.fillRect(x, y, barW, barHeight);
    });
  }, [state.history]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  const titleRight = (
    <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Retour</button>
  );

  return (
    <Layout titleRight={titleRight}>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-inner grid">
            <div className="kids-big">Mes progrès</div>
            <div className="stats">
              <Stat label="Questions" value={state.totals.played} />
              <Stat label="Bonnes" value={state.totals.correct} />
              <Stat label="Temps moyen" value={formatMs(avgTime)} />
              <Stat label="Niveau" value={state.level} />
            </div>
            <div className="toast">Précision: {Math.round(accuracy * 100)}% • Étoiles: {state.rewards.stars}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-inner grid">
            <div className="sub">Récompenses</div>
            <div className="toast">Étoiles: {state.rewards.stars}</div>
            <div className="toast">
              {state.rewards.badges.length ? `Badges: ${state.rewards.badges.length}` : 'Badges: aucun pour le moment'}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-inner grid">
            <div className="sub">Barres</div>
            <ProgressRow
              label="Précision"
              value={state.totals.correct}
              max={Math.max(1, state.totals.played)}
              detail={`${Math.round(accuracy * 100)}% (${state.totals.correct} / ${state.totals.played})`}
            />
            <ProgressRow
              label="Niveau"
              value={state.level}
              max={state.config.levelMax}
              detail={`${state.level} / ${state.config.levelMax}`}
            />
            <ProgressRow
              label="Prochaine étoile"
              value={nextStarValue}
              max={nextStarSteps}
              detail={`${nextStarValue} / ${nextStarSteps}`}
            />
            <ProgressRow
              label="Badges"
              value={state.rewards.badges.length}
              max={maxBadges}
              detail={`${state.rewards.badges.length} / ${maxBadges}`}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-inner grid">
            <div className="sub">Évolution (dernières 30 questions)</div>
            <div className="canvas-wrap">
              <canvas ref={canvasRef} width={820} height={170} />
            </div>
            <div className="sub">Vert = bonne réponse, Jaune = à retravailler</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
