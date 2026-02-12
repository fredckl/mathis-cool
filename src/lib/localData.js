export function exportLocalStorage() {
  if (typeof window === 'undefined') return;
  if (!window.localStorage) return;

  const data = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    data[key] = window.localStorage.getItem(key);
  }

  const payload = {
    meta: {
      app: 'Mathis Cool',
      exportedAt: new Date().toISOString()
    },
    data
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mathis-cool-localstorage-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function clearUserCacheAndReload() {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }

    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignore
  }

  window.location.reload();
}

export async function importLocalStorageFromFile(file) {
  if (!file) return;
  const text = await file.text();
  const parsed = JSON.parse(text);

  const { data } = parsed || {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid import format');
  }

  const ok = window.confirm('Importer ces données va remplacer TOUTES les données locales (localStorage) sur cet appareil. Continuer ?');
  if (!ok) return;

  window.localStorage.clear();
  for (const [k, v] of Object.entries(data)) {
    if (typeof k !== 'string') continue;
    if (v === null || v === undefined) continue;
    window.localStorage.setItem(k, String(v));
  }
}
