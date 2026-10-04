import React, { createContext, useContext } from 'react';
import { useWinmixEngine, type WinmixEngine } from '../hooks/useWinmixEngine';

// A context objektum HMR-stabil: ha ez a modul újratöltődik, a már felmountolt
// WinmixProvider a régi context példányra hivatkozna, a fogyasztók pedig `null`-t
// olvasnának ("useWinmix must be used inside a WinmixProvider"). Ezért a példányt
// globális singletonként tartjuk, és hot update esetén teljes reloadot kérünk.
const GLOBAL_KEY = '__winmix_context__';
const globalStore = globalThis as typeof globalThis & {
  [GLOBAL_KEY]?: React.Context<WinmixEngine | null>;
};

const WinmixContext: React.Context<WinmixEngine | null> =
  globalStore[GLOBAL_KEY] ?? createContext<WinmixEngine | null>(null);
globalStore[GLOBAL_KEY] = WinmixContext;

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}

export function WinmixProvider({ children }: {children: React.ReactNode;}) {
  const engine = useWinmixEngine();
  return <WinmixContext.Provider value={engine}>{children}</WinmixContext.Provider>;
}

export function useWinmix(): WinmixEngine {
  const ctx = useContext(WinmixContext);
  if (!ctx) throw new Error('useWinmix must be used inside a WinmixProvider');
  return ctx;
}
