import React, { createContext, useContext } from 'react';
import { useCloudTier, type CloudTierState } from '../hooks/useCloudTier';

const CloudTierContext = createContext<CloudTierState | null>(null);

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