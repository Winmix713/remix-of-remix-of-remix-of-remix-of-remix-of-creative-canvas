import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchCloudTeamRatings,
  idleHealth,
  isCloudTierConfigured,
  probeCloudTier,
  type CloudTeamRating,
  type CloudTierHealth } from
'../utils/supabaseTier';
import type { League } from '../types/winmix';

export interface CloudTierState {
  health: CloudTierHealth;
  configured: boolean;
  ratings: CloudTeamRating[];
  loadingRatings: boolean;
  /** Re-probe reachability. Safe to call when unconfigured (no-op result). */
  refresh: () => Promise<void>;
  /** Clears the sticky degrade and probes again (after fixing credentials). */
  retry: () => Promise<void>;
  /** Advisory read of `view_team_ratings`; degrades instead of throwing. */
  loadRatings: (league: League) => Promise<void>;
}

/**
 * The cloud tier lives entirely outside the pipeline: it probes reachability,
 * exposes an advisory ratings read, and degrades to local-only for the rest of
 * the session on the first failure. Nothing here can block or break the app.
 */
export function useCloudTier(): CloudTierState {
  const [health, setHealth] = useState<CloudTierHealth>(() => idleHealth());
  const [ratings, setRatings] = useState<CloudTeamRating[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const degradedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (degradedRef.current) return;
    const next = await probeCloudTier();
    if (next.degraded) degradedRef.current = true;
    setHealth(next);
  }, []);

  const retry = useCallback(async () => {
    degradedRef.current = false;
    setHealth(idleHealth());
    const next = await probeCloudTier();
    if (next.degraded) degradedRef.current = true;
    setHealth(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadRatings = useCallback(async (league: League) => {
    if (degradedRef.current || !isCloudTierConfigured()) return;
    setLoadingRatings(true);
    try {
      setRatings(await fetchCloudTeamRatings(league));
    } catch (e) {
      degradedRef.current = true;
      setRatings([]);
      setHealth({
        status: 'degraded',
        degraded: true,
        lastError: e instanceof Error ? e.message : String(e),
        checkedAt: new Date().toISOString()
      });
    } finally {
      setLoadingRatings(false);
    }
  }, []);

  return {
    health,
    configured: isCloudTierConfigured(),
    ratings,
    loadingRatings,
    refresh,
    retry,
    loadRatings
  };
}