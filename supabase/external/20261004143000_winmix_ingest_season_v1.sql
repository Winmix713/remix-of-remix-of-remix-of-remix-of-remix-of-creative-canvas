-- Assumes the existing public.winmix_* tables and the columns used by the original importer.
-- Run through Supabase migrations or SQL Editor; do not expose this RPC to anon/authenticated.
begin;

-- Abort if duplicate keys already exist; this migration never deletes existing duplicates.
create unique index if not exists winmix_ingest_season_identity_uq
  on public.winmix_seasons (league, season_index);
create unique index if not exists winmix_ingest_match_identity_uq
  on public.winmix_matches (season_id, match_no);

create or replace function public.winmix_ingest_season_v1(
  p_season jsonb,
  p_matches jsonb,
  p_mode text default 'merge'
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
set lock_timeout = '10s'
as $function$
declare
  s public.winmix_seasons%rowtype;
  old_s public.winmix_seasons%rowtype;
  sid public.winmix_seasons.id%type;
  total_count bigint;
  removed_count bigint := 0;
begin
  if p_mode is null or p_mode not in ('merge', 'replace') then
    raise exception 'Invalid import mode';
  end if;
  if jsonb_typeof(p_season) is distinct from 'object' or
     jsonb_typeof(p_matches) is distinct from 'array' then
    raise exception 'Invalid import structure';
  end if;
  if jsonb_array_length(p_matches) not between 1 and 2000 then
    raise exception 'Invalid match count';
  end if;
  s := jsonb_populate_record(null::public.winmix_seasons, p_season);
  if s.league is null or s.league not in ('angol', 'spanyol') or
     s.season_index is null or s.season_index < 0 or
     s.name is null or btrim(s.name) = '' or
     s.order_mode is null or s.order_mode not in ('source-order', 'chronological') then
    raise exception 'Invalid season metadata';
  end if;

  -- Serialize imports of the same season, including the first insert.
  perform pg_advisory_xact_lock(hashtextextended('winmix-ingest:' || s.league || ':' || s.season_index::text, 0));
  select * into old_s from public.winmix_seasons
    where league = s.league and season_index = s.season_index for update;
  if found and p_mode = 'merge' and old_s.order_mode is distinct from s.order_mode then
    raise exception 'Changing order_mode requires replace mode';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_matches) e
    where jsonb_typeof(e) is distinct from 'object'
  ) then raise exception 'Invalid match object'; end if;
  if exists (
    select 1 from jsonb_populate_recordset(null::public.winmix_matches, p_matches) m
    left join public.winmix_teams h on h.id = m.home_team_id and h.league = s.league
    left join public.winmix_teams a on a.id = m.away_team_id and a.league = s.league
    where m.league is distinct from s.league or m.match_no is null or m.match_no not between 1 and 2000
      or h.id is null or a.id is null or h.id = a.id
      or m.home_score is null or m.away_score is null
      or m.home_score not between 0 and 20 or m.away_score not between 0 and 20
      or m.home_score <> trunc(m.home_score::numeric) or m.away_score <> trunc(m.away_score::numeric)
      or (m.ht_home_score is null) <> (m.ht_away_score is null)
      or (m.ht_home_score is not null and (
        m.ht_home_score not between 0 and m.home_score or m.ht_away_score not between 0 and m.away_score
        or m.ht_home_score <> trunc(m.ht_home_score::numeric)
        or m.ht_away_score <> trunc(m.ht_away_score::numeric)))
      or (m.row_index is not null and m.row_index < 0)
      or (s.order_mode = 'chronological' and m.kickoff_iso is null)
  ) then raise exception 'Invalid match values or team league'; end if;
  if exists (
    select match_no from jsonb_populate_recordset(null::public.winmix_matches, p_matches)
    group by match_no having count(*) > 1
  ) then raise exception 'Duplicate match_no'; end if;
  if s.order_mode = 'chronological' and exists (
    select 1 from (
      select kickoff_iso, lag(kickoff_iso) over (order by match_no) as previous
      from jsonb_populate_recordset(null::public.winmix_matches, p_matches)
    ) ordered where kickoff_iso < previous
  ) then raise exception 'Invalid chronological order'; end if;

  insert into public.winmix_seasons as target
    (league, season_index, name, file_name, content_hash, match_count, order_mode)
  values (s.league, s.season_index, s.name, s.file_name,
    case when p_mode = 'replace' then s.content_hash else null end, jsonb_array_length(p_matches), s.order_mode)
  on conflict (league, season_index) do update set
    name = excluded.name, file_name = excluded.file_name,
    content_hash = excluded.content_hash, order_mode = excluded.order_mode
  returning id into sid;

  insert into public.winmix_matches
    (season_id, league, match_no, source_file_id, row_index, kickoff_iso, match_date_raw,
     home_team_id, away_team_id, ht_home_score, ht_away_score, home_score, away_score)
  select sid, s.league, m.match_no, m.source_file_id, m.row_index, m.kickoff_iso, m.match_date_raw,
    m.home_team_id, m.away_team_id, m.ht_home_score, m.ht_away_score, m.home_score, m.away_score
  from jsonb_populate_recordset(null::public.winmix_matches, p_matches) m
  on conflict (season_id, match_no) do update set
    league = excluded.league, source_file_id = excluded.source_file_id,
    row_index = excluded.row_index, kickoff_iso = excluded.kickoff_iso,
    match_date_raw = excluded.match_date_raw, home_team_id = excluded.home_team_id,
    away_team_id = excluded.away_team_id, ht_home_score = excluded.ht_home_score,
    ht_away_score = excluded.ht_away_score, home_score = excluded.home_score, away_score = excluded.away_score;

  if p_mode = 'replace' then
    delete from public.winmix_matches m where m.season_id = sid and not exists (
      select 1 from jsonb_populate_recordset(null::public.winmix_matches, p_matches) incoming
      where incoming.match_no = m.match_no
    );
    get diagnostics removed_count = row_count;
  end if;

  -- Merge may retain rows outside the incoming set. Validate the resulting season too.
  if s.order_mode = 'chronological' and exists (
    select 1 from (
      select kickoff_iso, lag(kickoff_iso) over (order by match_no) as previous
      from public.winmix_matches where season_id = sid
    ) ordered where kickoff_iso is null or kickoff_iso < previous
  ) then raise exception 'Merged season is not chronological'; end if;
  select count(*) into total_count from public.winmix_matches where season_id = sid;
  update public.winmix_seasons set match_count = total_count where id = sid;
  return jsonb_build_object('seasonId', sid, 'saved', jsonb_array_length(p_matches),
    'totalMatches', total_count, 'removed', removed_count, 'mode', p_mode);
end;
$function$;

revoke all on function public.winmix_ingest_season_v1(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.winmix_ingest_season_v1(jsonb, jsonb, text) to service_role;
commit;
