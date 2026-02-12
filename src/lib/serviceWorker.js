let didRegisterServiceWorker = false;

export function registerServiceWorker() {
  if (didRegisterServiceWorker) return;
  didRegisterServiceWorker = true;

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      try {
        reg.update();
      } catch {
        // ignore
      }

      if (reg.waiting) {
        try {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch {
          // ignore
        }
      }
    })
    .catch(() => {
      // ignore
    });
}
