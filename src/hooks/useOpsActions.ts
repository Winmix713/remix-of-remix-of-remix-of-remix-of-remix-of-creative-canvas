import { useCallback, useMemo, useState } from 'react';
import { useCloudTierContext } from '../contexts/CloudTierContext';
import { useDialogs } from '../contexts/DialogContext';
import { useWinmix } from '../contexts/WinmixContext';
import { computeAutoTeamWeights, weightDelta } from '../utils/autoWeights';
import { DEFAULT_WEIGHT } from '../utils/constants';
import { checkDirectedFixtureMatrix } from '../utils/fixtureMatrix';
import { ingestSeasonsToCloud, type IngestResult } from '../utils/supabaseTier';
import type { HistoryScope } from '../types/winmix';

type AutoWeightMap = ReturnType<typeof computeAutoTeamWeights>;
type AutoWeight = AutoWeightMap[string];

export interface WeightRow {
  key: string;
  displayName: string;
  current: number;
  rec: AutoWeight | null;
  /** Signed difference between the recommendation and the active weight. */
  delta: number;
  /** True while the row still holds an automatically applied value. */
  auto: boolean;
}

export interface CrossCheckRow {
  canonicalKey: string;
  displayName: string;
  sqlNetHome: number;
  sqlNetAway: number;
  tsNetHome: number | null;
  tsNetAway: number | null;
  agrees: boolean;
}

/** Divergence above this between the SQL view and the TS walk is a red flag. */
export const CROSSCHECK_TOLERANCE = 0.01;

/**
 * Every expensive, hard-to-reverse operation of the ops dashboard, with its
 * confirmation and its undo snapshot. Extracted from the page so the surface
 * is composition only.
 */
export function useOpsActions() {
  const {
    currentLeague,
    leagueMatches,
    seasons,
    teamWeights,
    teamAliasMap,
    setWeight,
    saveWeights,
    settings,
    updateSettings,
    rebuildFromScratch
  } = useWinmix();
  const dialogs = useDialogs();
  const cloud = useCloudTierContext();

  /**
   * PHASE 3 invariant — an applied recommendation must stay reversible. The
   * pre-apply weights are snapshotted here so "Visszaállítás" restores the
   * operator's hand-tuned values exactly, including their provenance.
   */
  const [preApplySnapshot, setPreApplySnapshot] = useState<Record<string, number> | null>(null);
  const [autoAppliedKeys, setAutoAppliedKeys] = useState<Set<string>>(() => new Set());
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);

  const aliases = teamAliasMap[currentLeague] ?? {};
  const activeWeights = teamWeights[currentLeague] ?? {};

  const auto = useMemo(
    () => computeAutoTeamWeights(leagueMatches, currentLeague),
    [leagueMatches, currentLeague]
  );

  const fixtureReport = useMemo(
    () => checkDirectedFixtureMatrix(leagueMatches, aliases),
    [leagueMatches, aliases]
  );

  const rows = useMemo<WeightRow[]>(
    () =>
    Object.keys(aliases).
    map((key) => {
      const current = activeWeights[key] ?? DEFAULT_WEIGHT;
      const rec = auto[key] ?? null;
      return {
        key,
        displayName: aliases[key] ?? key,
        current,
        rec,
        delta: rec ? weightDelta(current, rec.recommendedWeight) : 0,
        auto: autoAppliedKeys.has(key)
      };
    }).
    sort((a, b) => a.displayName.localeCompare(b.displayName, 'hu')),
    [aliases, activeWeights, auto, autoAppliedKeys]
  );

  const applyAutoWeights = useCallback(async () => {
    const affected = rows.filter((r) => r.rec !== null);
    if (affected.length === 0) {
      await dialogs.alert(
        'Nincs elegendő lejátszott mérkőzés az empirikus súlyok származtatásához.'
      );
      return;
    }
    const ok = await dialogs.confirm(
      `Ez ${affected.length} csapat súlyát írja felül a(z) ${currentLeague} ligában empirikusan ` +
      `származtatott értékekkel. A kézi finomhangolásaid felülíródnak (a művelet egy ` +
      `kattintással visszaállítható). Folytatod?`
    );
    if (!ok) return;

    setPreApplySnapshot({ ...activeWeights });
    affected.forEach((r) => {
      if (r.rec) setWeight(currentLeague, r.key, r.rec.recommendedWeight);
    });
    setAutoAppliedKeys(new Set(affected.map((r) => r.key)));
    await saveWeights();
  }, [rows, dialogs, currentLeague, activeWeights, setWeight, saveWeights]);

  const revertAutoWeights = useCallback(async () => {
    if (!preApplySnapshot) return;
    const ok = await dialogs.confirm(
      'Visszaállítod a súlyokat az automatikus alkalmazás előtti állapotra?'
    );
    if (!ok) return;
    Object.keys(aliases).forEach((key) => {
      setWeight(currentLeague, key, preApplySnapshot[key] ?? DEFAULT_WEIGHT);
    });
    setPreApplySnapshot(null);
    setAutoAppliedKeys(new Set());
    await saveWeights();
  }, [preApplySnapshot, dialogs, aliases, setWeight, currentLeague, saveWeights]);

  const changeHistoryScope = useCallback(
    async (scope: HistoryScope) => {
      if (scope === settings.historyScope) return;
      const ok = await dialogs.confirm(
        'A történeti hatókör módosítása minden liga teljes újraszámítását kényszeríti ' +
        '(a checkpointok érvénytelenné válnak). Folytatod?'
      );
      if (!ok) return;
      await updateSettings({ historyScope: scope });
    },
    [settings.historyScope, dialogs, updateSettings]
  );

  const fullRebuild = useCallback(async () => {
    const ok = await dialogs.confirm(
      'Minden checkpoint eldobása és teljes historikus újraszámítás mindkét ligára. ' +
      'Az adatok nem sérülnek, de a művelet hosszú lehet. Folytatod?'
    );
    if (!ok) return;
    await rebuildFromScratch();
  }, [dialogs, rebuildFromScratch]);

  const crossCheck = useMemo<CrossCheckRow[]>(() => {
    if (cloud.ratings.length === 0) return [];
    return cloud.ratings.
    map((r) => {
      const local = auto[r.canonicalKey] ?? null;
      const worst = local ?
      Math.max(Math.abs(local.netHome - r.netHome), Math.abs(local.netAway - r.netAway)) :
      Number.POSITIVE_INFINITY;
      return {
        canonicalKey: r.canonicalKey,
        displayName: r.displayName,
        sqlNetHome: r.netHome,
        sqlNetAway: r.netAway,
        tsNetHome: local ? local.netHome : null,
        tsNetAway: local ? local.netAway : null,
        agrees: local !== null && worst <= CROSSCHECK_TOLERANCE
      };
    }).
    sort((a, b) => a.displayName.localeCompare(b.displayName, 'hu'));
  }, [cloud.ratings, auto]);

  const ingestToCloud = useCallback(async () => {
    if (seasons.length === 0) {
      await dialogs.alert('Nincsenek betöltött szezonok a feltöltéshez.');
      return;
    }
    const ok = await dialogs.confirm(
      `${seasons.length} szezon adatai feltöltése a felhő adatbázisba? ` +
      `A művelet idempotens — a már létező szezonok biztonságosan frissítve lesznek.`
    );
    if (!ok) return;

    setIngesting(true);
    setIngestResult(null);
    try {
      const result = await ingestSeasonsToCloud({
        seasons: seasons.map((s) => ({
          id: s.id,
          league: s.league,
          seasonIndex: s.seasonIndex,
          name: s.name,
          fileName: s.fileName,
          createdAt: s.createdAt,
          contentHash: s.contentHash,
          orderMode: s.orderMode ?? 'chronological',
          matches: s.matches.map((m) => ({
            match_no: m.match_no,
            date: m.date,
            kickoffIso: m.kickoffIso ?? null,
            rowIndex: m.rowIndex,
            sourceFileId: m.sourceFileId ?? null,
            home_team: m.home_team,
            away_team: m.away_team,
            ht_home_score: m.ht_home_score,
            ht_away_score: m.ht_away_score,
            home_score: m.home_score,
            away_score: m.away_score,
          })),
        })),
        teamWeights,
        teamAliasMap,
      });
      setIngestResult(result);
      if (result.success) {
        await cloud.loadRatings(currentLeague);
      }
    } finally {
      setIngesting(false);
    }
  }, [seasons, teamWeights, teamAliasMap, dialogs, cloud, currentLeague]);

  return {
    auto,
    rows,
    fixtureReport,
    crossCheck,
    canRevert: preApplySnapshot !== null,
    applyAutoWeights,
    revertAutoWeights,
    changeHistoryScope,
    fullRebuild,
    saveWeights,
    setWeight,
    ingestToCloud,
    ingesting,
    ingestResult
  };
}