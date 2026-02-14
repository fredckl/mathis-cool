import React from 'react';

export const CELEBRATION_DURATION_MS = 5000;

const PRESETS = [
  {
    minRatio: 0.9,
    title: 'Explosion de neurones !',
    sub: {
      play: 'Les nombres te réclament un autographe.',
      challenge: 'Les chronos veulent ta signature !'
    },
    emojis: ['🧠', '🚀', '💃', '🥳']
  },
  {
    minRatio: 0.7,
    title: 'Rire garanti !',
    sub: {
      play: 'Les chiffres te regardent avec respect (et un peu de peur).',
      challenge: 'Même le chrono rigole sous ta vitesse.'
    },
    emojis: ['😂', '🤸‍♂️', '🪩']
  },
  {
    minRatio: 0.5,
    title: 'Showtime !',
    sub: {
      play: 'Tes réponses déclenchent une ola numérique.',
      challenge: 'Tes neurones dansent sur la ligne d’arrivée.'
    },
    emojis: ['🤖', '🙌', '🎈']
  }
];

const DEFAULT_PRESET = {
  title: 'Club des mathlètes !',
  sub: {
    play: "Tu viens de faire rigoler les chiffres.",
    challenge: 'Le chrono est KO, recommence vite !'
  },
  emojis: ['🤓', '🎉', '🤣']
};

const DEFAULT_TIPS = {
  play: 'Prochaine mission dans 5 secondes… reste dans la danse !',
  challenge: '5 secondes de fiesta puis on relance le défi !'
};

function getCopy(ratio, flavor) {
  const preset = PRESETS.find((item) => ratio >= item.minRatio) || DEFAULT_PRESET;
  const sub = typeof preset.sub === 'string' ? preset.sub : preset.sub[flavor] || preset.sub.play;
  return {
    title: preset.title,
    sub,
    emojis: preset.emojis
  };
}

export function CelebrationShow({ data, visible, flavor = 'play', tip }) {
  if (!visible || !data) return null;
  const ratio = data.total > 0 ? data.correct / data.total : 0;
  const { title, sub, emojis } = getCopy(ratio, flavor);
  const tipText = tip || DEFAULT_TIPS[flavor] || DEFAULT_TIPS.play;

  return (
    <div className="celebration-overlay" role="status" aria-live="polite">
      <div className="celebration-card">
        <div className="celebration-title">{title}</div>
        <p className="celebration-sub">{sub}</p>
        <div className="celebration-score">
          <span>{data.correct}</span>
          <span>/</span>
          <span>{data.total}</span>
        </div>
        <div className="celebration-meter">
          <div
            className="celebration-meter-fill"
            style={{ transform: `scaleX(${Math.min(1, ratio)})` }}
          />
        </div>
        <div className="celebration-bubbles">
          {emojis.map((emoji, index) => (
            <span key={`${emoji}-${index}`} className="celebration-bubble" style={{ animationDelay: `${index * 0.35}s` }}>
              {emoji}
            </span>
          ))}
        </div>
        <div className="celebration-tip">{tipText}</div>
      </div>
    </div>
  );
}
