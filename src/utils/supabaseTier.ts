/** Optional advisory cloud reads and operator-authorized imports. No admin key in browser. */
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
  return key.startsWith('sb_publishable_');
}

async function restGet(path: string, allPages = false): Promise<unknown> {
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
    if (env.anonKey.startsWith('sb_secret_')) throw new Error('Titkos kulcs nem használható a böngészőben.');
    if (!isOpaqueKey(env.anonKey)) headers.Authorization = `Bearer ${env.anonKey}`;
    const rows: unknown[] = [];
    let offset = 0;
    if (allPages) headers.Prefer = 'count=exact';
    while (true) {
    const requestPath = allPages ? `${path}&limit=500&offset=${offset}` : path;
    const res = await fetch(`${env.url}/rest/v1/${requestPath}`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    if (!res.ok) {
      const detail = await readPostgrestDetail(res);
      throw new CloudHttpError(res.status, describeHttpError(res.status, res.statusText) + detail);
    }
    const body: unknown = await res.json();
    if (!allPages) return body;
    if (!Array.isArray(body)) throw new Error('Hibás lapozott SQL-válasz.');
    const range = res.headers.get('content-range');
    const totalText = range?.split('/')[1];
    if (!totalText) {
      if (body.length < 500) return rows;
      throw new Error('Hiányzó pontos SQL sorszám a Content-Range fejlécben.');
    }
    if (!/^\d+$/.test(totalText)) throw new Error('Hiányzó pontos SQL sorszám a Content-Range fejlécben.');
    const total = Number(totalText);
    rows.push(...body); offset += body.length;
    if (offset >= total) return rows;
    if (!body.length) throw new Error('A SQL lapozás megszakadt.');
    }

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
    const env = readEnv();
    if (!env?.dataVersionId) throw new Error('VITE_WINMIX_DATA_VERSION_ID nincs beállítva.');
    // Probe the view the cross-check actually reads. A 404 only means the view
    // is not deployed yet, so fall back to the REST root to prove reachability.
    // A 401/403 is a real credential/RLS/GRANT problem and must not be masked.
    try {
      await restGet(`view_team_ratings_v3?data_version_id=eq.${encodeURIComponent(env.dataVersionId)}&select=canonical_key&limit=1`);
    } catch (e) {
      if (e instanceof CloudHttpError && e.status === 404) {
        await restGet('');
      } else {
        throw e;
      }
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
  league: League;
  comparable: boolean;
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Where the last ratings read came from — drives the Cloud tab empty states. */
export type RatingsSource = 'view' | 'team_season_stats' | 'none';
export let lastRatingsSource: RatingsSource = 'none';

/** v3 uses mean goal differential for actual home and away appearances.
 * Local autoWeights formula/scope was not supplied, so equality is not asserted.
 */
export async function fetchCloudTeamRatings(league: League): Promise<CloudTeamRating[]> {
  lastRatingsSource = 'none';
  const env = readEnv();
  if (!env?.dataVersionId) throw new Error('VITE_WINMIX_DATA_VERSION_ID nincs beállítva.');
  const raw = await restGet(
    `view_team_ratings_v3?data_version_id=eq.${encodeURIComponent(env.dataVersionId)}&league=eq.${encodeURIComponent(league)}&select=canonical_key,display_name,total_played,net_home,net_away,ppg,auto_weight_index&order=canonical_key.asc`, true
  );
  if (!Array.isArray(raw)) throw new Error('Hibás SQL-értékelési válasz.');
  lastRatingsSource = raw.length ? 'view' : 'none';
  return raw.map((row) => {
    if (!row || typeof row !== 'object') throw new Error('Hibás SQL-értékelési sor.');
    const r = row as Record<string, unknown>;
    return { canonicalKey: String(r.canonical_key ?? ''), displayName: String(r.display_name ?? ''),
      totalPlayed: num(r.total_played), netHome: num(r.net_home), netAway: num(r.net_away),
      ppg: num(r.ppg), autoWeightIndex: num(r.auto_weight_index), league, comparable: false };
  });
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
  requestId?: string;
  requestIds?: string[];
  partial?: boolean;
  results?: Array<Record<string, unknown>>;
  rowErrorsTruncated?: boolean;
}

/**
 * Uploads local seasons through a server function that holds the secret key.
 * Team names are mapped to `winmix_teams` ids server-side (auto-created if
 * missing); rows that cannot be validated come back in `rowErrors`.
 * Idempotent (stable ids + upsert).
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
  importToken: string;
  teamWeights?: Record<string, Record<string, number>>;
  teamAliasMap?: Record<string, Record<string, string>>;
}): Promise<IngestResult> {
  const fail = (msg: string): IngestResult => ({
    success: false, seasons: 0, teams: 0, matches: 0, rejected: 0, repaired: 0, errors: [msg]
  });
  const env = readEnv();
  if (!env) return fail('A felhő tier nincs konfigurálva.');
  if (!env.dataVersionId) return fail('VITE_WINMIX_DATA_VERSION_ID szükséges: válassz létező draft adateverziót.');
  if (!/^[a-f0-9]{64}$/i.test(params.importToken)) return fail('64 karakteres hex importtoken szükséges.');
  if (!params.seasons.length) return fail('Nincs feltöltendő szezon.');
  const combined: IngestResult = { success: true, partial: false, seasons: 0, teams: 0, matches: 0,
    rejected: 0, repaired: 0, errors: [], rowErrors: [], results: [], requestIds: [] };
  const uniqueTeams = new Set<string>();
  // One complete season per request: never split its stable match numbers.
  // Validate every request size BEFORE the first write.
  const requests = params.seasons.map((s) => ({
    mode: 'merge', allowPartial: false, dataVersionId: env.dataVersionId, teamAliasMap: params.teamAliasMap,
    seasons: [{ league: s.league, seasonIndex: s.seasonIndex, name: s.name,
      fileName: s.fileName || 'winmix-upload.json', contentHash: s.contentHash,
      orderMode: s.orderMode === 'chronological' ? 'chronological' : 'source-order',
      matches: s.matches.map((m) => ({ home_team: m.home_team, away_team: m.away_team,
        home_score: m.home_score, away_score: m.away_score, ht_home_score: m.ht_home_score,
        ht_away_score: m.ht_away_score, kickoffIso: m.kickoffIso ?? null, date: m.date || null,
        rowIndex: typeof m.rowIndex === 'number' ? m.rowIndex : null, sourceFileId: m.sourceFileId ?? null })) }]
  }));
  const bodies = requests.map((r) => JSON.stringify(r));
  const oversized = requests.findIndex((r, i) => r.seasons[0].matches.length > 240 ||
    new TextEncoder().encode(bodies[i]).length > 4 * 1024 * 1024);
  if (oversized >= 0) return fail(`A(z) ${params.seasons[oversized].name} szezon meghaladja a 240 mérkőzés / 4 MiB korlátot.`);
  for (let i = 0; i < bodies.length; i++) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(`${env.url}/functions/v1/winmix-ingest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.anonKey,
          'x-winmix-ingest-token': params.importToken }, body: bodies[i], signal: controller.signal
      });
      const body = await res.json().catch(() => null) as (Partial<IngestResult> & { error?: string }) | null;
      const requestId = body?.requestId ?? res.headers.get('X-Request-Id');
      if (requestId) combined.requestIds!.push(requestId);
      combined.seasons += body?.seasons ?? 0; combined.matches += body?.matches ?? 0;
      combined.rejected += body?.rejected ?? 0; combined.repaired += body?.repaired ?? 0;
      combined.errors.push(...(body?.errors ?? [])); combined.rowErrors!.push(...(body?.rowErrors ?? []));
      combined.results!.push(...(body?.results ?? []));
      combined.rowErrorsTruncated ||= body?.rowErrorsTruncated ?? false;
      if (!res.ok || body?.success !== true) {
        combined.success = false;
        if (body?.error) combined.errors.push(body.error);
        if (!body?.error && !body?.errors?.length) combined.errors.push(`HTTP ${res.status}: ${params.seasons[i].name}`);
        break; // Preserve confirmed earlier commits, stop subsequent seasons.
      }
      for (const m of requests[i].seasons[0].matches) {
        for (const name of [m.home_team, m.away_team]) {
          const key = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
          const alias = params.teamAliasMap?.[params.seasons[i].league]?.[key] ?? key;
          uniqueTeams.add(`${params.seasons[i].league}:${alias}`);
        }
      }
    } catch (error) {
      combined.success = false;
      combined.errors.push(error instanceof Error && error.name === 'AbortError'
        ? 'Időtúllépés: a szerver mentése befejeződhetett. Ellenőrizd, majd ismételd a merge importot.'
        : error instanceof Error ? error.message : String(error));
      break;
    } finally { window.clearTimeout(timer); }
  }
  combined.teams = uniqueTeams.size;
  combined.partial = !combined.success && combined.seasons > 0;
  return combined;
}
