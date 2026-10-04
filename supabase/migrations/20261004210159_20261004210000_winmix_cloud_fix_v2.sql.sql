/*
# WinMix cloud fix v2 — stats refresh, atomic ingest wrapper, precise ratings view, privilege hardening

1. Purpose
   Fixes three problems in the v1 schema:
   - The ingest RPC never refreshed `winmix_team_season_stats` after inserting matches.
     The ratings view read stale (or empty) stats rows.
   - `view_team_ratings` computed `net_home` and `net_away` as the total goal
     differential and its negation — not actual home/away splits.  This made the
     cross-check table misleading.
   - Anon/authenticated roles held INSERT/UPDATE/DELETE grants on all tables.
     The edge function uses the service-role key (which bypasses RLS), so these
     grants were unnecessary and gave the browser a direct write path that RLS
     policies did not block (only SELECT policies exist).

2. New Functions
   - `winmix_refresh_season_stats_v2(p_season_id uuid)` — deletes and rebuilds
     per-team per-season aggregate stats from settled match rows.  Called
     automatically by the v2 ingest wrapper after every successful import.
   - `winmix_ingest_season_v2(p_season jsonb, p_matches jsonb, p_mode text)` —
     a SECURITY INVOKER wrapper around v1 that:
       * validates all fields server-side,
       * auto-creates missing teams (canonical_key + display_name),
       * resolves team keys to uuids,
       * delegates season + match writes to the existing v1 RPC,
       * refreshes season stats in the same transaction,
       * returns the v1 result with `statsRefreshed: true`.
     REVOKE from public/anon/authenticated; GRANT EXECUTE to service_role only.

3. Modified Views
   - `view_team_ratings` — changed to `security_invoker = true` so it enforces
     the caller's RLS instead of the view owner's.
   - `view_team_ratings_v2` (NEW) — precise ratings view with actual home/away
     goal-differential averages computed from `winmix_matches` appearances.
     Columns: canonical_key, display_name, league, total_played, net_home,
     net_away, ppg, auto_weight_index.  Uses `security_invoker = true`.

4. Security Changes
   - REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on all four
     data tables FROM anon, authenticated.  Only SELECT remains for browser
     clients; writes go exclusively through the edge function's service-role key.
   - GRANT ALL on data tables TO service_role (edge function writes).
   - GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role.
   - GRANT SELECT on both views TO anon, authenticated, service_role.
   - Both views use `security_invoker = true` so RLS is enforced for the caller.
   - `winmix_refresh_season_stats_v2` and `winmix_ingest_season_v2` are
     SECURITY INVOKER, REVOKE'd from public/anon/authenticated, GRANT'd to
     service_role only.

5. Backfill
   - Rebuilds `winmix_team_season_stats` for every existing season so old
     imports get correct stats rows immediately.

6. Important Notes
   - This migration is idempotent: `CREATE OR REPLACE` for functions and views,
     `DROP`-free privilege changes.
   - The v1 RPC (`winmix_ingest_season_v1`) remains unchanged — v2 calls it
     internally after team resolution.
   - `NOTIFY pgrst, 'reload schema'` is sent so PostgREST picks up the new
     view immediately.
*/

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
  public.winmix_teams, public.winmix_seasons, public.winmix_matches, public.winmix_team_season_stats
  FROM anon, authenticated;
GRANT SELECT ON public.winmix_teams, public.winmix_seasons, public.winmix_matches,
  public.winmix_team_season_stats TO anon, authenticated;
GRANT ALL ON public.winmix_teams, public.winmix_seasons, public.winmix_matches,
  public.winmix_team_season_stats TO service_role;

CREATE OR REPLACE FUNCTION public.winmix_refresh_season_stats_v2(p_season_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  DELETE FROM public.winmix_team_season_stats WHERE season_id = p_season_id;
  INSERT INTO public.winmix_team_season_stats
    (team_id, season_id, league, played, wins, draws, losses, goals_for, goals_against, points)
  SELECT team_id, p_season_id, league, count(*)::int,
    count(*) FILTER (WHERE gf > ga)::int, count(*) FILTER (WHERE gf = ga)::int,
    count(*) FILTER (WHERE gf < ga)::int, sum(gf)::int, sum(ga)::int,
    sum(CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END)::int
  FROM (
    SELECT home_team_id AS team_id, league, home_score AS gf, away_score AS ga
    FROM public.winmix_matches WHERE season_id = p_season_id
    UNION ALL
    SELECT away_team_id, league, away_score, home_score
    FROM public.winmix_matches WHERE season_id = p_season_id
  ) appearances GROUP BY team_id, league;
END;
$$;
REVOKE ALL ON FUNCTION public.winmix_refresh_season_stats_v2(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.winmix_refresh_season_stats_v2(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.winmix_ingest_season_v2(
  p_season jsonb, p_matches jsonb, p_mode text DEFAULT 'merge'
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public SET lock_timeout = '10s' AS $$
DECLARE
  league_value text;
  resolved jsonb;
  result jsonb;
  item jsonb;
  field text;
  value jsonb;
BEGIN
  IF jsonb_typeof(p_season) IS DISTINCT FROM 'object' OR
     jsonb_typeof(p_matches) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid import structure';
  END IF;
  IF jsonb_array_length(p_matches) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid match count'; END IF;
  league_value := p_season->>'league';
  IF league_value IS NULL OR league_value NOT IN ('angol','spanyol') THEN RAISE EXCEPTION 'Invalid league'; END IF;
  IF jsonb_typeof(p_season->'season_index') IS DISTINCT FROM 'number' OR
     (p_season->>'season_index')::numeric <> trunc((p_season->>'season_index')::numeric) THEN
    RAISE EXCEPTION 'Invalid season index';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_matches) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid match'; END IF;
    FOREACH field IN ARRAY ARRAY['match_no','home_score','away_score','ht_home_score','ht_away_score','row_index'] LOOP
      value := item->field;
      IF field IN ('match_no','home_score','away_score') AND (value IS NULL OR value = 'null'::jsonb) THEN
        RAISE EXCEPTION 'Missing required numeric field';
      END IF;
      IF value IS NOT NULL AND value <> 'null'::jsonb THEN
        IF jsonb_typeof(value) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid numeric type'; END IF;
        IF (value::text)::numeric <> trunc((value::text)::numeric) THEN RAISE EXCEPTION 'Fractional integer'; END IF;
      END IF;
    END LOOP;
    FOREACH field IN ARRAY ARRAY['home_team_key','away_team_key','home_team_name','away_team_name'] LOOP
      IF jsonb_typeof(item->field) IS DISTINCT FROM 'string' OR
         length(btrim(item->>field)) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'Invalid team name'; END IF;
    END LOOP;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended('winmix-ingest:' || league_value || ':' || (p_season->>'season_index'), 0));
  INSERT INTO public.winmix_teams (league, canonical_key, display_name, weight_index)
  SELECT league_value, key, min(name), 50 FROM (
    SELECT item->>'home_team_key' AS key, item->>'home_team_name' AS name FROM jsonb_array_elements(p_matches) item
    UNION ALL
    SELECT item->>'away_team_key', item->>'home_team_name' FROM jsonb_array_elements(p_matches) item
  ) names GROUP BY key ORDER BY key
  ON CONFLICT (league, canonical_key) DO NOTHING;

  SELECT jsonb_agg((item - 'home_team_key' - 'away_team_key' - 'home_team_name' - 'away_team_name') ||
    jsonb_build_object('home_team_id', h.id, 'away_team_id', a.id) ORDER BY ordinal)
  INTO resolved FROM jsonb_array_elements(p_matches) WITH ORDINALITY input(item, ordinal)
  JOIN public.winmix_teams h ON h.league = league_value AND h.canonical_key = item->>'home_team_key'
  JOIN public.winmix_teams a ON a.league = league_value AND a.canonical_key = item->>'away_team_key';
  IF jsonb_array_length(resolved) IS DISTINCT FROM jsonb_array_length(p_matches) THEN RAISE EXCEPTION 'Team resolution failed'; END IF;
  result := public.winmix_ingest_season_v1(p_season, resolved, p_mode);
  PERFORM public.winmix_refresh_season_stats_v2((result->>'seasonId')::uuid);
  RETURN result || jsonb_build_object('statsRefreshed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.winmix_ingest_season_v2(jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.winmix_ingest_season_v2(jsonb,jsonb,text) TO service_role;

DO $$ DECLARE sid uuid; BEGIN
  FOR sid IN SELECT id FROM public.winmix_seasons LOOP
    PERFORM public.winmix_refresh_season_stats_v2(sid);
  END LOOP;
END $$;

ALTER VIEW public.view_team_ratings SET (security_invoker = true);
CREATE OR REPLACE VIEW public.view_team_ratings_v2 WITH (security_invoker = true) AS
WITH appearances AS (
  SELECT home_team_id AS team_id, league, home_score-away_score AS net, true AS is_home,
    CASE WHEN home_score > away_score THEN 3 WHEN home_score = away_score THEN 1 ELSE 0 END AS points
  FROM public.winmix_matches
  UNION ALL
  SELECT away_team_id, league, away_score-home_score, false,
    CASE WHEN away_score > home_score THEN 3 WHEN away_score = home_score THEN 1 ELSE 0 END
  FROM public.winmix_matches
)
SELECT t.canonical_key, t.display_name, t.league, count(a.team_id) AS total_played,
  coalesce(avg(a.net) FILTER (WHERE a.is_home),0) AS net_home,
  coalesce(avg(a.net) FILTER (WHERE NOT a.is_home),0) AS net_away,
  coalesce(round(avg(a.points),3),0) AS ppg, t.weight_index AS auto_weight_index
FROM public.winmix_teams t LEFT JOIN appearances a ON a.team_id=t.id AND a.league=t.league GROUP BY t.id;
GRANT SELECT ON public.view_team_ratings, public.view_team_ratings_v2 TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';