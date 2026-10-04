# WinMix — javítás a tényleges verziózott sémához (v3)

Célprojekt: dpmyxypqcsugycqhifaf. Ez beilleszthető javítócsomag, nem teljes repo.
A korábbi v2 csomag egyszerűsített táblasémát feltételezett; az éles schema_report
alapján ez hibás volt. A csomag ezt új v3 RPC-vel és új, verzióra szűrt nézettel javítja.
A régi v1/v2 RPC-t nem módosítja; az új Edge Function kizárólag a v3 RPC-t hívja.

## Megerősített sémaeltérések

- winmix_seasons.data_version_id kötelező. Szezonazonosság:
  (data_version_id, league, season_index), nem (league, season_index).
- winmix_matches.data_version_id kötelező; összetett FK:
  (season_id, league, data_version_id).
- match_no 1..240. A verzió expected_matches_per_season értéke szigorúbb lehet.
- winmix_seasons.file_name kötelező. Ha a helyi forrásnevet nem adja meg az app,
  a transport címkéje winmix-upload.json; ez nem állítja, hogy eredeti CSV-fájlnév.
- winmix_teams.weight_index numeric 0..10, alapérték 5.0. Az import ezt nem írja felül.
- A canonical_key ligák között is egyedi. Új kulcs: league:normalized-name.
  A meglévő ligán belüli canonical/display_name találatot használja először.
  Több találatnál hibát jelez ahelyett, hogy találomra választana.
- A sealed verziókhoz írást tiltó triggerek vannak. Az új RPC a verziót FOR UPDATE
  zárolja és csak status=draft, is_current=false esetén ír.
- A motorfutásokhoz tartozó statisztikatábla nincs érintve: se DML, se backfill,
  se jogosultságmódosítás. Nincs fiktív engine run.

## Az adateverzió kiválasztása

Az SQL Editorban ez a read-only lekérdezés megmutatja a valódi verziókat:

```sql
SELECT id, version_key, status, is_current, expected_matches_per_season
FROM public.winmix_data_versions
ORDER BY created_at DESC;
```

Válassz egy saját importhoz szánt, létező non-current draftot.
A UUID nem titkos kulcs. A gyökér .env fájlban:

```dotenv
VITE_SUPABASE_URL=https://dpmyxypqcsugycqhifaf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Xll_LdXYYBtizcduj2aPDQ_tqkI5r1S
VITE_WINMIX_DATA_VERSION_ID=IDE_A_VALODI_DRAFT_UUID
```

Ha nincs megfelelő draft, a meglévő adateverzió-életciklus szerint kell létrehozni.
A kapott jelentésből a status/current/seal triggerfüggvények TÖRZSE nem ismert.
Ez a csomag ezért nem állít elő draftot, nem frissít data_versions összesítő mezőket,
nem pecsétel le verziót, nem vált is_current értéket és nem kapcsol ki triggert.
A draft import önmagában nem változtatja meg a rendszer current sealed adatkészletét.
Ezekhez a meglévő lifecycle/RPC és a triggerdefiníciók alapján külön lépés szükséges.
A ratings nézet ugyanazt a kiválasztott UUID-t olvassa, így a draft import eredménye
ellenőrizhető a current verzió módosítása nélkül is. RLS továbbra is érvényes:
ha draft olvasásra nincs policy, üres eredmény is érkezhet.

## Beillesztés és telepítés

1. Mentsd a projektedet. Másold be a src/ fájlokat és a winmix-ingest/index.ts fájlt.
2. A config.toml-ból a project_id és [functions.winmix-ingest] részt illeszd a saját
   konfigurációdba; a többi beállítást tartsd meg.
3. Az új 20261004230000_winmix_cloud_fix_v3.sql a meglévő éles táblákra épül.
   Nem tartalmazza a régi, nem verziózott CREATE TABLE migrációkat.
4. A sikertelen 20261004210000...v2.sql fájlt csak akkor vedd ki a futtatandó helyi
   migrációk közül, ha NEM szerepel sikeresen alkalmazottként a remote historyban.
   Már alkalmazott migrációt ne törölj/ne írj át. Eltérő historyt ne repair-elj találomra.
5. Állítsd be a valódi VITE_WINMIX_DATA_VERSION_ID értéket. Indítsd újra/építsd újra a Vite appot.
6. Az új SQL teljes BEGIN..COMMIT tartalmát futtasd a célprojekt SQL Editorában,
   vagy a saját projektedből a CLI-vel telepítsd. SQL Editor és CLI history eltérhet;
   ugyanazt a migrációt ne futtasd párhuzamosan mindkét úton.

CLI Windows PowerShellből:

```powershell
npx supabase login
npx supabase link --project-ref dpmyxypqcsugycqhifaf
npx supabase db push --dry-run
# Ellenőrizd a projektet és a pending migrációk listáját, majd:
npx supabase db push
npx supabase functions deploy winmix-ingest --project-ref dpmyxypqcsugycqhifaf
```

A WINMIX_INGEST_TOKEN szerveroldali secret továbbra is szükséges, 64 hex karakter.
Ha a korábbi csomaggal már beállítottad, nem kell újra generálni. A böngésző a
feltöltéskor kéri be és nem tárolja localStorage-ban. Ha nincs:

```powershell
$winmixBytes = New-Object byte[] 32
$winmixRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$winmixRng.GetBytes($winmixBytes)
$winmixRng.Dispose()
$winmixToken = ([BitConverter]::ToString($winmixBytes)).Replace('-', '').ToLowerInvariant()
$winmixSecretsFile = Join-Path $env:TEMP 'winmix-v3-secrets.env'
[System.IO.File]::WriteAllText($winmixSecretsFile, "WINMIX_INGEST_TOKEN=$winmixToken`n", [System.Text.UTF8Encoding]::new($false))
npx supabase secrets set --env-file $winmixSecretsFile --project-ref dpmyxypqcsugycqhifaf
# Siker után mentsd a $winmixToken értéket a jelszókezelődbe, majd:
Remove-Item $winmixSecretsFile
```

A token nem Supabase sb_secret_ kulcs, és nem a VITE_ env fájlba kerül.
A verify_jwt=false mellett a handler saját operátori tokent ellenőriz. A secret
kulcsfeloldás default/egyedi név szabályai változatlanok; több névnél konfiguráld
WINMIX_SECRET_KEY_NAME értékét. A korábban chatben megosztott admin API-kulcsot vond vissza.

## Import- és megjelenítési szerződés

- Egy teljes szezon egy kérés, maximum 240 mérkőzés és 4 MiB; a DB a verzió saját
  expected_matches_per_season korlátját is ellenőrzi. Draftban részleges szezon
  megengedett, lezárási validálás a meglévő lifecycle feladata.
- A kliens merge módot használ, régi extra mérkőzéssorokat megtart. A DB supports
  replace csak az explicit kiválasztott drafton, az UI ezt nem kapcsolja be.
- A csapat/szezon/mérkőzés mentés szezononként atomi, az összes szezon együtt nem.
- Már létező draft szezon azonos order_mode mellett megismételhető merge módban.
- A generated total_goals, btts, outcome oszlopokba az import nem ír.
- view_team_ratings_v3 verzióhoz és ligához tartozó valódi home/away átlagos
  gólkülönbséget, PPG-t és tárolt weight_index értéket ad. Nem engine-run output.
- autoWeights.ts képlete nem volt a csatolmányban, ezért az SQL/TS egyezés nincs
  igazolva; UI: „nem összevethető”. Semmilyen pipeline/modell automatikusan nem kap
  ezekből új paramétereket.
- Régi, különálló UNIQUE INDEX (league, season_index) a schema_reportban nem látszik,
  mert csak constraints kerültek exportálásra. Ha ilyen index még van az éles DB-ben,
  akadályozhatja több verzió azonos szezonszámát. A csomag nem töröl ismeretlen indexet.
- A meglévő sealed-source triggerek törzse nem szerepelt a jelentésben. Az RPC nem
  kerül meg triggert; az éles teszt felfedhet további draft-lifecycle szabályokat.

## Validálás

Futtatott: Node 24 kliens/handler kontrakttesztek és .ts szintaxis transzformáció.
Új tesztek: adateverzió továbbítása a POST-ban és RPC-ben, verziószűrő a GET-ben,
hiányzó verzió elutasítása, 240-es szezonkorlát. A korábbi auth/CORS/pagination/error
próbák is futnak.

```powershell
node tests/cloud-contract.test.mjs
# A teljes eredeti appban: npm run build + saját typecheck parancs.
```

Nem futtatott itt: teljes React/TSX build, Deno npm importok, PostgreSQL/trigger runtime,
éles deploy. A tests/database-smoke.sql valódi meglévő draft UUID-val staging/local
DB-n használható; a tesztmódosításokat ROLLBACK-kel visszavonja. Nem hoz létre verziót.
A SQL teszt olyan draftot igényel, amely legalább két mérkőzést enged szezononként.

Telepítés után OPTIONS: 200 és X-WinMix-Build: winmix-ingest-20261004-v3.
Token nélküli POST: 401 (503, ha szerveroldalon nincs tokenkonfiguráció).
Először egy kis szezon, utána SQL értékelés betöltése. Mindkettő ugyanazt a valódi
VITE_WINMIX_DATA_VERSION_ID értéket használja. Lezárt verzióra import mindig hibát ad.
