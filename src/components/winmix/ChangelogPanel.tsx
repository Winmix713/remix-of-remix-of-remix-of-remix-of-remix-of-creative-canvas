import React from 'react';
import { Collapsible } from './Collapsible';

export function ChangelogPanel() {
  return (
    <Collapsible title="Változásnapló — v1 → v2 (Part A javítások)" subtitle="Fázisok és változások">
      <div className="flex flex-col gap-2 px-3 py-3 text-ui-xs leading-relaxed text-muted-foreground sm:px-4">
        <p>
          <b className="text-foreground">Javítva:</b> a kalibráció most az ensemble-ön (nem csak
          B1-en) fut, prequenciálisan (csak múltbéli meccseken tanul, nem szivárog jövőbeli adat) —
          liga-szinten elkülönítve. A Poisson-számítás felgyorsítva (nincs több rekurzív
          faktoriális). Csapatnevek kanonizálva (nagybetű- és szóköz-eltérések nem hoznak létre
          duplikált csapatot). Liga-detekció normalizált, és bizonytalanság esetén nem tippel
          automatikusan. A ~240 meccses import tűréssel és részletes hibadiagnosztikával fogad
          fájlokat, sor- és fájlszintű deduplikációval. A súlyok liga-szinten különülnek el, a
          szezonnevek törlés után is stabilak. A mentés verziózott és méretkorlát-figyelmeztetéssel
          rendelkezik. A pontossági mutató szét van bontva (actionable vs. összes argmax +
          lefedettség). Billentyűzet-elérhetőség és a <code>prefers-reduced-motion</code> támogatás
          javítva.
        </p>
        <p>
          <b className="text-foreground">Tudottan részleges / későbbi kör:</b> a nehéz
          pipeline-számítás apró darabokban, a fő szálról időszakosan átadva fut (yielding), nem
          valódi Web Workerben — nagy adatmennyiségnél még lehet érezhető. A csapat-alias térkép
          automatikusan épül fel (első előfordulás szerint), de nincs hozzá szerkesztő felület.
          Ismeretlen ligájú fájloknál a felhasználónak manuálisan újra kell töltenie kényszerített
          módban. A tárolt állapotból a származtatott predikciók kimaradnak, és betöltéskor
          újraszámolódnak — ezek tudatos egyszerűsítések a Part A hatókörén belül.
        </p>
      </div>
    </Collapsible>);

}