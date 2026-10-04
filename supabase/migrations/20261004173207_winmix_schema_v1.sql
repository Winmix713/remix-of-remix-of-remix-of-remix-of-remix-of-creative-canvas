/*
# WinMix core schema — teams, seasons, matches, season stats, ratings view

1. Purpose
   Creates the full database schema the WinMix app expects for its optional
   read-only cloud tier. The browser client (anon key) can SELECT from all
   tables and the ratings view. Writes happen only through the winmix-ingest
   edge function, which uses the service-role key and the winmix_ingest_season_v1
   RPC — never direct client writes.

2. New Tables
   - `winmix_teams` — one row per team per league. Columns: id (uuid PK),
     league (text: 'angol' | 'spanyol'), canonical_key (text, normalised name),
     display_name (text, human-readable name), weight_index (int, default 50),
     created_at (timestamptz default now()).
   - `winmix_seasons` — one row per season per league. Columns: id (uuid PK),
     league (text), season_index (int), name (text), file_name (text, nullable),
     content_hash (text, nullable), match_count (int, default 0),
     order_mode (text: 'source-order' | 'chronological'), created_at (timestamptz default now()).
     Unique constraint on (league, season_index).
   - `winmix_matches` — individual match results. Columns: id (uuid PK),
     season_id (uuid FK → winmix_seasons ON DELETE CASCADE),
     league (text), match_no (int), source_file_id (text, nullable),
     row_index (int, nullable), kickoff_iso (timestamptz, nullable),
     match_date_raw (text, nullable),
     home_team_id (uuid FK → winmix_teams), away_team_id (uuid FK → winmix_teams),
     ht_home_score (int, nullable), ht_away_score (int, nullable),
     home_score (int), away_score (int), created_at (timestamptz default now()).
     Unique constraint on (season_id, match_no).
   - `winmix_team_season_stats` — per-team per-season aggregate stats.
     Columns: id (uuid PK), team_id (uuid FK → winmix_teams ON DELETE CASCADE),
     season_id (uuid FK → winmix_seasons ON DELETE CASCADE),
     league (text), played (int), wins (int, default 0), draws (int, default 0),
     losses (int, default 0), goals_for (int, default 0), goals_against (int, default 0),
     points (int, default 0), created_at (timestamptz default now()).
     Unique constraint on (team_id, season_id).

3. New View
   - `view_team_ratings` — aggregates team ratings across all seasons for the
     cloud tier's advisory cross-check. Columns: canonical_key, display_name,
     league, total_played, net_home, net_away, ppg, auto_weight_index.

4. Security
   - RLS enabled on all four tables.
   - Anon + authenticated get SELECT-only access (the cloud tier is read-only
     from the browser; writes go through the edge function with the service role
     key, which bypasses RLS).
   - No INSERT/UPDATE/DELETE policies for anon — the edge function uses the
     service-role key, not the anon key.

5. Important Notes
   - The `winmix_ingest_season_v1` RPC is created in a separate migration
     because it depends on these tables existing first.
   - The unique indexes on (league, season_index) and (season_id, match_no)
     are required by the ingest RPC's ON CONFLICT clauses.
*/

-- ── winmix_teams ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS winmix_teams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league        text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  canonical_key text NOT NULL,
  display_name  text NOT NULL,
  weight_index  int  NOT NULL DEFAULT 50,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS winmix_teams_league_canonical_uq
  ON winmix_teams (league, canonical_key);

ALTER TABLE winmix_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_winmix_teams" ON winmix_teams;
CREATE POLICY "anon_select_winmix_teams"
  ON winmix_teams FOR SELECT
  TO anon, authenticated USING (true);

-- ── winmix_seasons ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS winmix_seasons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league        text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  season_index  int  NOT NULL,
  name          text NOT NULL,
  file_name     text,
  content_hash  text,
  match_count   int  NOT NULL DEFAULT 0,
  order_mode    text NOT NULL DEFAULT 'source-order' CHECK (order_mode IN ('source-order', 'chronological')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS winmix_seasons_league_season_uq
  ON winmix_seasons (league, season_index);

ALTER TABLE winmix_seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_winmix_seasons" ON winmix_seasons;
CREATE POLICY "anon_select_winmix_seasons"
  ON winmix_seasons FOR SELECT
  TO anon, authenticated USING (true);

-- ── winmix_matches ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS winmix_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       uuid NOT NULL REFERENCES winmix_seasons(id) ON DELETE CASCADE,
  league          text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  match_no        int  NOT NULL,
  source_file_id  text,
  row_index       int,
  kickoff_iso     timestamptz,
  match_date_raw  text,
  home_team_id    uuid NOT NULL REFERENCES winmix_teams(id),
  away_team_id    uuid NOT NULL REFERENCES winmix_teams(id),
  ht_home_score   int,
  ht_away_score   int,
  home_score      int  NOT NULL,
  away_score      int  NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS winmix_matches_season_matchno_uq
  ON winmix_matches (season_id, match_no);
CREATE INDEX IF NOT EXISTS winmix_matches_league_idx ON winmix_matches (league);
CREATE INDEX IF NOT EXISTS winmix_matches_home_team_idx ON winmix_matches (home_team_id);
CREATE INDEX IF NOT EXISTS winmix_matches_away_team_idx ON winmix_matches (away_team_id);

ALTER TABLE winmix_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_winmix_matches" ON winmix_matches;
CREATE POLICY "anon_select_winmix_matches"
  ON winmix_matches FOR SELECT
  TO anon, authenticated USING (true);

-- ── winmix_team_season_stats ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS winmix_team_season_stats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES winmix_teams(id) ON DELETE CASCADE,
  season_id     uuid NOT NULL REFERENCES winmix_seasons(id) ON DELETE CASCADE,
  league        text NOT NULL CHECK (league IN ('angol', 'spanyol')),
  played        int  NOT NULL DEFAULT 0,
  wins          int  NOT NULL DEFAULT 0,
  draws         int  NOT NULL DEFAULT 0,
  losses        int  NOT NULL DEFAULT 0,
  goals_for     int  NOT NULL DEFAULT 0,
  goals_against int  NOT NULL DEFAULT 0,
  points        int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS winmix_team_season_stats_team_season_uq
  ON winmix_team_season_stats (team_id, season_id);
CREATE INDEX IF NOT EXISTS winmix_team_season_stats_league_idx ON winmix_team_season_stats (league);

ALTER TABLE winmix_team_season_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_winmix_team_season_stats" ON winmix_team_season_stats;
CREATE POLICY "anon_select_winmix_team_season_stats"
  ON winmix_team_season_stats FOR SELECT
  TO anon, authenticated USING (true);

-- ── view_team_ratings ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW view_team_ratings AS
SELECT
  t.canonical_key,
  t.display_name,
  t.league,
  COALESCE(SUM(s.played), 0)                       AS total_played,
  COALESCE(SUM(s.goals_for - s.goals_against), 0)  AS net_home,
  COALESCE(SUM(s.goals_against - s.goals_for), 0)  AS net_away,
  CASE WHEN COALESCE(SUM(s.played), 0) > 0
       THEN ROUND(CAST(SUM(s.points) AS numeric) / SUM(s.played), 3)
       ELSE 0 END                                   AS ppg,
  t.weight_index                                    AS auto_weight_index
FROM winmix_teams t
LEFT JOIN winmix_team_season_stats s ON s.team_id = t.id
GROUP BY t.id, t.canonical_key, t.display_name, t.league, t.weight_index;
