import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { applyThemeFromState, clone, loadState, saveState } from '../lib/storage.js';
import { registerServiceWorker } from '../lib/serviceWorker.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(() => loadState());

  useEffect(() => {
    saveState(state);
    applyThemeFromState(state);
  }, [state]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  const updateState = useCallback((updater) => {
    setState((prev) => {
      const base = clone(prev);
      const next = typeof updater === 'function' ? updater(base) : updater;
      return clone(next);
    });
  }, []);

  const value = useMemo(() => ({ state, setState: updateState }), [state, updateState]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return ctx;
}
