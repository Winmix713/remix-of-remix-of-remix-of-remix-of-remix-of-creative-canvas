import React from 'react';
import { BAND_MIN_SAMPLE } from '../../utils/constants';
import { BandRowsTable } from './BandRowsTable';
import { Panel, PanelHeader, PanelSubtitle, PanelTitle } from './Panel';
import type { ReliabilityBand } from '../../types/winmix';

/**
 * The empirical reliability table — the single most honest element on the
 * surface.
 *
 * For each CONFIDENCE band it puts the signalled probability next to the
 * MEASURED hit rate and names the gap. A band whose signalled probability
 * falls outside the Wilson interval of its own hit rate is called overconfident
 * out loud, and everything downstream (the slip's core slots) refuses to use it.
 *
 * SCOPE. This table is, and remains, the 1X2 measurement: the observation is
 * the argmax top pick against the realized H/D/A outcome. It is NOT
 * market-specific — for that, see `MarketCalibrationPanel`, which measures a
 * single market's own probabilities in probability bands. The two live side by
 * side on purpose; only the rendering primitive is shared.
 *
 * Bands with fewer than {@link BAND_MIN_SAMPLE} observations are reported as
 * "not evaluable" rather than rendered as a confident-looking number.
 */
export function ReliabilityBandTable({
  bands,
  subtitle,
  className




}: {bands: ReliabilityBand[];subtitle?: React.ReactNode;className?: string;}) {
  return (
    <Panel className={className}>
      <PanelHeader>
        <div>
          <PanelTitle>Empirikus kalibrációs sáv-tábla (1X2)</PanelTitle>
          <PanelSubtitle>
            {subtitle ??
            `Konfidencia-sávonként: mennyit jelzett a modell az 1X2 csúcstippre, és mennyi lett belőle valóban. A Gap a hibahatárral (Wilson 95%) együtt értelmezendő. Minimális értékelhető minta: ${BAND_MIN_SAMPLE} eset.`}
          </PanelSubtitle>
        </div>
      </PanelHeader>
      <BandRowsTable
        rows={bands}
        firstColumnLabel="Konfidencia sáv"
        empty="Nincs kiértékelt mérkőzés — futtasd le a pipeline-t az aktív ligára." />
      
    </Panel>);

}