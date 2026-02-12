import React from 'react';
import { useNavigate } from 'react-router-dom';

import Layout from '../components/Layout.jsx';
import { useAppState } from '../state/AppContext.jsx';
import { clampChallengeDurationSec, opLabel, opSymbol } from '../lib/gameLogic.js';
import { clone } from '../lib/storage.js';

const OPERATIONS = ['add', 'sub', 'mul', 'div'];

function OperationTile({ op, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`op-tile ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(op)}
      aria-label={opLabel(op)}
    >
      <div className="op-icon">{opSymbol(op)}</div>
      <div className="op-label">{opLabel(op)}</div>
    </button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { state, setState } = useAppState();
  const challengeDurationSec = clampChallengeDurationSec(state.config.challengeDurationSec);

  const handleSelectOperation = (operation) => {
    setState((prev) => {
      const next = clone(prev);
      next.operation = operation;
      return next;
    });
  };

  return (
    <Layout>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-inner grid">
            <div className="kids-big">Prêt à jouer ?</div>
            <div className="sub">Une question à la fois. Tu réponds vite, et tu progresses !</div>
            <div className="sub">Choisis ton jeu :</div>
            <div className="op-grid">
              {OPERATIONS.map((op) => (
                <OperationTile
                  key={op}
                  op={op}
                  selected={state.operation === op}
                  onSelect={handleSelectOperation}
                />
              ))}
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-primary btn-full" onClick={() => navigate('/play')}>
                Jouer
              </button>
            </div>
          </div>
        </div>

        <div className="card challenge-card">
          <div className="card-inner grid">
            <div className="kids-big">Mode Challenge</div>
            <div className="sub">Réponds à une chaîne de calculs le plus vite possible.</div>
            <div className="sub">Durée: {challengeDurationSec}s (réglable).</div>
            <div className="sub">Addition, soustraction, multiplication et division s’enchaînent.</div>
            <div className="btn-row">
              <button type="button" className="btn btn-primary btn-full" onClick={() => navigate('/challenge')}>
                Lancer le challenge
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
