/*
# WinMix data versioning v3 — adapt live schema for versioned imports

1. Purpose
   The v3 migration from the patch package assumes columns that don't exist yet
   on the live database: winmix_data_versions.is_current, expected_matches_per_season,
   version_key. It also assumes winmix_seasons has a unique constraint on
   (data_version_id, league, season_index) instead of the current (league, season_index).
   This migration adds the missing columns and creates the correct composite unique
   index so the v3 RPC can function.

2. Modified Tables
   - winmix_data_versions: added is_current (boolean default false),
     expected_matches_per_season (int default 240), version_key (text, nullable).
   - winmix_seasons: new unique index on (data_version_id, league, season_index).
     The old (league, season_index) unique index is dropped because it prevents
     multiple data versions from sharing the same season index.

3. Backfill
   - The existing 'Default' data version is marked is_current = true.
*/

ALTER TABLE public.winmix_data_versions ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;
ALTER TABLE public.winmix_data_versions ADD COLUMN IF NOT EXISTS expected_matches_per_season int NOT NULL DEFAULT 240;
ALTER TABLE public.winmix_data_versions ADD COLUMN IF NOT EXISTS version_key text;

UPDATE public.winmix_data_versions SET is_current = true, status = 'published' WHERE label = 'Default';

DROP INDEX IF EXISTS public.winmix_ingest_season_identity_uq;
DROP INDEX IF EXISTS public.winmix_seasons_league_season_uq;
CREATE UNIQUE INDEX IF NOT EXISTS winmix_seasons_dv_league_season_uq
  ON public.winmix_seasons (data_version_id, league, season_index);