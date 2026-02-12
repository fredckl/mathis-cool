let fireworkTimerId = null;
let flashTimerId = null;

function ensureFxLayers() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('[data-fx-firework]')) return;

  const firework = document.createElement('div');
  firework.className = 'fx-layer fx-firework';
  firework.setAttribute('aria-hidden', 'true');
  firework.dataset.fxFirework = '';

  const flash = document.createElement('div');
  flash.className = 'fx-layer fx-flash';
  flash.setAttribute('aria-hidden', 'true');
  flash.dataset.fxFlash = '';

  document.body.append(firework, flash);
}

export function triggerFireworkFx() {
  if (typeof document === 'undefined') return;
  ensureFxLayers();
  const layer = document.querySelector('[data-fx-firework]');
  if (!layer) return;
  layer.classList.remove('on');
  void layer.offsetWidth;
  layer.classList.add('on');
  if (fireworkTimerId) window.clearTimeout(fireworkTimerId);
  fireworkTimerId = window.setTimeout(() => {
    layer.classList.remove('on');
  }, 1200);
}

export function triggerFlashFx() {
  if (typeof document === 'undefined') return;
  ensureFxLayers();
  const layer = document.querySelector('[data-fx-flash]');
  if (!layer) return;
  layer.classList.remove('on');
  void layer.offsetWidth;
  layer.classList.add('on');
  if (flashTimerId) window.clearTimeout(flashTimerId);
  flashTimerId = window.setTimeout(() => {
    layer.classList.remove('on');
  }, 400);
}

export function stopFx() {
  if (fireworkTimerId) window.clearTimeout(fireworkTimerId);
  fireworkTimerId = null;
  if (flashTimerId) window.clearTimeout(flashTimerId);
  flashTimerId = null;

  try {
    const fireworkLayer = document.querySelector('[data-fx-firework]');
    if (fireworkLayer) fireworkLayer.classList.remove('on');
    const flashLayer = document.querySelector('[data-fx-flash]');
    if (flashLayer) flashLayer.classList.remove('on');
  } catch {
    // ignore
  }
}
