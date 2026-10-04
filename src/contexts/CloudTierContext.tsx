import React, { createContext, useContext } from 'react';
import { useCloudTier, type CloudTierState } from '../hooks/useCloudTier';

// HMR-stable context: on module reload the mounted provider would otherwise
// reference the old context instance and consumers would read `null`.
const GLOBAL_KEY = '__winmix_cloud_tier_context__';
const globalStore = globalThis as typeof globalThis & {
  [GLOBAL_KEY]?: React.Context<CloudTierState | null>;
};

const CloudTierContext: React.Context<CloudTierState | null> =
  globalStore[GLOBAL_KEY] ?? createContext<CloudTierState | null>(null);
globalStore[GLOBAL_KEY] = CloudTierContext;

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}

/**
 * The optional Supabase read tier. Deliberately a sibling of WinmixProvider,
 * not a dependency of it: if this provider never resolves, the app runs exactly
 * as it does today on local storage.
 */
export function CloudTierProvider({ children }: {children: React.ReactNode;}) {
  const value = useCloudTier();
  return <CloudTierContext.Provider value={value}>{children}</CloudTierContext.Provider>;
}

export function useCloudTierContext(): CloudTierState {
  const ctx = useContext(CloudTierContext);
  if (!ctx) throw new Error('useCloudTierContext must be used inside CloudTierProvider');
  return ctx;
}
