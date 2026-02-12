export function playTone({ on, type }) {
  if (!on) return;
  if (typeof window === 'undefined') return;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'good') {
      osc.type = 'triangle';
      osc.frequency.value = 740;
      gain.gain.value = 0.06;
    } else {
      osc.type = 'sine';
      osc.frequency.value = 220;
      gain.gain.value = 0.05;
    }

    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);

    osc.start();
    osc.stop(t0 + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    // ignore
  }
}
