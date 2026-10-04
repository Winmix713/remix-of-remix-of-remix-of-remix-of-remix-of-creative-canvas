// @ts-nocheck
// Deploy this function in the WinMix database project. It runs with that
// project's own service-role key and requires a WINMIX_ADMIN_TOKEN secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Admin-Token",
};

const MAX_GOALS = 20;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function canon(name: string | null | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function checkScores(homeScore: number, awayScore: number, htHome: number | null, htAway: number | null) {
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    return { ok: false, htHome: null, htAway: null, reason: "Hiányzó vagy nem egész végeredmény" };
  }
  if (homeScore < 0 || awayScore < 0 || homeScore > MAX_GOALS || awayScore > MAX_GOALS) {
    return { ok: false, htHome: null, htAway: null, reason: "Valószerűtlen végeredmény" };
  }
  const hasH = htHome !== null && htHome !== undefined;
  const hasA = htAway !== null && htAway !== undefined;
  if (!hasH || !hasA) return { ok: true, htHome: null, htAway: null };
  if (htHome < 0 || htAway < 0 || htHome > homeScore || htAway > awayScore) {
    return { ok: true, htHome: null, htAway: null };
  }
  return { ok: true, htHome, htAway };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Csak POST támogatott" }, 405);

  const adminToken = Deno.env.get("WINMIX_ADMIN_TOKEN") ?? "";
  if (!adminToken || req.headers.get("x-admin-token") !== adminToken) {
    return json({ error: "Érvénytelen vagy hiányzó admin kód" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Hiányzó szerver beállítás" }, 500);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Érvénytelen JSON" }, 400);
  }
  if (!Array.isArray(payload?.seasons) || payload.seasons.length === 0) {
    return json({ error: "Nincsenek szezonok" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stats = {
    seasons: 0,
    matches: 0,
    rejected: 0,
    repaired: 0,
    errors: [] as string[],
    rowErrors: [] as Array<{ season: string; matchNo: number; match: string; reason: string }>,
  };
  const usedTeams = new Set<string>();
  const teamCache = new Map<string, Map<string, string>>();

  for (const season of payload.seasons) {
    const league = season.league;

    // Teams are curated in winmix_teams — mapped by canonical key or display name, never created here.
    if (!teamCache.has(league)) {
      const { data, error } = await admin
        .from("winmix_teams")
        .select("id, canonical_key, display_name")
        .eq("league", league);
      if (error) {
        stats.errors.push(`Csapatok (${league}): ${error.message}`);
        continue;
      }
      const map = new Map<string, string>();
      for (const r of data ?? []) {
        map.set(canon(r.canonical_key), r.id);
        if (r.display_name) map.set(canon(r.display_name), r.id);
      }
      teamCache.set(league, map);
    }
    const teamIds = teamCache.get(league)!;
    if (teamIds.size === 0) {
      stats.errors.push(`Szezon "${season.name}": nincs csapat a(z) ${league} ligához a csapattáblában`);
      continue;
    }
    const aliases = payload.teamAliasMap?.[league] ?? {};
    const resolve = (n: string) => teamIds.get(canon(aliases[n] ?? aliases[canon(n)] ?? n)) ?? teamIds.get(canon(n));

    const { data: seasonRow, error: seasonErr } = await admin
      .from("winmix_seasons")
      .upsert(
        {
          league,
          season_index: season.seasonIndex,
          name: season.name,
          file_name: season.fileName,
          content_hash: season.contentHash ?? null,
          match_count: season.matches.length,
          order_mode: season.orderMode === "source-order" ? "source-order" : "chronological",
        },
        { onConflict: "league,season_index" },
      )
      .select("id")
      .single();
    if (seasonErr || !seasonRow) {
      stats.errors.push(`Szezon "${season.name}": ${seasonErr?.message ?? "ismeretlen hiba"}`);
      continue;
    }
    stats.seasons++;

    const matchRows: Record<string, unknown>[] = [];
    let matchNo = 0;
    for (const m of season.matches) {
      matchNo++;
      const reject = (reason: string) => {
        stats.rejected++;
        stats.rowErrors.push({ season: season.name, matchNo, match: `${m.home_team} – ${m.away_team}`, reason });
      };
      const homeId = resolve(m.home_team);
      const awayId = resolve(m.away_team);
      if (!homeId) { reject(`Ismeretlen hazai csapat: ${m.home_team}`); continue; }
      if (!awayId) { reject(`Ismeretlen vendég csapat: ${m.away_team}`); continue; }
      if (homeId === awayId) { reject("A hazai és a vendég csapat azonos"); continue; }
      if (m.kickoffIso && Number.isNaN(Date.parse(m.kickoffIso))) { reject(`Hibás dátum: ${m.kickoffIso}`); continue; }
      const check = checkScores(m.home_score, m.away_score, m.ht_home_score, m.ht_away_score);
      if (!check.ok) { reject(check.reason); continue; }
      if (check.htHome === null && m.ht_home_score !== null && m.ht_home_score !== undefined) stats.repaired++;

      usedTeams.add(homeId);
      usedTeams.add(awayId);
      matchRows.push({
        season_id: seasonRow.id,
        league,
        match_no: matchNo,
        source_file_id: m.sourceFileId ?? null,
        row_index: m.rowIndex ?? null,
        kickoff_iso: m.kickoffIso ?? null,
        match_date_raw: m.date ?? null,
        home_team_id: homeId,
        away_team_id: awayId,
        ht_home_score: check.htHome,
        ht_away_score: check.htAway,
        home_score: m.home_score,
        away_score: m.away_score,
      });
    }

    if (matchRows.length > 0) {
      const { error: matchErr } = await admin
        .from("winmix_matches")
        .upsert(matchRows, { onConflict: "season_id,match_no" });
      if (matchErr) {
        stats.errors.push(`Szezon "${season.name}" mérkőzések: ${matchErr.message}`);
        continue;
      }
      stats.matches += matchRows.length;
    }
  }

  return json(
    { success: stats.errors.length === 0, teams: usedTeams.size, ...stats, rowErrors: stats.rowErrors.slice(0, 500) },
    stats.errors.length === 0 ? 200 : 207,
  );
});
