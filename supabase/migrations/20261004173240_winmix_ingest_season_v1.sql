/*
# WinMix ingest season RPC (winmix_ingest_season_v1)

1. Purpose
   Creates the `winmix_ingest_season_v1` PL/pgSQL function that the
   `winmix-ingest` edge function calls to atomically upsert a season and its
   matches. The edge function resolves team names to IDs and validates all
   input server-side before calling this RPC with the service-role key.

2. New Function
   - `winmix_ingest_season_v1(p_season jsonb, p_matches jsonb, p_mode text)`
     - `p_season`: JSON object with league, season_index, name, file_name,
       content_hash, order_mode.
     - `p_matches`: JSON array of match rows with match_no, league,
       home_team_id, away_team_id, home_score, away_score, ht_home_score,
       ht_away_score, kickoff_iso, match_date_raw, source_file_id, row_index.
     - `p_mode`: 'merge' (upsert, keep extra rows) or 'replace' (upsert + delete
       rows not in the incoming set).
     - Returns: jsonb with seasonId, saved, totalMatches, removed, mode.
     - Uses advisory lock per (league, season_index) to serialise concurrent
       imports. Validates match counts, scores, team leagues, chronological
       ordering, and duplicate match_no.

3. Security
   - SECURITY INVOKER — callable only by roles with EXECUTE privilege.
   - REVOKE from public, anon, authenticated.
   - GRANT EXECUTE to service_role only (the edge function uses the
     service-role key).

4. Prerequisites
   - Tables winmix_teams, winmix_seasons, winmix_matches must exist (created
     in the winmix_schema_v1 migration).
   - Unique indexes on (league, season_index) and (season_id, match_no) must
     exist for ON CONFLICT clauses (created in winmix_schema_v1).
*/

CREATE UNIQUE INDEX IF NOT EXISTS winmix_ingest_season_identity_uq
  ON winmix_seasons (league, season_index);
CREATE UNIQUE INDEX IF NOT EXISTS winmix_ingest_match_identity_uq
  ON winmix_matches (season_id, match_no);

CREATE OR REPLACE FUNCTION public.winmix_ingest_season_v1(
  p_season jsonb,
  p_matches jsonb,
  p_mode text DEFAULT 'merge'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
SET lock_timeout = '10s'
AS $function$
DECLARE
  s public.winmix_seasons%rowtype;
  old_s public.winmix_seasons%rowtype;
  sid public.winmix_seasons.id%type;
  total_count bigint;
  removed_count bigint := 0;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('merge', 'replace') THEN
    RAISE EXCEPTION 'Invalid import mode';
  END IF;
  IF jsonb_typeof(p_season) IS DISTINCT FROM 'object' OR
     jsonb_typeof(p_matches) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid import structure';
  END IF;
  IF jsonb_array_length(p_matches) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Invalid match count';
  END IF;
  s := jsonb_populate_record(NULL::public.winmix_seasons, p_season);
  IF s.league IS NULL OR s.league NOT IN ('angol', 'spanyol') OR
     s.season_index IS NULL OR s.season_index < 0 OR
     s.name IS NULL OR btrim(s.name) = '' OR
     s.order_mode IS NULL OR s.order_mode NOT IN ('source-order', 'chronological') THEN
    RAISE EXCEPTION 'Invalid season metadata';
  END IF;

  -- Serialize imports of the same season, including the first insert.
  PERFORM pg_advisory_xact_lock(hashtextextended('winmix-ingest:' || s.league || ':' || s.season_index::text, 0));
  SELECT * INTO old_s FROM public.winmix_seasons
    WHERE league = s.league AND season_index = s.season_index FOR UPDATE;
  IF found AND p_mode = 'merge' AND old_s.order_mode IS DISTINCT FROM s.order_mode THEN
    RAISE EXCEPTION 'Changing order_mode requires replace mode';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_matches) e
    WHERE jsonb_typeof(e) IS DISTINCT FROM 'object'
  ) THEN RAISE EXCEPTION 'Invalid match object'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_populate_recordset(NULL::public.winmix_matches, p_matches) m
    LEFT JOIN public.winmix_teams h ON h.id = m.home_team_id AND h.league = s.league
    LEFT JOIN public.winmix_teams a ON a.id = m.away_team_id AND a.league = s.league
    WHERE m.league IS DISTINCT FROM s.league OR m.match_no IS NULL OR m.match_no NOT BETWEEN 1 AND 2000
      OR h.id IS NULL OR a.id IS NULL OR h.id = a.id
      OR m.home_score IS NULL OR m.away_score IS NULL
      OR m.home_score NOT BETWEEN 0 AND 20 OR m.away_score NOT BETWEEN 0 AND 20
      OR m.home_score <> trunc(m.home_score::numeric) OR m.away_score <> trunc(m.away_score::numeric)
      OR (m.ht_home_score IS NULL) <> (m.ht_away_score IS NULL)
      OR (m.ht_home_score IS NOT NULL AND (
        m.ht_home_score NOT BETWEEN 0 AND m.home_score OR m.ht_away_score NOT BETWEEN 0 AND m.away_score
        OR m.ht_home_score <> trunc(m.ht_home_score::numeric)
        OR m.ht_away_score <> trunc(m.ht_away_score::numeric)))
      OR (m.row_index IS NOT NULL AND m.row_index < 0)
      OR (s.order_mode = 'chronological' AND m.kickoff_iso IS NULL)
  ) THEN RAISE EXCEPTION 'Invalid match values or team league'; END IF;

  IF EXISTS (
    SELECT match_no FROM jsonb_populate_recordset(NULL::public.winmix_matches, p_matches)
    GROUP BY match_no HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate match_no'; END IF;

  IF s.order_mode = 'chronological' AND EXISTS (
    SELECT 1 FROM (
      SELECT kickoff_iso, lag(kickoff_iso) OVER (ORDER BY match_no) AS previous
      FROM jsonb_populate_recordset(NULL::public.winmix_matches, p_matches)
    ) ordered WHERE kickoff_iso < previous
  ) THEN RAISE EXCEPTION 'Invalid chronological order'; END IF;

  INSERT INTO public.winmix_seasons AS target
    (league, season_index, name, file_name, content_hash, match_count, order_mode)
  VALUES (s.league, s.season_index, s.name, s.file_name,
    CASE WHEN p_mode = 'replace' THEN s.content_hash ELSE NULL END,
    jsonb_array_length(p_matches), s.order_mode)
  ON CONFLICT (league, season_index) DO UPDATE SET
    name = excluded.name, file_name = excluded.file_name,
    content_hash = excluded.content_hash, order_mode = excluded.order_mode
  RETURNING id INTO sid;

  INSERT INTO public.winmix_matches
    (season_id, league, match_no, source_file_id, row_index, kickoff_iso, match_date_raw,
     home_team_id, away_team_id, ht_home_score, ht_away_score, home_score, away_score)
  SELECT sid, s.league, m.match_no, m.source_file_id, m.row_index, m.kickoff_iso, m.match_date_raw,
    m.home_team_id, m.away_team_id, m.ht_home_score, m.ht_away_score, m.home_score, m.away_score
  FROM jsonb_populate_recordset(NULL::public.winmix_matches, p_matches) m
  ON CONFLICT (season_id, match_no) DO UPDATE SET
    league = excluded.league, source_file_id = excluded.source_file_id,
    row_index = excluded.row_index, kickoff_iso = excluded.kickoff_iso,
    match_date_raw = excluded.match_date_raw, home_team_id = excluded.home_team_id,
    away_team_id = excluded.away_team_id, ht_home_score = excluded.ht_home_score,
    ht_away_score = excluded.ht_away_score, home_score = excluded.home_score,
    away_score = excluded.away_score;

  IF p_mode = 'replace' THEN
    DELETE FROM public.winmix_matches m WHERE m.season_id = sid AND NOT EXISTS (
      SELECT 1 FROM jsonb_populate_recordset(NULL::public.winmix_matches, p_matches) incoming
      WHERE incoming.match_no = m.match_no
    );
    GET DIAGNOSTICS removed_count = row_count;
  END IF;

  -- Merge may retain rows outside the incoming set. Validate the resulting season too.
  IF s.order_mode = 'chronological' AND EXISTS (
    SELECT 1 FROM (
      SELECT kickoff_iso, lag(kickoff_iso) OVER (ORDER BY match_no) AS previous
      FROM public.winmix_matches WHERE season_id = sid
    ) ordered WHERE kickoff_iso IS NULL OR kickoff_iso < previous
  ) THEN RAISE EXCEPTION 'Merged season is not chronological'; END IF;

  SELECT count(*) INTO total_count FROM public.winmix_matches WHERE season_id = sid;
  UPDATE public.winmix_seasons SET match_count = total_count WHERE id = sid;

  RETURN jsonb_build_object('seasonId', sid, 'saved', jsonb_array_length(p_matches),
    'totalMatches', total_count, 'removed', removed_count, 'mode', p_mode);
END;
$function$;

REVOKE ALL ON FUNCTION public.winmix_ingest_season_v1(jsonb, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.winmix_ingest_season_v1(jsonb, jsonb, text) TO service_role;