import React from 'react';
import { cn } from '../../lib/utils';
import type { EntropyFloorEstimate } from '../../types/winmix';
import { Panel, PanelHeader, PanelTitle } from './Panel';

function Figure({
  label,
  value,
  tone




}: {label: string;value: string;tone?: string;}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
        {label}
      </dt>
      <dd className={cn('mt-0.5 font-mono text-ui-lg font-bold tabular-nums text-foreground', tone)}>
        {value}
      </dd>
    </div>);

}

export function EntropyFloorPanel({ floor }: {floor: EntropyFloorEstimate | null;}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle as="h3">Entrópia-plafon és mozgástér (Oracle baseline)</PanelTitle>
      </PanelHeader>

      <div className="flex flex-col gap-3 px-3 py-3.5 sm:px-4">
        {floor ?
        <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Figure
              label="Elméleti plafon (H)"
              value={floor.entropyFloor.toFixed(3)}
              tone="text-chart-3" />
            
              <Figure label="Oracle LogLoss" value={floor.oracleLogLoss.toFixed(3)} />
              <Figure
              label="B1 Poisson (as-of)"
              value={floor.b1LogLoss !== null ? floor.b1LogLoss.toFixed(3) : '—'} />
            
              <Figure
              label="Teljes mozgástér"
              value={floor.headroom !== null ? floor.headroom.toFixed(3) : '—'}
              tone={floor.saturated ? 'text-negative' : 'text-signal'} />
            
            </dl>
            <p className="max-w-prose text-ui-xs leading-relaxed text-muted-foreground">
              {floor.saturated ?
            `A B1 Poisson bázis és az elméleti plafon közti rés kisebb, mint ${floor.saturationGap} — további modellbonyolítás (Dixon-Coles, Glicko-2, ML) túlillesztéshez vezet, nem tudásnövekedéshez.` :
            `A rés ${floor.headroom !== null ? floor.headroom.toFixed(3) : '—'} logloss: ennyi az összes elérhető javulás, amit bármilyen modell megszerezhet. Minden „javulást” ehhez kell mérni.`}
            </p>
          </> :

        <p className="text-ui-sm text-muted-foreground">
            A plafon becsléséhez legalább 60 kiértékelt mérkőzés kell ebben a ligában.
          </p>
        }
      </div>
    </Panel>);

}