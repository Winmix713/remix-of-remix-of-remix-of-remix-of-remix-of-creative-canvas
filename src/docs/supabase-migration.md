# WinMix × Supabase — teljes integrációs kézikönyv

> **Projekt:** `oaadhaapbgzyibyadgdh` (Lovable Cloud) · **Végpont:** `https://oaadhaapbgzyibyadgdh.supabase.co/rest/v1`
> **Kulcs:** publishable (`sb_publishable_…`) — böngészőbiztos, RLS mögött, **csak olvasás**.

Ez a dokumentum egyben referencia (séma, nézetek, RLS), üzemeltetési kézikönyv
(betöltés, keresztellenőrzés, hibaelhárítás) és szerződés (mit szabad és mit nem
szabad a felhő tiernek csinálnia). Aki a WinMix felhő rétegéhez nyúl, ezt olvassa
el először.

---

## 0. Vezérelv — a felhő tier additív, sosem helyettesítő

A WinMix **offline-first** alkalmazás. Az igazság forrása a böngésző
`localStorage`-ában él (`winmix-pipeline-v2-state`), a katasztrófa-visszaállítás
útja pedig a JSON export/import — nem a felhő.

| | Helyi tier (kötelező) | Felhő tier (opcionális) |
|---|---|---|
| Tárolás | `localStorage` + `sessionStorage` checkpoint | Postgres (Supabase) |
| Írás | igen, teljes | **soha** a kliensből |
| Kulcs | – | publishable, RLS mögött |
| Pipeline-bemenet | igen | **soha** |
| Kiesés hatása | az app használhatatlan | semmi, csak egy szalagcím |

**Négy szabály, amit kód nem hághat át:**

1. A kliens **kizárólag** a publishable/anon kulcsot ismeri. A `service_role`
   kulcs szerveroldali titok (ingesztáló CLI / edge function), és soha nem
   kerülhet a repóba, a `.env`-be vagy bundle-be.
2. A kliens **soha nem ír** Supabase-be. Az RLS is csak `select`-et enged.
3. Bármilyen hiba (nincs konfigurálva, offline, timeout, RLS-elutasítás) esetén
   a munkamenet véglegesen `local` módra vált, és szalagcímet mutat.
4. Az SQL-ből érkező szám **tájékoztató**: megjelenik és diffelődik, de sosem
   kerül be a pipeline-ba, a joint score mátrixba vagy a seeded bootstrapbe.

---

## 1. Kapcsolat beállítása

### 1.1 Környezeti változók

`.env` (és `.env.local`, ha felül akarod írni):

```dotenv
VITE_SUPABASE_URL=https://oaadhaapbgzyibyadgdh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_juS6O5xPz0l61tz7c4nAyw_9cFO5bnx
```

- A `VITE_` prefix kötelező, különben a Vite nem teszi be a bundle-be.
- A gyökér `.env`-et a Lovable Cloud generálja (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`) — **ne szerkeszd kézzel**. A történelmi
  `VITE_SUPABASE_ANON_KEY` név továbbra is elfogadott fallbackként.
- A kulcs a **`apikey` headerbe** kell. Az `sb_publishable_…` kulcs opak
  string, nem JWT — a `utils/supabaseTier.ts` ezért **nem** küldi
  `Authorization: Bearer`-ként (az `HTTP 401 "Expected 3 parts in JWT"`-t adna);
  csak a régi `eyJ…` anon JWT kerül Bearer-be is.
- A `.env` fájl elhagyása **nem** hiba: `utils/cloudConfig.ts` tartalmaz egy
  beépített publishable fallbacket, hogy preview/sandbox buildben is működjön.
  A feloldás sorrendje: `.env` → beépített fallback → `null` (unconfigured).
- **A jelenlegi buildben a `null` ág nem érhető el.** A `FALLBACK_URL` és a
  `FALLBACK_ANON_KEY` nem üres literál, ezért `readCloudEnv()` mindig ad
  konfigurációt, és `isCloudTierConfigured()` mindig `true`. Az `unconfigured`
  állapot csak akkor következhet be, ha valaki kiüríti vagy elrontja ezeket a
  konstansokat (pl. stripped build). Az alábbi állapotgép tehát az `unconfigured`
  ágat *lehetséges*, de a jelen konfiguráció mellett nem előforduló állapotként
  írja le.

### 1.2 A kliensoldali réteg térképe

| Fájl | Felelősség |
|---|---|
| `utils/cloudConfig.ts` | Kulcs- és URL-feloldás, `readCloudEnv()`, forrásjelzés (`env` \| `fallback`) |
| `utils/supabaseTier.ts` | `restGet()`, `probeCloudTier()`, `fetchCloudTeamRatings()`, `cloudEndpointSummary()`, HTTP-hibák magyar fordítása |
| `hooks/useCloudTier.ts` | Állapotgép: `health`, `configured`, `ratings`, `refresh()`, `retry()`, `loadRatings(league)`, sticky degradálás |
| `contexts/CloudTierContext.tsx` | Provider — a `WinmixProvider` **testvére**, nem függősége |
| `components/winmix/ops/CloudTierTab.tsx` | A fül tényleges implementációja: állapotfelirat, végpont, betöltés gomb, diff-tábla |
| `pages/PipelineOperationsDashboard.tsx` | A „Felhő tier & keresztellenőrzés" fül beillesztése, `league` és `crossCheck` átadása |

Nincs `@supabase/supabase-js` függőség: a tier nyers `fetch`-csel beszél a
PostgREST-tel. Ez szándékos — nincs auth/realtime/storage felület, amin
véletlenül írni lehetne, és nincs plusz bundle-méret.

### 1.3 Állapotgép

```
unconfigured ──(kulcs megjelenik)──► probing ──► online ──► degraded
      ▲                                             │          │
      └──────────────── retry() ────────────────────┴──────────┘
```

- `probing`: mount után azonnal, `probeCloudTier()` fut (4 s timeout). A UI ezt
  külön jeleníti meg („kapcsolat ellenőrzése…", pulzáló felhő ikon), és amíg tart,
  az „SQL értékelés betöltése" gomb le van tiltva.
- `online`: a `view_team_ratings` (vagy fallbackként a REST gyökér) elérhető.
- `degraded`: **sticky** a munkamenetre. A „Kapcsolat újrapróbálása" gomb
  (`retry()`) törli a sticky jelzőt, és újraszondáz — így kulcscsere után nem
  kell újratölteni az oldalt.

---

## 2. Fázis 1 — séma, RLS, nézetek

> **Állapot: alkalmazva** a Lovable Cloud projektre (2026‑09‑02, migrációval).
> Mivel a projektben már léteztek más célú `teams` / `matches` táblák, a WinMix
> táblák **`winmix_` előtaggal** jöttek létre. A `view_team_ratings` nézet neve
> változatlan — a kliens csak ezt olvassa. A nézet `security_invoker = true`
> opcióval fut, így az alaptáblák RLS-e mindig érvényesül.

A séma tükrözi a `types/winmix.ts` alakjait; ahol eltér, azt jelezzük.

### 2.1 Táblák

```sql
-- Csapatok: a kanonikus kulcs a WinMix canon() függvényének eredménye.
create table if not exists public.winmix_teams (
  id            uuid primary key default gen_random_uuid(),
  league        text not null check (league in ('angol','spanyol')),
  canonical_key text not null,
  display_name  text not null,
  weight_index  numeric(4,1) not null default 5.0 check (weight_index between 0 and 10),
  weight_source text not null default 'auto' check (weight_source in ('auto','manual')),
  updated_at    timestamptz not null default now(),
  unique (league, canonical_key)
);

-- Szezonok: 1:1 a Season interfésszel (a matches[] külön táblában).
create table if not exists public.winmix_seasons (
  id           uuid primary key default gen_random_uuid(),
  league       text not null check (league in ('angol','spanyol')),
  season_index int  not null,
  name         text not null,
  file_name    text not null,
  content_hash text,
  match_count  int  not null default 0,
  order_mode   text not null default 'chronological'
               check (order_mode in ('chronological','source-order')),
  created_at   timestamptz not null default now(),
  unique (league, season_index)
);

-- Mérkőzések: a derivált mezők GENERATED oszlopok, hogy ne lehessen
-- inkonzisztens sort beírni (a TS oldalon ugyanezt a pipeline számolja).
create table if not exists public.winmix_matches (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references public.winmix_seasons(id) on delete cascade,
  league         text not null check (league in ('angol','spanyol')),
  match_no       int  not null,
  source_file_id text,
  row_index      int,
  kickoff_iso    timestamptz,
  match_date_raw text,                     -- a nyers `date` mező, sosem felülírva
  home_team_id   uuid not null references public.winmix_teams(id),
  away_team_id   uuid not null references public.winmix_teams(id),
  ht_home_score  int check (ht_home_score >= 0),
  ht_away_score  int check (ht_away_score >= 0),
  home_score     int not null check (home_score >= 0),
  away_score     int not null check (away_score >= 0),
  total_goals    int generated always as (home_score + away_score) stored,
  btts           boolean generated always as (home_score > 0 and away_score > 0) stored,
  outcome        text generated always as (
                   case when home_score > away_score then 'H'
                        when home_score < away_score then 'A'
                        else 'D' end) stored,
  created_at     timestamptz not null default now(),
  -- félidő sosem lehet több a végeredménynél
  constraint ht_le_ft check (
    (ht_home_score is null or ht_home_score <= home_score) and
    (ht_away_score is null or ht_away_score <= away_score)
  ),
  unique (season_id, match_no)
);

create index if not exists matches_league_idx      on public.winmix_matches (league);
create index if not exists matches_home_team_idx   on public.winmix_matches (home_team_id);
create index if not exists matches_away_team_idx   on public.winmix_matches (away_team_id);
create index if not exists matches_kickoff_idx     on public.winmix_matches (kickoff_iso);
```

### 2.2 Opcionális: pipeline checkpointok

Kizárólag **diagnosztikai archívum** — a kliens `sessionStorage`-ból dolgozik
(`utils/checkpointStore.ts`), ide csak a szerveroldali ingesztálás írhat.

```sql
create table if not exists public.winmix_pipeline_checkpoints (
  league                 text primary key check (league in ('angol','spanyol')),
  feature_schema_version int  not null,
  processed_match_count  int  not null,
  prefix_signature       text not null,
  weights_signature      text not null,
  experiments_key        text not null,
  history_scope          text not null check (history_scope in ('season-only','league-cumulative')),
  calibration_t          numeric,
  ensemble_w_m1          numeric,
  ensemble_tuned         boolean,
  m1_fit                 jsonb,
  calib_history          jsonb,
  fit_history            jsonb,
  saved_at               timestamptz not null default now()
);
```

A nagy mintatömbök (`m1_samples`, `calib_sample`, `ens_samples`) szándékosan
kimaradtak: több MB-os payloadok, amiket a kliens úgyis újraszámol.

### 2.3 RLS — kötelező

**Bekapcsolás nélkül a publishable kulcs mindent kiír.** Ez nem opcionális lépés.

```sql
alter table public.winmix_teams                enable row level security;
alter table public.winmix_seasons              enable row level security;
alter table public.winmix_matches              enable row level security;
alter table public.winmix_pipeline_checkpoints enable row level security;

create policy winmix_teams_read_all       on public.winmix_teams                for select to anon, authenticated using (true);
create policy winmix_seasons_read_all     on public.winmix_seasons              for select to anon, authenticated using (true);
create policy winmix_matches_read_all     on public.winmix_matches              for select to anon, authenticated using (true);
create policy winmix_checkpoints_read_all on public.winmix_pipeline_checkpoints for select to anon, authenticated using (true);
```

Insert/update/delete policy **nincs** — így az anon/publishable szerep írása
policy hiányában elbukik. Írni csak a `service_role` kulcs tud, ami megkerüli az
RLS-t, és sosem hagyja el a szervert.

> A `to anon, authenticated` felsorolás azért kell, mert az új publishable kulcs
> bejelentkezés nélkül `anon`, bejelentkezett munkamenetben `authenticated`
> szerepben érkezik.

> **Figyelem — ez „nyílt olvasás" policy.** A `using (true)` miatt bárki, aki a
> publishable kulcs birtokába jut, kiolvashatja ezeket a táblákat. Ez itt
> szándékos és elfogadható, mert derivált, publikus jellegű katalógusadatról van
> szó (mérkőzés-eredmények és csapat-rating). Személyes vagy üzletileg érzékeny
> adatot **soha** ne tegyél ilyen policy mögé.

### 2.5 GRANT — az RLS önmagában nem elég

Az RLS policy csak *szűkít*. Ha a szerepnek nincs `SELECT` **GRANT**-je az
objektumra, a Data API akkor sem éri el (`403`, `permission denied`). A Supabase
UI-ban létrehozott táblák általában megkapják, a `create or replace view`-val
kézzel felvett nézetek gyakran **nem**.

Ellenőrzés — mi van ténylegesen kiajánlva:

```sql
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated')
order by table_name, grantee;
```

Ha a `view_team_ratings` nem szerepel a listában:

```sql
grant usage on schema public to anon, authenticated;

grant select on public.winmix_teams                to anon, authenticated;
grant select on public.winmix_seasons              to anon, authenticated;
grant select on public.winmix_matches              to anon, authenticated;
grant select on public.winmix_pipeline_checkpoints to anon, authenticated;
grant select on public.view_team_ratings    to anon, authenticated;

-- írás kizárva minden nem-service szerepnek
revoke insert, update, delete on all tables in schema public from anon, authenticated;

notify pgrst, 'reload schema';
```

> **Nézetek és RLS.** Egy sima view a *létrehozó* jogaival fut, és megkerülheti
> az alaptáblák RLS-ét. Mivel itt minden alaptábla amúgy is nyílt olvasású,
> ez nem jelent kitettséget. Ha valaha szűkíted a `matches` policy-t, a nézetet
> `with (security_invoker = true)` opcióval kell újradefiniálni, különben
> kiszivárogtatja a szűrt sorokat.

### 2.4 `view_team_ratings` — a keresztellenőrzés alapja

Ennek a nézetnek **2 tizedesig egyeznie kell** a `utils/autoWeights.ts`
`computeAutoTeamWeights()` kimenetével. A TS oldali képlet:

```
netHome = (homeGf - homeGa) / homeGames        // 0, ha nincs hazai meccs
netAway = (awayGf - awayGa) / awayGames        // 0, ha nincs vendég meccs
ppg     = pts / played                          // 1.35 (PPG_PRIOR), ha played = 0
rawScore       = 0.55*netHome + 0.45*netAway + 0.33*ppg
standardized   = 5.0 + ((rawScore - mean) / (std || 1)) * 1.75
recommendedWeight = clamp(round(standardized * 10) / 10, 0, 10)
```

SQL-ben ugyanez, `FILTER (WHERE …)` aggregátumokkal (hogy a hazai/vendég oldal
ne keveredjen) és ablakfüggvénnyel a z-standardizáláshoz:

```sql
create or replace view public.view_team_ratings as
with per_team as (
  select
    t.league,
    t.canonical_key,
    t.display_name,
    count(*) filter (where m.home_team_id = t.id) as home_games,
    count(*) filter (where m.away_team_id = t.id) as away_games,
    coalesce(sum(m.home_score) filter (where m.home_team_id = t.id), 0) as home_gf,
    coalesce(sum(m.away_score) filter (where m.home_team_id = t.id), 0) as home_ga,
    coalesce(sum(m.away_score) filter (where m.away_team_id = t.id), 0) as away_gf,
    coalesce(sum(m.home_score) filter (where m.away_team_id = t.id), 0) as away_ga,
    coalesce(sum(
      case
        when m.home_team_id = t.id and m.outcome = 'H' then 3
        when m.away_team_id = t.id and m.outcome = 'A' then 3
        when m.outcome = 'D' then 1
        else 0
      end), 0) as pts
  from public.winmix_teams t
  left join public.winmix_matches m
    on (m.home_team_id = t.id or m.away_team_id = t.id)
   and m.league = t.league
  group by t.league, t.canonical_key, t.display_name, t.id
),
scored as (
  select
    league, canonical_key, display_name,
    (home_games + away_games) as total_played,
    case when home_games > 0 then (home_gf - home_ga)::numeric / home_games else 0 end as net_home,
    case when away_games > 0 then (away_gf - away_ga)::numeric / away_games else 0 end as net_away,
    case when (home_games + away_games) > 0
         then pts::numeric / (home_games + away_games)
         else 1.35 end as ppg
  from per_team
),
raw as (
  select *,
    0.55 * net_home + 0.45 * net_away + 0.33 * ppg as raw_score
  from scored
),
standardized as (
  select *,
    avg(raw_score)             over (partition by league) as mu,
    coalesce(nullif(stddev_pop(raw_score) over (partition by league), 0), 1) as sigma
  from raw
)
select
  league,
  canonical_key,
  display_name,
  total_played,
  round(net_home, 2) as net_home,
  round(net_away, 2) as net_away,
  round(ppg, 2)      as ppg,
  greatest(0, least(10,
    round((5.0 + ((raw_score - mu) / sigma) * 1.75)::numeric, 1)
  )) as auto_weight_index
from standardized;
```

**Buktatók, amikre a diff azonnal rávilágít:**

- `stddev_pop`, nem `stddev_samp` — a TS `variance` populációs osztót használ.
- `nullif(…, 0)` → `1`: egyetlen csapat vagy azonos score esetén a TS `std || 1`
  ágát reprodukálja.
- A `ppg` prior (`1.35`) csak `played = 0` esetén él, nem `NULL` helyett.
- A `left join` kell, különben a 0 meccses csapat kiesik, és eltolja a `mean`-t.
- A partícionálás **ligánként** történik — a két liga soha nem standardizálódik
  együtt.

---

## 3. Fázis 2 — ingesztálás

Az adat **szerveroldalról** kerül be, sosem a böngészőből.

> **Lovable Cloud megjegyzés:** a `service_role` kulcs Lovable Cloudon nem
> érhető el a felhasználó számára, ezért a lenti külső Python CLI itt nem
> futtatható. Az ingesztálás javasolt útja egy **szerveroldali route**
> (`src/routes/api/public/winmix/ingest.ts`), amely titkos fejléccel védett, a
> `supabaseAdmin` klienst a handleren belül tölti be, és ugyanazokat a
> szabályokat (kanonizálás, integritás, 240-es szeletelés, idempotens upsert)
> tartja be. Ez külön fázis, saját go/no-go kapukkal.

```bash
export SUPABASE_URL="https://oaadhaapbgzyibyadgdh.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="…"          # soha nem kerül a repóba
python scripts/ingest_historical_json.py --league angol --file data/pl_all.json
```

A CLI kötelező viselkedése:

1. **Kanonizálás** — `canon(name)` = kisbetűsítés → NFD → diakritika-eltávolítás
   (`[\u0300-\u036f]`) → whitespace-összevonás → trim. Bitre azonos a
   `utils/teams.ts` `normalizeForMatch()`-csel; ha eltér, a keresztellenőrzés
   „eltérés"-t fog mutatni minden ékezetes csapatnál.
2. **Integritás** — `check_scores()` a `utils/matchIntegrity.ts` tükre: negatív
   gól, félidő > végeredmény, hiányzó csapatnév → a sor kimarad, és warningként
   naplózódik. Néma javítás tilos.
3. **Szezonszeletelés** — 240 mérkőzéses blokkok, `season_index` növekvő.
   `content_hash` = a nyers fájltartalom SHA-256-ja, a duplikált import ezen bukik el.
4. **Upsert sorrend** — `winmix_teams` → `winmix_seasons` → `winmix_matches` (500-as kötegekben),
   `on_conflict` klauzulákkal (`league,canonical_key`, `league,season_index`,
   `season_id,match_no`). Az ingesztálás így idempotens: kétszer lefuttatva
   ugyanaz az eredmény.
5. **Súlyok** — a `winmix_teams.weight_index` alapból `5.0`/`auto`. Kézzel állított
   súlyt (`manual`) az ingesztálás **nem** ír felül.

---

## 4. Keresztellenőrzés a felületen

**Hol:** Pipeline Operations → *Felhő tier & keresztellenőrzés* fül.

1. A fejléc mutatja az állapotot, a végpontot és a kulcs forrását (`.env` vagy
   beépített anon).
2. Az **SQL értékelés betöltése** gomb lehívja a `view_team_ratings` sorait az
   aktuális ligára.
3. A tábla `net_home` / `net_away` értékeket vet össze a helyi
   `computeAutoTeamWeights()` eredményével, **0.01 tolerancián** belül.

| Tünet | Valószínű ok |
|---|---|
| minden sor „eltérés" | eltérő kanonizálás vagy eltérő `stddev` a nézetben |
| csak ékezetes nevek térnek el | a Python `canon()` nem NFD-normalizál |
| néhány csapat `TS net = —` | a Supabase ismer olyan csapatot, ami a helyi adatban nincs (későbbi szezon) |
| kicsi, egyenletes eltolódás | a helyi oldalon más `historyScope` van beállítva, mint amit az ingesztálás betöltött |

Az „eltérés" **nem hiba az appban** — jelzés, hogy a két számítás szétcsúszott.
A helyi érték nyer; a felhőt kell javítani.

---

## 5. Hibaelhárítás

| HTTP | Üzenet a felületen | Teendő |
|---|---|---|
| **401** | „az anon kulcsot a projekt elutasította" | A projekt letiltotta a legacy JWT kulcsokat → `sb_publishable_…` kell. Ellenőrizd: a kulcs ehhez a project ID-hoz tartozik, nem csonkolódott, és az **`apikey` headerben** megy (nem csak `Authorization`-ben). |
| **403** | „az RLS nem enged `select`-et" | Két különböző ok: (a) hiányzik a `…_read_all` policy vagy nincs benne a `to anon, authenticated`; (b) hiányzik a `GRANT SELECT` — lásd 2.5. A PostgREST üzenete megkülönbözteti: `permission denied for …` = GRANT, üres találat/`42501` policy-oldalról = RLS. |
| **404** | „a kért nézet/tábla nem létezik" | Nem futott le a 2.4 pont, vagy nem a `public` sémában van. Séma módosítás után `notify pgrst, 'reload schema';` kell. |
| **429** | „túl sok kérés" | Szondázási ráta — nyomj `Kapcsolat újrapróbálása`-t később. |
| timeout | „elérhetetlen" | 4 s felett megszakad. Offline vagy hálózati szűrés. |
| CORS | konzol hiba, `degraded` | A Supabase alapból minden origint enged a REST-en; ha mégis CORS jön, rossz az URL (pl. dashboard-URL a REST-URL helyett). |

Séma módosítás után a PostgREST cache-t frissíteni kell:

```sql
notify pgrst, 'reload schema';
```

Gyors kézi ellenőrzés terminálból:

```bash
curl -s "$SUPABASE_URL/rest/v1/view_team_ratings?select=canonical_key&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

---

## 6. Go/no-go kapuk

Ne bővítsd a felhő tiert, amíg mind a négy nem teljesül:

1. **Zöld diff** — a keresztellenőrzés minden csapatra „egyezik" egy teljes
   ligára, két különböző szezonszámmal is.
2. **Kapcsolat kihúzva** — repülőgép módban az app minden funkciója működik,
   csak a szalagcím jelenik meg.
3. **Írásteszt** — a publishable kulccsal indított `POST /rest/v1/winmix_teams` 401/403
   hibát ad.
4. **Idempotencia** — ugyanaz az ingesztálás kétszer lefuttatva 0 új sort hoz létre.

---

## 7. Mi NEM tartozik ide

- **Auth / felhasználók** — a WinMix egyfelhasználós, lokális eszköz.
- **Realtime** — a pipeline determinisztikus, nincs push-frissítés.
- **Írás a kliensből** — bármilyen mentés Supabase-be architekturális törés.
- **Pipeline-bemenet** — SQL-ből jövő szám nem kerülhet a `useWinmixEngine`
  bemenetére, a bootstrapbe, a kalibrációba vagy a döntési mátrixba.

Ha ezekre mégis szükség lenne, az új fázis, saját tervvel és saját go/no-go
kapukkal — nem ennek a rétegnek a kiterjesztése.
