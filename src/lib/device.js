function detectDevice() {
  const ua = String(navigator?.userAgent || '');
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const isCoarsePointer = hasMatchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
  const isTouch = isCoarsePointer || (typeof window !== 'undefined' && 'ontouchstart' in window);

  let kind = 'desktop';
  if (isTouch || isIOS || isAndroid) kind = 'mobile';

  return {
    kind,
    isTouch,
    isIOS,
    isAndroid,
    shouldAvoidNativeKeyboard: isTouch || isIOS || isAndroid
  };
}

export const DEVICE = typeof window !== 'undefined'
  ? detectDevice()
  : { kind: 'desktop', shouldAvoidNativeKeyboard: false };
