-- Run against a staging/local database AFTER all three migrations.
-- Test writes are rolled back. No existing season is touched.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  token text := 'test-' || gen_random_uuid()::text;
  season_index_value int := 2000000000 + floor(random()*100000000)::int;
  season_data jsonb;
  result jsonb;
  sid uuid;
  rating record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.winmix_seasons WHERE league='angol' AND season_index=season_index_value) THEN
    RAISE EXCEPTION 'Test season collision; rerun';
  END IF;
  season_data := jsonb_build_object('league','angol','season_index',season_index_value,'name',token,'order_mode','source-order');
  result := public.winmix_ingest_season_v2(season_data, jsonb_build_array(
    jsonb_build_object('league','angol','match_no',1,'home_team_key',token||'-a','away_team_key',token||'-b',
      'home_team_name','Test A','away_team_name','Test B','home_score',3,'away_score',1)
  ), 'merge');
  sid := (result->>'seasonId')::uuid;
  IF (SELECT count(*) FROM public.winmix_team_season_stats WHERE season_id=sid) <> 2 THEN RAISE EXCEPTION 'Stats missing'; END IF;
  SELECT * INTO rating FROM public.view_team_ratings_v2 WHERE canonical_key=token||'-a' AND league='angol';
  IF rating.net_home <> 2 OR rating.ppg <> 3 OR rating.total_played <> 1 THEN RAISE EXCEPTION 'Incorrect rating'; END IF;
  -- Replaying merge must not inflate counts.
  PERFORM public.winmix_ingest_season_v2(season_data, jsonb_build_array(
    jsonb_build_object('league','angol','match_no',1,'home_team_key',token||'-a','away_team_key',token||'-b',
      'home_team_name','Test A','away_team_name','Test B','home_score',3,'away_score',1)
  ), 'merge');
  IF (SELECT sum(played) FROM public.winmix_team_season_stats WHERE season_id=sid) <> 2 THEN RAISE EXCEPTION 'Merge inflated stats'; END IF;
  -- Same team on both sides fails in v1 after team insertion in v2.
  -- The exception subtransaction must remove that new team too.
  BEGIN
    PERFORM public.winmix_ingest_season_v2(season_data, jsonb_build_array(
      jsonb_build_object('league','angol','match_no',2,'home_team_key',token||'-invalid','away_team_key',token||'-invalid',
        'home_team_name','Invalid','away_team_name','Invalid','home_score',0,'away_score',0)
    ), 'merge');
    RAISE EXCEPTION 'Expected validation failure' USING ERRCODE='ZX001';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.winmix_teams WHERE canonical_key=token||'-invalid') THEN RAISE EXCEPTION 'Orphan team persisted'; END IF;
  IF has_function_privilege('anon','public.winmix_ingest_season_v2(jsonb,jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'Anon can execute import'; END IF;
  RAISE NOTICE 'PASS: stats, ratings, replay, team rollback, RPC permissions';
END $$;
ROLLBACK;
