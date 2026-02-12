import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { APP_NAME, APP_VERSION } from '../constants.js';
import { useAppState } from '../state/AppContext.jsx';
import { clone } from '../lib/storage.js';

function LevelStarsBadge({ level, stars }) {
  return (
    <div className="badge badge-2l">
      <div className="badge-top">Niveau {level}</div>
      <div className="badge-bottom">⭐ {stars}</div>
    </div>
  );
}

export default function Layout({ titleRight, disableNav = false, children }) {
  const navigate = useNavigate();
  const { state, setState } = useAppState();

  const handleSoundToggle = () => {
    setState((prev) => {
      const next = clone(prev);
      next.config.soundOn = !next.config.soundOn;
      return next;
    });
  };

  const progressButtonProps = disableNav
    ? { 'aria-disabled': 'true', disabled: true }
    : { 'aria-disabled': 'false', onClick: () => navigate('/progress') };

  const settingsButtonProps = disableNav
    ? { 'aria-disabled': 'true', disabled: true }
    : { 'aria-disabled': 'false', onClick: () => navigate('/settings') };

  return (
    <div className="shell">
      <div className="header">
        <div className="brand">
          <div className="logo" aria-hidden="true" />
          <div>
            <div className="h1">{APP_NAME}</div>
            <div className="sub">Jeu de calcul mental</div>
          </div>
        </div>
        <div className="btn-row header-controls">
          {titleRight || (
            <LevelStarsBadge level={state.level} stars={state.rewards.stars} />
          )}
          <button className="btn btn-secondary" aria-label="Mes progrès" title="Mes progrès" {...progressButtonProps}>
            <span>Mes progrès</span>
          </button>
          <div className="toggle" role="button" tabIndex={0} onClick={handleSoundToggle} onKeyDown={(e) => (e.key === 'Enter' ? handleSoundToggle() : null)}>
            <div className={`switch ${state.config.soundOn ? 'on' : ''}`} />
            <div className="sub">Sons: {state.config.soundOn ? 'ON' : 'OFF'}</div>
          </div>
          <button className="btn btn-secondary" aria-label="Réglages" title="Réglages" {...settingsButtonProps}>
            <span>Réglages</span>
          </button>
        </div>
      </div>

      {children}

      <div className="footer">
        <div>Hors ligne • Sans pub • Données locales • v{APP_VERSION}</div>
        <Link to="/">Accueil</Link>
      </div>
    </div>
  );
}
