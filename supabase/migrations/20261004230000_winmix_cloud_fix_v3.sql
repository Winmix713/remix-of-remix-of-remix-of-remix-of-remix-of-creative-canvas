-- WinMix import for the LIVE versioned schema. No engine-run statistics writes.
-- Requires the existing tables/triggers. Does not create/seal/switch data versions.
BEGIN;

CREATE OR REPLACE FUNCTION public.winmix_normalize_team_key_v3(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog
AS $fn$
  SELECT btrim(regexp_replace(
    regexp_replace(normalize(lower(p_name), NFD), U&'[\0300-\036f]', '', 'g'),
    '[[:space:]]+', ' ', 'g'));
$fn$;
REVOKE ALL ON FUNCTION public.winmix_normalize_team_key_v3(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.winmix_normalize_team_key_v3(text) TO service_role;

CREATE OR REPLACE FUNCTION public.winmix_ingest_season_v3(
  p_season jsonb, p_matches jsonb, p_mode text DEFAULT 'merge'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
SET lock_timeout = '10s'
AS $fn$
DECLARE
  dv public.winmix_data_versions%rowtype;
  s public.winmix_seasons%rowtype;
  old_s public.winmix_seasons%rowtype;
  sid uuid;
  item jsonb;
  field text;
  numeric_value numeric;
  name_row record;
  ids uuid[];
  team_id_value uuid;
  team_map jsonb := '{}'::jsonb;
  resolved jsonb;
  removed_count bigint := 0;
  total_count bigint;
  expected integer;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('merge','replace') THEN RAISE EXCEPTION 'Invalid import mode'; END IF;
  IF jsonb_typeof(p_season) IS DISTINCT FROM 'object' OR jsonb_typeof(p_matches) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid import structure';
  END IF;
  IF jsonb_typeof(p_season->'data_version_id') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'A real data_version_id is required';
  END IF;
  IF jsonb_typeof(p_season->'season_index') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid season_index'; END IF;
  numeric_value := (p_season->>'season_index')::numeric;
  IF numeric_value <> trunc(numeric_value) OR numeric_value NOT BETWEEN 0 AND 2147483647 THEN
    RAISE EXCEPTION 'Invalid season_index';
  END IF;
  s := jsonb_populate_record(NULL::public.winmix_seasons, p_season);
  IF s.league IS NULL OR s.league NOT IN ('angol','spanyol') OR s.name IS NULL OR
     length(btrim(s.name)) NOT BETWEEN 1 AND 256 OR s.file_name IS NULL OR
     length(btrim(s.file_name)) NOT BETWEEN 1 AND 512 OR
     s.order_mode IS NULL OR s.order_mode NOT IN ('source-order','chronological') THEN
    RAISE EXCEPTION 'Invalid season metadata; file_name is required';
  END IF;
  IF s.content_hash IS NOT NULL AND s.content_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid content_hash'; END IF;

  -- A real, explicitly selected draft dataset. Hold the row lock against sealing.
  SELECT * INTO dv FROM public.winmix_data_versions WHERE id=s.data_version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown data_version_id'; END IF;
  IF dv.status <> 'draft' OR dv.is_current THEN RAISE EXCEPTION 'Imports require a non-current draft data version'; END IF;
  expected := least(dv.expected_matches_per_season, 240);
  IF jsonb_array_length(p_matches) NOT BETWEEN 1 AND expected THEN
    RAISE EXCEPTION 'This data version accepts 1..% matches per season', expected;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('winmix-ingest-v3:' || s.data_version_id::text || ':' || s.league || ':' || s.season_index::text,0));
  SELECT * INTO old_s FROM public.winmix_seasons
    WHERE data_version_id=s.data_version_id AND league=s.league AND season_index=s.season_index FOR UPDATE;
  IF FOUND AND p_mode='merge' AND old_s.order_mode IS DISTINCT FROM s.order_mode THEN
    RAISE EXCEPTION 'Changing order_mode requires replace mode';
  END IF;

  -- Validate JSON numeric values BEFORE casting to integer (no fractional rounding).
  FOR item IN SELECT value FROM jsonb_array_elements(p_matches) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid match object'; END IF;
    IF item->>'league' IS DISTINCT FROM s.league THEN RAISE EXCEPTION 'Match league mismatch'; END IF;
    FOREACH field IN ARRAY ARRAY['match_no','home_score','away_score','ht_home_score','ht_away_score','row_index'] LOOP
      IF field IN ('match_no','home_score','away_score') AND (item->field IS NULL OR item->field='null'::jsonb) THEN
        RAISE EXCEPTION 'Missing numeric field: %', field;
      END IF;
      IF item->field IS NOT NULL AND item->field <> 'null'::jsonb THEN
        IF jsonb_typeof(item->field) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid numeric field: %', field; END IF;
        numeric_value := (item->>field)::numeric;
        IF numeric_value <> trunc(numeric_value) OR numeric_value NOT BETWEEN 0 AND 2147483647 THEN
          RAISE EXCEPTION 'Invalid integer: %', field;
        END IF;
        IF field='match_no' AND numeric_value NOT BETWEEN 1 AND expected THEN RAISE EXCEPTION 'Invalid match_no'; END IF;
        IF field IN ('home_score','away_score') AND numeric_value>20 THEN RAISE EXCEPTION 'Goal limit exceeded'; END IF;
      END IF;
    END LOOP;
    FOREACH field IN ARRAY ARRAY['home_team_key','away_team_key','home_team_name','away_team_name'] LOOP
      IF jsonb_typeof(item->field) IS DISTINCT FROM 'string' OR length(btrim(item->>field)) NOT BETWEEN 1 AND 256 THEN
        RAISE EXCEPTION 'Invalid team field: %', field;
      END IF;
    END LOOP;
    IF (item->>'home_team_key') IS NOT DISTINCT FROM (item->>'away_team_key') THEN RAISE EXCEPTION 'Same team on both sides'; END IF;
    IF (item->>'ht_home_score' IS NULL) <> (item->>'ht_away_score' IS NULL) THEN RAISE EXCEPTION 'Incomplete half-time score'; END IF;
    IF (item->>'ht_home_score')::integer > (item->>'home_score')::integer OR
       (item->>'ht_away_score')::integer > (item->>'away_score')::integer THEN RAISE EXCEPTION 'Half-time exceeds full-time'; END IF;
    IF item->>'row_index' IS NOT NULL AND (item->>'row_index')::integer<0 THEN RAISE EXCEPTION 'Invalid row_index'; END IF;
    IF s.order_mode='chronological' AND item->>'kickoff_iso' IS NULL THEN RAISE EXCEPTION 'kickoff_iso is required'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_matches) item GROUP BY (item->>'match_no')::integer HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Duplicate match_no';
  END IF;
  IF s.order_mode='chronological' AND EXISTS (
    SELECT 1 FROM (SELECT (item->>'kickoff_iso')::timestamptz AS kickoff,
      lag((item->>'kickoff_iso')::timestamptz) OVER (ORDER BY (item->>'match_no')::integer) AS previous
      FROM jsonb_array_elements(p_matches) item) ordered WHERE kickoff<previous
  ) THEN RAISE EXCEPTION 'Invalid chronological order'; END IF;

  -- Match existing league-scoped names first; prefix new canonical keys because
  -- the live schema ALSO has UNIQUE(canonical_key) across both leagues.
  FOR name_row IN
    SELECT key, min(name) AS display_name FROM (
      SELECT item->>'home_team_key' AS key,item->>'home_team_name' AS name FROM jsonb_array_elements(p_matches) item
      UNION ALL
      SELECT item->>'away_team_key',item->>'away_team_name' FROM jsonb_array_elements(p_matches) item
    ) names GROUP BY key ORDER BY key
  LOOP
    SELECT array_agg(t.id ORDER BY t.id) INTO ids FROM public.winmix_teams t
    WHERE t.league=s.league AND (
      t.canonical_key IN (name_row.key,s.league || ':' || name_row.key) OR
      public.winmix_normalize_team_key_v3(t.display_name)=name_row.key);
    IF coalesce(cardinality(ids),0)>1 THEN RAISE EXCEPTION 'Ambiguous team mapping: %',name_row.key; END IF;
    IF coalesce(cardinality(ids),0)=0 THEN
      -- Use the existing database defaults: weight_index=5.0, weight_source=auto.
      INSERT INTO public.winmix_teams(league,canonical_key,display_name)
      VALUES(s.league,s.league || ':' || name_row.key,name_row.display_name)
      ON CONFLICT (canonical_key) DO NOTHING;
      SELECT id INTO team_id_value FROM public.winmix_teams
        WHERE league=s.league AND canonical_key=s.league || ':' || name_row.key;
      IF NOT FOUND THEN RAISE EXCEPTION 'Canonical team key collision: %',name_row.key; END IF;
    ELSE team_id_value := ids[1]; END IF;
    team_map := team_map || jsonb_build_object(name_row.key,team_id_value);
  END LOOP;
  SELECT jsonb_agg((item - 'home_team_key' - 'away_team_key' - 'home_team_name' - 'away_team_name') ||
    jsonb_build_object('home_team_id',team_map->(item->>'home_team_key'),
      'away_team_id',team_map->(item->>'away_team_key')) ORDER BY ordinal)
  INTO resolved FROM jsonb_array_elements(p_matches) WITH ORDINALITY input(item,ordinal);
  IF EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::public.winmix_matches,resolved) m
    WHERE m.home_team_id=m.away_team_id) THEN RAISE EXCEPTION 'Both aliases map to the same team'; END IF;

  INSERT INTO public.winmix_seasons AS target
    (data_version_id,league,season_index,name,file_name,content_hash,match_count,order_mode)
  VALUES(s.data_version_id,s.league,s.season_index,s.name,s.file_name,
    CASE WHEN p_mode='replace' THEN s.content_hash ELSE NULL END,0,s.order_mode)
  ON CONFLICT(data_version_id,league,season_index) DO UPDATE SET
    name=excluded.name,file_name=excluded.file_name,content_hash=excluded.content_hash,order_mode=excluded.order_mode
  RETURNING id INTO sid;
  INSERT INTO public.winmix_matches
    (data_version_id,season_id,league,match_no,source_file_id,row_index,kickoff_iso,match_date_raw,
      home_team_id,away_team_id,ht_home_score,ht_away_score,home_score,away_score)
  SELECT s.data_version_id,sid,s.league,m.match_no,m.source_file_id,m.row_index,m.kickoff_iso,m.match_date_raw,
    m.home_team_id,m.away_team_id,m.ht_home_score,m.ht_away_score,m.home_score,m.away_score
  FROM jsonb_populate_recordset(NULL::public.winmix_matches,resolved) m
  ON CONFLICT(season_id,match_no) DO UPDATE SET
    source_file_id=excluded.source_file_id,row_index=excluded.row_index,kickoff_iso=excluded.kickoff_iso,
    match_date_raw=excluded.match_date_raw,home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,
    ht_home_score=excluded.ht_home_score,ht_away_score=excluded.ht_away_score,
    home_score=excluded.home_score,away_score=excluded.away_score;
  IF p_mode='replace' THEN
    DELETE FROM public.winmix_matches m WHERE m.season_id=sid AND m.data_version_id=s.data_version_id
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(resolved) incoming WHERE (incoming->>'match_no')::integer=m.match_no);
    GET DIAGNOSTICS removed_count=ROW_COUNT;
  END IF;
  IF s.order_mode='chronological' AND EXISTS (
    SELECT 1 FROM (SELECT kickoff_iso,lag(kickoff_iso) OVER(ORDER BY match_no) AS previous
      FROM public.winmix_matches WHERE season_id=sid AND data_version_id=s.data_version_id) ordered
    WHERE kickoff_iso IS NULL OR kickoff_iso<previous
  ) THEN RAISE EXCEPTION 'Merged season is not chronological'; END IF;
  SELECT count(*) INTO total_count FROM public.winmix_matches WHERE season_id=sid AND data_version_id=s.data_version_id;
  IF total_count>expected THEN RAISE EXCEPTION 'Merged season exceeds the version match limit'; END IF;
  UPDATE public.winmix_seasons SET match_count=total_count WHERE id=sid AND data_version_id=s.data_version_id;
  -- Do not update dataset metadata, seal it, change is_current or write run stats.
  RETURN jsonb_build_object('seasonId',sid,'dataVersionId',s.data_version_id,'saved',jsonb_array_length(resolved),
    'totalMatches',total_count,'removed',removed_count,'mode',p_mode,'statsRefreshed',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.winmix_ingest_season_v3(jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.winmix_ingest_season_v3(jsonb,jsonb,text) TO service_role;
GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated;
GRANT SELECT,UPDATE ON public.winmix_data_versions TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.winmix_teams,public.winmix_seasons,public.winmix_matches TO service_role;

-- Explicit data-version dimension. Draft/sealed versions are never mixed.
CREATE OR REPLACE VIEW public.view_team_ratings_v3 WITH(security_invoker=true) AS
WITH appearances AS (
  SELECT data_version_id,home_team_id AS team_id,league,home_score-away_score AS net,true AS is_home,
    CASE WHEN home_score>away_score THEN 3 WHEN home_score=away_score THEN 1 ELSE 0 END AS points
  FROM public.winmix_matches
  UNION ALL
  SELECT data_version_id,away_team_id,league,away_score-home_score,false,
    CASE WHEN away_score>home_score THEN 3 WHEN away_score=home_score THEN 1 ELSE 0 END
  FROM public.winmix_matches
)
SELECT a.data_version_id,t.canonical_key,t.display_name,t.league,count(*) AS total_played,
  coalesce(avg(a.net) FILTER(WHERE a.is_home),0) AS net_home,
  coalesce(avg(a.net) FILTER(WHERE NOT a.is_home),0) AS net_away,
  round(avg(a.points),3) AS ppg,t.weight_index AS auto_weight_index
FROM appearances a JOIN public.winmix_teams t ON t.id=a.team_id AND t.league=a.league
GROUP BY a.data_version_id,t.id,t.canonical_key,t.display_name,t.league,t.weight_index;
GRANT SELECT ON public.view_team_ratings_v3,public.winmix_teams,public.winmix_matches TO anon,authenticated;
-- Existing RLS policies still apply; this migration does not broaden them.
NOTIFY pgrst,'reload schema';
COMMIT;
