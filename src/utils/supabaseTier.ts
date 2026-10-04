/**
 * PHASE 5 — Supabase as an ADDITIONAL, read-only, opt-in tier.
 *
 * Hard rules encoded here:
 *  • Only the ANON key is ever read from the environment. A service-role key is
 *    a server-only secret (ingestion CLI / edge function) and must never be
 *    referenced from client code — see docs/supabase-migration.md.
 *  • RLS grants `select` and nothing else to anon, so this module never
 *    attempts a write. Persistence of app state stays on the existing
 *    localStorage tier, with its corruption quarantine and JSON export intact.
 *  • Any failure — unconfigured, offline, timeout, RLS rejection — degrades the
 *    session to 'local' for good and surfaces a banner. Supabase is never a
 *    hard dependency.
 *  • Anything fetched from SQL is ADVISORY / UI-only. It never feeds the
 *    pipeline, the joint score matrix, or the seeded bootstrap.
 */
import type { League } from '../types/winmix';
import { readCloudEnv } from './cloudConfig';

const PROBE_TIMEOUT_MS = 4000;

const readEnv = readCloudEnv;

/** Turns a PostgREST status code into something a human can act on. */
function describeHttpError(status: number, statusText: string): string {
  switch (status) {
    case 401:
      return 'HTTP 401 — az anon kulcsot a projekt elutasította. Ellenőrizd, hogy a kulcs ehhez a projekthez tartozik-e, és hogy a legacy JWT kulcsok engedélyezve vannak-e (új projekteknél a publishable kulcs kell).';
    case 403:
      return 'HTTP 403 — a kulcs érvényes, de az RLS nem enged `select`-et az anon szerepnek.';
    case 404:
      return 'HTTP 404 — a kért nézet/tábla nem létezik ebben a projektben (lásd docs/supabase-migration.md).';
    case 429:
      return 'HTTP 429 — túl sok kérés, próbáld újra később.';
    default:
      return `HTTP ${status} — ${statusText || 'kérés elutasítva'}`;
  }
}

/** Non-secret connection summary for the diagnostics panel. */
export function cloudEndpointSummary(): {url: string;source: 'env' | 'fallback';} | null {
  const env = readEnv();
  return env ? { url: env.url, source: env.source } : null;
}

export function isCloudTierConfigured(): boolean {
  return readEnv() !== null;
}

export type CloudTierStatus = 'unconfigured' | 'probing' | 'online' | 'degraded';

export interface CloudTierHealth {
  status: CloudTierStatus;
  /** Sticky for the whole session once a call has failed. */
  degraded: boolean;
  lastError: string | null;
  checkedAt: string | null;
}

export function idleHealth(): CloudTierHealth {
  return {
    status: isCloudTierConfigured() ? 'probing' : 'unconfigured',
    degraded: false,
    lastError: null,
    checkedAt: null
  };
}

/** Carries the HTTP status so callers can branch (404 → fall back, 401 → stop). */
export class CloudHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'CloudHttpError';
    this.status = status;
  }
}

/** PostgREST returns `{ message, hint, details, code }` on every error. */
async function readPostgrestDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    const parts = [body.message, body.hint, body.details].
    filter((v): v is string => typeof v === 'string' && v.length > 0).
    map((v) => v.trim());
    const code = typeof body.code === 'string' ? ` (${body.code})` : '';
    return parts.length ? ` · PostgREST: ${parts.join(' — ')}${code}` : '';
  } catch {
    return '';
  }
}

/** New `sb_publishable_…` keys are opaque strings, not JWTs — never send them as Bearer. */
function isOpaqueKey(key: string): boolean {
  return key.startsWith('sb_publishable_') || key.startsWith('sb_secret_');
}

async function restGet(path: string): Promise<unknown> {
  const env = readEnv();
  if (!env) throw new Error('A felhő tier nincs konfigurálva (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      // The key belongs in `apikey`. Legacy JWT anon keys are mirrored into
      // `Authorization` so PostgREST resolves the role; opaque publishable keys
      // must NOT be sent as Bearer (PostgREST answers 401 "Expected 3 parts").
      apikey: env.anonKey,
      Accept: 'application/json'
    };
    if (!isOpaqueKey(env.anonKey)) headers.Authorization = `Bearer ${env.anonKey}`;
    const res = await fetch(`${env.url}/rest/v1/${path}`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    if (!res.ok) {
      const detail = await readPostgrestDetail(res);
      throw new CloudHttpError(res.status, describeHttpError(res.status, res.statusText) + detail);
    }
    return (await res.json()) as unknown;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Reachability + RLS probe. Never throws; the caller degrades on `false`. */
export async function probeCloudTier(): Promise<CloudTierHealth> {
  if (!isCloudTierConfigured()) {
    return {
      status: 'unconfigured',
      degraded: false,
      lastError: null,
      checkedAt: new Date().toISOString()
    };
  }
  try {
    // Probe the view the cross-check actually reads. A 404 only means the view
    // is not deployed yet, so fall back to the REST root to prove reachability.
    // A 401/403 is a real credential/RLS/GRANT problem and must not be masked.
    try {
      await restGet('view_team_ratings?select=canonical_key&limit=1');
    } catch (e) {
      if (e instanceof CloudHttpError && (e.status === 401 || e.status === 403)) throw e;
      await restGet('winmix_teams?select=id&limit=1');
    }
    return { status: 'online', degraded: false, lastError: null, checkedAt: new Date().toISOString() };
  } catch (e) {
    return {
      status: 'degraded',
      degraded: true,
      lastError: e instanceof Error ? e.message : String(e),
      checkedAt: new Date().toISOString()
    };
  }
}

/** One row of `view_team_ratings` — advisory, cross-check material only. */
export interface CloudTeamRating {
  canonicalKey: string;
  displayName: string;
  totalPlayed: number;
  netHome: number;
  netAway: number;
  ppg: number;
  autoWeightIndex: number;
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Where the last ratings read came from — drives the Cloud tab empty states. */
export type RatingsSource = 'view' | 'team_season_stats' | 'none';
export let lastRatingsSource: RatingsSource = 'none';

async function fetchFromSeasonStats(league: League): Promise<CloudTeamRating[]> {
  const [teams, stats] = await Promise.all([
    restGet(`winmix_teams?league=eq.${encodeURIComponent(league)}&select=id,canonical_key,display_name,weight_index`),
    restGet(`winmix_team_season_stats?league=eq.${encodeURIComponent(league)}&select=team_id,played,goals_for,goals_against,points`)
  ]);
  if (!Array.isArray(teams) || !Array.isArray(stats) || stats.length === 0) return [];
  const agg = new Map<string, { p: number; gf: number; ga: number; pts: number }>();
  for (const s of stats as Array<Record<string, unknown>>) {
    const id = String(s.team_id);
    const a = agg.get(id) ?? { p: 0, gf: 0, ga: 0, pts: 0 };
    a.p += num(s.played); a.gf += num(s.goals_for); a.ga += num(s.goals_against); a.pts += num(s.points);
    agg.set(id, a);
  }
  return (teams as Array<Record<string, unknown>>).flatMap((t) => {
    const a = agg.get(String(t.id));
    if (!a || a.p === 0) return [];
    const net = (a.gf - a.ga) / a.p;
    // The stats table has no home/away goal split, so both sides show the overall net.
    return [{
      canonicalKey: String(t.canonical_key ?? ''),
      displayName: String(t.display_name ?? ''),
      totalPlayed: a.p,
      netHome: net,
      netAway: net,
      ppg: a.pts / a.p,
      autoWeightIndex: num(t.weight_index)
    }];
  });
}

/**
 * Reads the SQL-side ratings for cross-checking against
 * `computeAutoTeamWeights()`. Tries `view_team_ratings` first, then falls back
 * to `winmix_team_season_stats`. UI-only: never fed into the pipeline.
 */
export async function fetchCloudTeamRatings(league: League): Promise<CloudTeamRating[]> {
  try {
    const raw = await restGet(
      `view_team_ratings?league=eq.${encodeURIComponent(league)}&select=canonical_key,display_name,total_played,net_home,net_away,ppg,auto_weight_index`
    );
    if (Array.isArray(raw) && raw.length) {
      lastRatingsSource = 'view';
      return raw.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          canonicalKey: String(r.canonical_key ?? ''),
          displayName: String(r.display_name ?? ''),
          totalPlayed: num(r.total_played),
          netHome: num(r.net_home),
          netAway: num(r.net_away),
          ppg: num(r.ppg),
          autoWeightIndex: num(r.auto_weight_index)
        };
      });
    }
  } catch (e) {
    if (!(e instanceof CloudHttpError) || (e.status !== 404 && e.status !== 400)) throw e;
  }
  const rows = await fetchFromSeasonStats(league);
  lastRatingsSource = rows.length ? 'team_season_stats' : 'none';
  return rows;
}

export interface IngestRowError {
  season: string;
  matchNo: number;
  match: string;
  reason: string;
}

export interface IngestResult {
  success: boolean;
  seasons: number;
  teams: number;
  matches: number;
  rejected: number;
  repaired: number;
  errors: string[];
  rowErrors?: IngestRowError[];
}

export const ADMIN_TOKEN_KEY = 'winmix.adminToken';

export function readAdminToken(): string {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Uploads local seasons through a server function that holds the secret key.
 * Team names are mapped to `winmix_teams` ids server-side; rows that cannot be
 * mapped or validated come back in `rowErrors`. Idempotent (stable ids + upsert).
 */
export async function ingestSeasonsToCloud(params: {
  seasons: Array<{
    id: string;
    league: League;
    seasonIndex: number;
    name: string;
    fileName: string;
    createdAt: string;
    contentHash: string | null;
    orderMode?: string;
    matches: Array<{
      match_no: number;
      date: string;
      kickoffIso?: string | null;
      rowIndex?: number;
      sourceFileId?: string | null;
      home_team: string;
      away_team: string;
      ht_home_score: number | null;
      ht_away_score: number | null;
      home_score: number;
      away_score: number;
    }>;
  }>;
  teamWeights?: Record<string, Record<string, number>>;
  teamAliasMap?: Record<string, Record<string, string>>;
}): Promise<IngestResult> {
  const fail = (msg: string): IngestResult => ({
    success: false, seasons: 0, teams: 0, matches: 0, rejected: 0, repaired: 0, errors: [msg]
  });
  const env = readEnv();
  if (!env) return fail('A felhő tier nincs konfigurálva.');
  const adminToken = readAdminToken();
  if (!adminToken) return fail('Add meg az admin kódot a Felhő fülön a feltöltéshez.');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${env.url}/functions/v1/winmix-ingest`, {
      method: 'POST',
      headers: { ...functionHeaders(env.anonKey), 'X-Admin-Token': adminToken },
      body: JSON.stringify({
        mode: 'merge',
        allowPartial: false,
        teamAliasMap: params.teamAliasMap,
        // The ingest function requires an explicit orderMode and only these fields.
        seasons: params.seasons.map((s) => ({
          league: s.league,
          seasonIndex: s.seasonIndex,
          name: s.name,
          fileName: s.fileName || null,
          contentHash: s.contentHash,
          orderMode: s.orderMode === 'chronological' ? 'chronological' : 'source-order',
          matches: s.matches.map((m) => ({
            home_team: m.home_team,
            away_team: m.away_team,
            home_score: m.home_score,
            away_score: m.away_score,
            ht_home_score: m.ht_home_score,
            ht_away_score: m.ht_away_score,
            kickoffIso: m.kickoffIso ?? null,
            date: m.date || null,
            rowIndex: typeof m.rowIndex === 'number' ? m.rowIndex : null,
            sourceFileId: m.sourceFileId ?? null
          }))
        }))
      }),
      signal: controller.signal
    });
    if (res.status === 404) return fail('A feltöltő funkció (winmix-ingest) még nincs telepítve az adatbázis projektedben.');
    const body = (await res.json().catch(() => ({}))) as Partial<IngestResult> & { error?: string };
    if (!res.ok && res.status !== 207) return fail(body.error ?? `HTTP ${res.status}`);
    return {
      success: body.success ?? false,
      seasons: body.seasons ?? 0,
      teams: body.teams ?? 0,
      matches: body.matches ?? 0,
      rejected: body.rejected ?? 0,
      repaired: body.repaired ?? 0,
      errors: body.errors ?? [],
      rowErrors: body.rowErrors ?? []
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  } finally {
    window.clearTimeout(timer);
  }
}

function functionHeaders(key: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', apikey: key };
  if (!isOpaqueKey(key)) h.Authorization = `Bearer ${key}`;
  return h;
}

/** Sends a schema snapshot to the winmix-schema-analyze function (AI review). */
export async function analyzeSchemaSnapshot(schema: string): Promise<string> {
  const env = readEnv();
  if (!env) throw new Error('A felhő tier nincs konfigurálva.');
  const res = await fetch(`${env.url}/functions/v1/winmix-schema-analyze`, {
    method: 'POST',
    headers: { ...functionHeaders(env.anonKey), 'X-Admin-Token': readAdminToken() },
    body: JSON.stringify({ schema })
  });
  if (res.status === 404) throw new Error('Az AI elemző szolgáltatás még nincs telepítve.');
  const body = (await res.json().catch(() => ({}))) as { report?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.report ?? '';
}
