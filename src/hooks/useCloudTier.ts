import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCloudTeamRatings, idleHealth, isCloudTierConfigured, probeCloudTier,
  type CloudTeamRating, type CloudTierHealth } from '../utils/supabaseTier';
import type { League } from '../types/winmix';
export interface CloudTierState {
  health: CloudTierHealth; configured: boolean; ratings: CloudTeamRating[]; loadingRatings: boolean;
  refresh: () => Promise<void>; retry: () => Promise<void>; loadRatings: (league: League) => Promise<void>;
}
export function useCloudTier(): CloudTierState {
  const [health, setHealth] = useState<CloudTierHealth>(() => idleHealth());
  const [ratings, setRatings] = useState<CloudTeamRating[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const mounted = useRef(false), degraded = useRef(false), healthVersion = useRef(0), ratingsVersion = useRef(0);
  const check = useCallback(async (force: boolean) => {
    if (!force && degraded.current) return;
    const version = ++healthVersion.current;
    if (force) { degraded.current = false; ++ratingsVersion.current; setRatings([]); setLoadingRatings(false); }
    setHealth(idleHealth());
    const next = await probeCloudTier();
    if (!mounted.current || version !== healthVersion.current) return;
    degraded.current = next.degraded; setHealth(next);
  }, []);
  const refresh = useCallback(() => check(false), [check]);
  const retry = useCallback(() => check(true), [check]);
  useEffect(() => {
    mounted.current = true; void refresh();
    return () => { mounted.current = false; ++healthVersion.current; ++ratingsVersion.current; };
  }, [refresh]);
  const loadRatings = useCallback(async (league: League) => {
    if (degraded.current || !isCloudTierConfigured()) return;
    const version = ++ratingsVersion.current;
    setRatings([]); setLoadingRatings(true);
    try {
      const rows = await fetchCloudTeamRatings(league);
      if (mounted.current && version === ratingsVersion.current) setRatings(rows);
    } catch (error) {
      if (!mounted.current || version !== ratingsVersion.current) return;
      ++healthVersion.current; degraded.current = true; setRatings([]);
      setHealth({ status: 'degraded', degraded: true, lastError: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString() });
    } finally {
      if (mounted.current && version === ratingsVersion.current) setLoadingRatings(false);
    }
  }, []);
  return { health, configured: isCloudTierConfigured(), ratings, loadingRatings, refresh, retry, loadRatings };
}
