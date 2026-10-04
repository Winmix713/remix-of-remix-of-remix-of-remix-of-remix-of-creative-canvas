/*
# Publish the versioned WinMix ratings view

1. Purpose
- Publishes the SQL ratings view required by the Cloud tier.
- Keeps ratings isolated by the selected data version.

2. View
- `public.view_team_ratings_v3`
- Exposes team name, league, matches played, home/away goal difference,
  points per game, and the stored weight index.

3. Security
- Uses `security_invoker=true`, so the existing RLS policies on source tables
  continue to apply to browser reads.
- Grants SELECT only to anon, authenticated, and service_role.
- No write access or data mutation is added.

4. Important notes
- The view is read-only advisory data for cross-checking.
- It does not alter the local pipeline or bootstrap state.
*/

CREATE OR REPLACE VIEW public.view_team_ratings_v3
WITH (security_invoker = true)
AS
WITH appearances AS (
  SELECT data_version_id, home_team_id AS team_id, league,
    home_score - away_score AS net, true AS is_home,
    CASE WHEN home_score > away_score THEN 3
      WHEN home_score = away_score THEN 1 ELSE 0 END AS points
  FROM public.winmix_matches
  UNION ALL
  SELECT data_version_id, away_team_id AS team_id, league,
    away_score - home_score AS net, false AS is_home,
    CASE WHEN away_score > home_score THEN 3
      WHEN away_score = home_score THEN 1 ELSE 0 END AS points
  FROM public.winmix_matches
)
SELECT
  a.data_version_id,
  t.canonical_key,
  t.display_name,
  t.league,
  count(*) AS total_played,
  coalesce(avg(a.net) FILTER (WHERE a.is_home), 0) AS net_home,
  coalesce(avg(a.net) FILTER (WHERE NOT a.is_home), 0) AS net_away,
  round(avg(a.points), 3) AS ppg,
  t.weight_index AS auto_weight_index
FROM appearances AS a
JOIN public.winmix_teams AS t
  ON t.id = a.team_id AND t.league = a.league
GROUP BY a.data_version_id, t.id, t.canonical_key, t.display_name, t.league, t.weight_index;

GRANT SELECT ON public.view_team_ratings_v3 TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';