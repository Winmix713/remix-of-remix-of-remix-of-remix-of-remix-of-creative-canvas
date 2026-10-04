import { LEAGUES } from '../data/leagues';
import type { League } from '../types/winmix';

/**
 * Távoli, rögzített mérkőzés-CSV készlet.
 *
 * A fájlok a szokásos feltöltési úton mennek át (`importFiles`): letöltés után
 * `File` objektumként adjuk tovább, így a parse, dedup, liga-felismerés,
 * integritás-ellenőrzés és a pipeline újraszámolás pontosan ugyanaz, mint
 * kézi feltöltésnél. A fájlnév tartalmazza a liga nevét, ezért az automatikus
 * liga-felismerés biztosan talál.
 */

const BASE_URL =
'https://raw.githubusercontent.com/Winmix713/Mutzzz/refs/heads/main/merkozesek';

/** Szezon-fájlok száma ligánként a távoli tárolóban. */
const SEASON_COUNT: Record<League, number> = {
  angol: 19,
  spanyol: 18
};

export interface RemoteSeasonSource {
  league: League;
  url: string;
  fileName: string;
}

export const REMOTE_SEASON_SOURCES: RemoteSeasonSource[] = LEAGUES.flatMap((league) =>
Array.from({ length: SEASON_COUNT[league] }, (_, index) => ({
  league,
  url: `${BASE_URL}/${league}/${index + 1}.csv`,
  fileName: `${league}-${index + 1}.csv`
}))
);

export interface RemoteFetchResult {
  files: File[];
  failures: string[];
}

/**
 * Letölti az összes távoli CSV-t, korlátozott párhuzamossággal.
 *
 * A hibás fájlok nem szakítják meg a folyamatot: a sikeresen letöltött fájlok
 * visszatérnek, a hiányzók pedig felsorolva a `failures`-ben — így egy-egy
 * elérhetetlen szezon nem akadályozza a többi betöltését.
 */
export async function fetchRemoteSeasonFiles(
onProgress?: (done: number, total: number) => void,
concurrency = 6)
: Promise<RemoteFetchResult> {
  const sources = REMOTE_SEASON_SOURCES;
  const total = sources.length;
  const slots: Array<File | null> = new Array(total).fill(null);
  const failures: string[] = [];
  let done = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < total) {
      const index = cursor;
      cursor += 1;
      const source = sources[index];
      try {
        const response = await fetch(source.url, { cache: 'no-store' });
        if (!response.ok) {
          failures.push(`${source.fileName} (HTTP ${response.status})`);
        } else {
          const text = await response.text();
          if (text.trim().length === 0) {
            failures.push(`${source.fileName} (üres fájl)`);
          } else {
            slots[index] = new File([text], source.fileName, { type: 'text/csv' });
          }
        }
      } catch (error) {
        failures.push(
          `${source.fileName} (${error instanceof Error ? error.message : 'hálózati hiba'})`
        );
      }
      done += 1;
      onProgress?.(done, total);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => worker())
  );

  return {
    files: slots.filter((file): file is File => file !== null),
    failures
  };
}