# WinMix ingest – javított importáló

## Telepítés

1. Ellenőrizd a migrációt a tényleges táblasémával. Az eredeti kódban használt public.winmix_teams, public.winmix_seasons és public.winmix_matches táblákra és oszlopokra épül. A meglévő triggereket, idegen kulcsokat és oszlopkényszereket nem ismerjük. Az új egyedi indexek létrehozása duplikált adat esetén hibával megáll; nem töröl adatokat.
2. Futtasd a mellékelt SQL-migrációt tesztkörnyezetben, majd a saját projektedben. Az index.ts nem működik az RPC nélkül. Az RPC végrehajtása kizárólag service_role számára engedélyezett, SECURITY INVOKER módban.
3. Másold az index.ts fájlt a supabase/functions/winmix-ingest/index.ts helyére.
4. A config.fragment.toml szakaszát illeszd a meglévő supabase/config.toml fájlba. Ne cseréld le a teljes konfigurációt a töredékre.
5. Állíts be legalább 32 karakteres, véletlenszerű WINMIX_ADMIN_TOKEN titkot. Az értéket ne égesd a frontendbe és ne tárold VITE_* változóban. Az admin kézzel megadhatja a felületen, vagy szerveroldali közvetítő használhatja. Nincs beépített sebességkorlátozó: ha publikus végpontként használod, a projektben külön lehet szabályozni.
6. Opcionális WINMIX_ALLOWED_ORIGINS: pontos originértékek vesszővel elválasztva, például https://912711e2-d52f-4e53-a55d-1f7e53eb49a4.lovableproject.com. Üres beállítás mellett Access-Control-Allow-Origin: *. Nem hitelesítési megoldás, origin nélküli szerverhívásokat nem korlátoz.
7. A SUPABASE_URL és SUPABASE_SERVICE_ROLE_KEY projekt által biztosított változókat használja. A meglévő kulcskezelést nem migrálja más formátumra.
8. Telepítsd: `supabase functions deploy winmix-ingest --project-ref dpmyxypqcsugycqhifaf`.
9. Network panel: OPTIONS 204, helyes CORS-fejlécek; hibás tokenes POST 401; helyes kérés sikeres mentéssel 200. Egy függvényindulási vagy gateway-hibát a handler CORS-kódja nem tud kijavítani.

## Kérés és kompatibilitás

```json
{
  "mode": "replace",
  "allowPartial": false,
  "teamAliasMap": { "angol": {}, "spanyol": {} },
  "seasons": [{
    "league": "angol",
    "seasonIndex": 1,
    "name": "Angol 1",
    "fileName": "angol.csv",
    "orderMode": "source-order",
    "matches": [{
      "home_team": "A csapattáblában szereplő név",
      "away_team": "Másik csapat neve",
      "home_score": 2,
      "away_score": 1,
      "ht_home_score": 1,
      "ht_away_score": 0,
      "kickoffIso": null
    }]
  }]
}
```

Fejlécek: Content-Type: application/json és X-Admin-Token: az admin által megadott titok. Service-role vagy secret kulcsot soha ne küldj a böngészőbe.

- Alapértelmezett mód: merge, allowPartial: false. A merge megőrzi a kérésből hiányzó régi mérkőzéseket. Ez szándékos összevonás, a visszaadott database.totalMatches a teljes mentett szezont mutatja. Merge után a content_hash null, mert egy forrás hash-e nem igazolja az összevont állapotot.
- Teljes szezoncsere: mode: replace. Hibás sor esetén a teljes érintett szezon kimarad; más, érvényes szezonok menthetőek. Siker esetén a kimaradó régi match_no értékek törlődnek ugyanabban a tranzakcióban. A törlés idegen kulcsok szerinti hatásait a tényleges sémán ellenőrizni kell.
- Részleges sorimport kizárólag merge + allowPartial: true mellett engedélyezett. Replace módban a kapcsoló 400 hibát eredményez.
- A match_no a teljes forrástömb 1-alapú pozíciója, az elutasított soroknál nem számozza át a többit. Merge esetén mindig a teljes, stabil sorrendű forrástömböt küldd; egy kivágott résztömb eleje is match_no=1 lenne. Sorrendváltoztatásnál teljes replace import szükséges.
- orderMode kötelező. source-order megőrzi a forrássorrendet. chronological csak valós, időzónás kickoffIso-val és már rendezett sorokkal fogadható el; a handler nem rendezi át őket.
- fileName hiányában sourceCsv használható. A félidei hiányos vagy hibás pár null/null értékre javul, és csak sikeres mentés után növeli a repaired számlálót. A végeredmény nem javul és szövegből nem konvertálódik.
- 0–20 gól, angol/spanyol liga, legfeljebb 5 szezon, összesen 2000 sor, legfeljebb 4 MiB UTF-8 JSON kérésenként. Nagy exportból a pipeline és más fel nem használt mezőket ne küldd át. Küldj szezononkénti kéréseket; a teljes szezon ebbe a korlátba bele kell férjen.
- A csapattábla kanonikus kulcsütközése hibával megállítja az adott szezont. Az aliasok normalizált kulcsokra épülnek; a hibás explicit alias nem esik vissza más csapatra. Aliaslánc nem támogatott.

## Eredmény és tranzakciók

200: minden szezon mentve, nincs elutasított sor. A javított félidő külön repaired számlálóban szerepel.
207: legalább egy szezon mentve, de maradt elutasítás vagy szezonhiba. A kliensnek success, partial, errors és results alapján is ellenőriznie kell az eredményt; a response.ok önmagában kevés.
422: egyetlen szezon sem menthető a sorvalidáció miatt.
400/413/415: hibás szerkezet / méretkorlát / hibás médiatípus.
401: admin-token hiba. 403: nem engedélyezett böngészős origin. 500: konfigurációs vagy adatbázishiba.

Az atomikusság szezononként értendő, nem az egész több szezonos kérésre. A szintaktikai és metaadat-validáció minden szezonra még az első írás előtt lefut. Egy későbbi szezonhibától a korábbi sikeres tranzakciók megmaradnak. A szezononkénti advisory lock az ezen RPC-n keresztül végzett importokat sorosítja; más közvetlen írók nem veszik figyelembe automatikusan ezt a protokollt.

Hálózati hiba esetén a kliens nem feltétlenül tudja, hogy a szerver már commitolt-e. Ugyanaz a teljes kérés újraküldhető, de a tényleges projekt triggereinek és mellékhatásainak idempotenciáját ellenőrizni kell. Külön idempotency ledger nincs ebben a változatban.

## Ellenőrzés

A mellékelt helyi teszt a TypeScript kódot Node beépített típuseltávolításával futtatja, mock Supabase klienssel. 22 teszt sikeres. Futtatás Node 24 alatt: `node --test ingest.test.mjs`. Valós adatbázis ellen nem történt futtatás. A migrációt, rollbacket, konkurens importot és az idegen kulcsok hatását a tényleges Supabase sémán szükséges ellenőrizni. A teszt nem helyettesíti a Deno typecheck-et. Telepítés előtt futtasd: `deno check supabase/functions/winmix-ingest/index.ts`.

Kézi DB-próbák: 3 soros replace, majd 2 soros replace (a harmadik törlődik); 3 soros import után 2 soros merge (a harmadik megmarad); hibás replace (minden régi sor és metaadat marad); DB constraint hiba (szezonváltozás is rollback); két azonos szezonra futó import (nem keverednek).
