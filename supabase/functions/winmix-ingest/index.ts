
// WinMix ingest v2 — operator token required; atomic team/season/match/stat writes.
// Hosted edge functions inject SUPABASE_SECRET_KEYS (JSON map) and SUPABASE_URL.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-winmix-ingest-token",
};
const BUILD = "winmix-ingest-20261004-v2";
// OPTIONS must never resolve secrets or create a database client.
async function authorizeImport(req: Request): Promise<void> {
  const expected = Deno.env.get("WINMIX_INGEST_TOKEN") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(expected)) throw new HttpError(503, "WINMIX_INGEST_TOKEN nincs konfigurálva (64 hex karakter szükséges)");
  const actual = req.headers.get("x-winmix-ingest-token") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(actual)) throw new HttpError(401, "Érvényes importtoken szükséges");
  const digest = async (v: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(actual), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  if (difference !== 0) throw new HttpError(403, "Az importtoken érvénytelen");
}

/** Named injected secret; never assume its name is service_role. */
function getServiceRoleKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  const requested = Deno.env.get("WINMIX_SECRET_KEY_NAME")?.trim();
  if (raw) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { throw new HttpError(503, "SUPABASE_SECRET_KEYS: hibás JSON-konfiguráció"); }
    if (!object(parsed)) throw new HttpError(503, "SUPABASE_SECRET_KEYS: objektum szükséges");
    const entries = Object.entries(parsed).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].startsWith("sb_secret_"));
    const name = requested ?? (entries.some(([n]) => n === "default") ? "default" : entries.length === 1 ? entries[0][0] : undefined);
    const key = name ? parsed[name] : undefined;
    if (typeof key === "string" && key.startsWith("sb_secret_")) return key;
    throw new HttpError(503, "Állítsd be a WINMIX_SECRET_KEY_NAME változót a projekt kulcsnevére");
  }
  if (requested) throw new HttpError(503, "A megadott kulcsnévhez hiányzik SUPABASE_SECRET_KEYS");
  const direct = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct?.trim()) return direct.trim();
  throw new HttpError(503, "Hiányzó szerveroldali Supabase-kulcs");
}

const LIMITS = { bytes: 4 * 1024 * 1024, seasons: 5, matches: 2000, errors: 100 };
const MAX_GOALS = 20;
type Obj = Record<string, unknown>;
type League = "angol" | "spanyol";
type Mode = "merge" | "replace";
type Season = {
  league: League; seasonIndex: number; name: string; fileName: string | null;
  contentHash: string | null; orderMode: "source-order" | "chronological";
  matches: unknown[];
};
type RowError = { season: string; matchNo: number; match: string; reason: string };
type MatchRow = {
  league: League; match_no: number; source_file_id: string | null;
  row_index: number | null; kickoff_iso: string | null; match_date_raw: string | null;
  home_team_key: string; away_team_key: string; home_team_name: string; away_team_name: string; home_score: number; away_score: number;
  ht_home_score: number | null; ht_away_score: number | null;
};
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function object(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function canon(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}
function text(value: unknown, field: string, max = 256): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new HttpError(400, `${field}: nem üres, legfeljebb ${max} karakteres szöveg szükséges`);
  }
  return value.trim();
}
function optionalText(value: unknown, field: string, max = 256): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, field, max);
}
function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${field}: ${min} és ${max} közötti egész szám szükséges`);
  }
  return value;
}
function kickoff(value: unknown): string | null {
  const raw = optionalText(value, "kickoffIso", 40);
  if (raw === null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(raw);
  if (!m) throw new HttpError(400, "kickoffIso: ISO-dátum és időzóna szükséges");
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(y, mo - 1, d);
  calendar.setUTCHours(0, 0, 0, 0);
  const zone = m[8];
  const badZone = zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59);
  if (calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== mo - 1 ||
    calendar.getUTCDate() !== d || h > 23 || mi > 59 || s > 59 || badZone || !Number.isFinite(Date.parse(raw))) {
    throw new HttpError(400, "kickoffIso: érvénytelen dátum");
  }
  return new Date(raw).toISOString();
}
function checkScores(m: Obj) {
  const home = integer(m.home_score, "home_score", 0, MAX_GOALS);
  const away = integer(m.away_score, "away_score", 0, MAX_GOALS);
  const h = m.ht_home_score, a = m.ht_away_score;
  const hasH = h !== null && h !== undefined, hasA = a !== null && a !== undefined;
  const valid = hasH && hasA && typeof h === "number" && typeof a === "number" &&
    Number.isInteger(h) && Number.isInteger(a) && h >= 0 && a >= 0 && h <= home && a <= away;
  return { home, away, htHome: valid ? h as number : null, htAway: valid ? a as number : null,
    repaired: (hasH || hasA) && !valid };
}
function parsePayload(payload: unknown) {
  if (!object(payload) || !Array.isArray(payload.seasons) || payload.seasons.length === 0 ||
    payload.seasons.length > LIMITS.seasons) throw new HttpError(400, `1–${LIMITS.seasons} szezon szükséges`);
  const mode = payload.mode ?? "merge";
  if (mode !== "merge" && mode !== "replace") throw new HttpError(400, "mode: merge vagy replace szükséges");
  if (payload.allowPartial !== undefined && typeof payload.allowPartial !== "boolean") {
    throw new HttpError(400, "allowPartial: logikai érték szükséges");
  }
  const allowPartial = payload.allowPartial === true;
  if (mode === "replace" && allowPartial) throw new HttpError(400, "replace módban részleges import nem engedélyezett");
  const seen = new Set<string>();
  let total = 0;
  const seasons: Season[] = payload.seasons.map((s, i) => {
    if (!object(s)) throw new HttpError(400, `seasons[${i}]: objektum szükséges`);
    if (s.league !== "angol" && s.league !== "spanyol") throw new HttpError(400, "Ismeretlen liga");
    const seasonIndex = integer(s.seasonIndex, "seasonIndex", 0, 2147483647);
    const key = `${s.league}:${seasonIndex}`;
    if (seen.has(key)) throw new HttpError(400, `Ismétlődő szezon: ${key}`);
    seen.add(key);
    if (!Array.isArray(s.matches) || !s.matches.length) throw new HttpError(400, `${key}: nem üres matches tömb szükséges`);
    total += s.matches.length;
    if (total > LIMITS.matches) throw new HttpError(413, `Legfeljebb ${LIMITS.matches} mérkőzés küldhető egyszerre`);
    if (s.orderMode !== "source-order" && s.orderMode !== "chronological") {
      throw new HttpError(400, `${key}: explicit orderMode szükséges`);
    }
    return { league: s.league, seasonIndex, name: text(s.name, "name"),
      fileName: optionalText(s.fileName ?? s.sourceCsv, "fileName", 512),
      contentHash: optionalText(s.contentHash, "contentHash"), orderMode: s.orderMode, matches: s.matches };
  });
  const aliases = new Map<League, Map<string, string>>();
  if (payload.teamAliasMap !== undefined && !object(payload.teamAliasMap)) throw new HttpError(400, "Hibás teamAliasMap");
  for (const league of ["angol", "spanyol"] as const) {
    const raw = object(payload.teamAliasMap) ? payload.teamAliasMap[league] : undefined;
    if (raw !== undefined && !object(raw)) throw new HttpError(400, `Hibás aliastérkép: ${league}`);
    const map = new Map<string, string>();
    for (const [key, value] of Object.entries(raw ?? {})) {
      const k = canon(text(key, "Aliaskulcs")), v = canon(text(value, "Aliasérték"));
      if (!k || !v || (map.has(k) && map.get(k) !== v)) throw new HttpError(400, `Ütköző vagy üres alias: ${key}`);
      map.set(k, v);
    }
    aliases.set(league, map);
  }
  return { seasons, aliases, mode: mode as Mode, allowPartial };
}
async function readJson(req: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? "")) {
    throw new HttpError(415, "Content-Type: application/json szükséges");
  }
  const encoding = req.headers.get("content-encoding");
  if (encoding && encoding !== "identity") throw new HttpError(415, "Tömörített kérés nem támogatott");
  if (Number(req.headers.get("content-length")) > LIMITS.bytes) throw new HttpError(413, "Túl nagy kérés");
  if (!req.body) throw new HttpError(400, "Hiányzó JSON");
  const reader = req.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMITS.bytes) {
        await reader.cancel();
        throw new HttpError(413, "A kérés legfeljebb 4 MiB lehet");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, "Érvénytelen JSON vagy UTF-8"); }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const headers = new Headers({
    ...corsHeaders,
    "Access-Control-Expose-Headers": "X-Request-Id, X-WinMix-Build",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
    "X-WinMix-Build": BUILD,
  });
  const json = (body: unknown, status = 200) => {
    const h = new Headers(headers); h.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify({ requestId, build: BUILD, ...(object(body) ? body : { data: body }) }), { status, headers: h });
  };
  if (req.method === "OPTIONS") return Response.json({ ok: true, build: BUILD }, { headers });
  if (req.method !== "POST") { headers.set("Allow", "POST, OPTIONS"); return json({ success: false, error: "Csak POST támogatott" }, 405); }
  try {
    await authorizeImport(req);
    const url = Deno.env.get("SUPABASE_URL");
    if (!url || new URL(url).hostname !== "dpmyxypqcsugycqhifaf.supabase.co") throw new HttpError(503, "A funkció nem a célprojektben fut");
    const key = getServiceRoleKey();
    const input = parsePayload(await readJson(req));
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const stats = { seasons: 0, matches: 0, rejected: 0, repaired: 0, errors: [] as string[], rowErrors: [] as RowError[] };
    const usedTeams = new Set<string>();
    const results: Obj[] = [];

    for (const season of input.seasons) {
      try {
        const resolve = (name: string) => {
          const key = canon(name);
          return input.aliases.get(season.league)!.get(key) ?? key;
        };
        const rows: MatchRow[] = [];
        let rejected = 0, repaired = 0, previousTime: number | null = null;
        for (const [i, raw] of season.matches.entries()) {
          try {
            if (!object(raw)) throw new Error("A mérkőzés nem objektum");
            const home = text(raw.home_team, "home_team"), away = text(raw.away_team, "away_team");
            const homeId = resolve(home), awayId = resolve(away);
            if (!homeId || !awayId) throw new Error("Üres csapatkulcs");
            if (homeId === awayId) throw new Error("A hazai és vendég csapat azonos");
            const score = checkScores(raw), iso = kickoff(raw.kickoffIso);
            const row: MatchRow = {
              league: season.league, match_no: i + 1,
              source_file_id: optionalText(raw.sourceFileId, "sourceFileId"),
              row_index: raw.rowIndex == null ? null : integer(raw.rowIndex, "rowIndex", 0, 2147483647),
              kickoff_iso: iso, match_date_raw: optionalText(raw.date, "date", 128),
              home_team_key: homeId, away_team_key: awayId, home_team_name: home, away_team_name: away, home_score: score.home, away_score: score.away,
              ht_home_score: score.htHome, ht_away_score: score.htAway,
            };
            if (season.orderMode === "chronological") {
              if (!iso) throw new Error("chronological módban minden sorhoz kickoffIso szükséges");
              const time = Date.parse(iso);
              if (previousTime !== null && time < previousTime) throw new Error("A mérkőzések nincsenek időrendben");
              previousTime = time;
            }
            rows.push(row);
            if (score.repaired) repaired++;
          } catch (error) {
            rejected++; stats.rejected++;
            if (stats.rowErrors.length < LIMITS.errors) stats.rowErrors.push({ season: season.name, matchNo: i + 1,
              match: object(raw) ? `${typeof raw.home_team === "string" ? raw.home_team : "?"} – ${typeof raw.away_team === "string" ? raw.away_team : "?"}` : "?",
              reason: error instanceof Error ? error.message : "Hibás mérkőzés" });
          }
        }
        if (!rows.length || (rejected > 0 && !input.allowPartial)) {
          stats.errors.push(`Szezon "${season.name}": nem mentve; ${rejected} elutasított sor`);
          results.push({ league: season.league, seasonIndex: season.seasonIndex, status: "rejected", saved: 0, rejected });
          continue;
        }
        const { data, error } = await admin.rpc("winmix_ingest_season_v2", {
          p_season: { league: season.league, season_index: season.seasonIndex, name: season.name,
            file_name: season.fileName, content_hash: input.mode === "replace" ? season.contentHash : null,
            order_mode: season.orderMode }, p_matches: rows, p_mode: input.mode,
        });
        if (error) {
          console.error(JSON.stringify({ requestId, build: BUILD, stage: "commit", league: season.league, seasonIndex: season.seasonIndex, code: error.code, message: error.message }));
          throw new Error("A tranzakciós szezonmentés sikertelen; ellenőrizd az RPC-t és a szervernaplót");
        }
        stats.seasons++; stats.matches += rows.length; stats.repaired += repaired;
        for (const row of rows) { usedTeams.add(`${row.league}:${row.home_team_key}`); usedTeams.add(`${row.league}:${row.away_team_key}`); }
        results.push({ league: season.league, seasonIndex: season.seasonIndex, status: rejected ? "partial" : "saved",
          saved: rows.length, rejected, repaired, database: data });
      } catch (error) {
        stats.errors.push(`Szezon "${season.name}": ${error instanceof Error ? error.message : "Ismeretlen hiba"}`);
        results.push({ league: season.league, seasonIndex: season.seasonIndex, status: "failed", saved: 0 });
      }
    }
    const success = stats.errors.length === 0 && stats.rejected === 0;
    const status = success ? 200 : stats.seasons > 0 ? 207 : stats.rejected > 0 && results.every(r => r.status === "rejected") ? 422 : 500;
    return json({ success, partial: !success && stats.seasons > 0, mode: input.mode, teams: usedTeams.size,
      ...stats, rowErrorsTruncated: stats.rejected > stats.rowErrors.length, results }, status);
  } catch (error) {
    if (error instanceof HttpError) return json({ success: false, partial: false, error: error.message }, error.status);
    console.error(JSON.stringify({ requestId, build: BUILD, stage: "request", error: "Unhandled failure" }));
    return json({ success: false, partial: false, error: "Váratlan szerverhiba; azonosító alapján ellenőrizd a naplót" }, 500);
  }
});
