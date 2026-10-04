import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CloudTierState } from '../hooks/useCloudTier';
import type { CloudTierStatus } from '../utils/supabaseTier';

const state: { current: CloudTierState } = { current: null as unknown as CloudTierState };

vi.mock('../contexts/CloudTierContext', () => ({
  useCloudTierContext: () => state.current,
}));

import { CloudTierTab } from '../components/winmix/ops/CloudTierTab';

function makeState(status: CloudTierStatus, over: Partial<CloudTierState> = {}): CloudTierState {
  const degraded = status === 'degraded';
  return {
    health: {
      status,
      degraded,
      lastError: degraded ? 'HTTP 429 — túl sok kérés, próbáld újra később.' : null,
      checkedAt: status === 'probing' ? null : '2026-09-03T08:00:00.000Z',
    },
    configured: status !== 'unconfigured',
    ratings: [],
    loadingRatings: false,
    refresh: vi.fn(),
    retry: vi.fn(),
    loadRatings: vi.fn(),
    ...over,
  };
}

function renderTab(s: CloudTierState) {
  state.current = s;
  return render(
    <CloudTierTab
      league={'premier_league' as never}
      crossCheck={[]}
      ingestToCloud={vi.fn()}
      ingesting={false}
      ingestResult={null}
    />,
  );
}

const loadBtn = () => screen.getByRole('button', { name: /SQL értékelés betöltése|Betöltés…/ });

describe('CloudTierTab — probing állapotgép a UI-ban', () => {
  it('probing alatt a betöltés gomb le van tiltva és a felirat "kapcsolat ellenőrzése…"', () => {
    renderTab(makeState('probing'));
    expect(loadBtn()).toBeDisabled();
    expect(screen.getByText(/kapcsolat ellenőrzése/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /újrapróbálása/i })).not.toBeInTheDocument();
  });

  it('online állapotban a betöltés gomb engedélyezett', () => {
    renderTab(makeState('online'));
    expect(loadBtn()).toBeEnabled();
    expect(screen.getByText(/elérhető/)).toBeInTheDocument();
  });

  it('degraded állapotban a betöltés tiltott, de az újrapróbálás engedélyezett', () => {
    renderTab(makeState('degraded'));
    expect(loadBtn()).toBeDisabled();
    const retry = screen.getByRole('button', { name: /újrapróbálása/i });
    expect(retry).toBeEnabled();
    expect(screen.getByText(/helyi módra váltva/)).toBeInTheDocument();
    expect(screen.getByText(/HTTP 429/)).toBeInTheDocument();
  });

  it('unconfigured állapotban a betöltés tiltott, és a hiányzó env-eket írja ki', () => {
    renderTab(makeState('unconfigured', { configured: false }));
    expect(loadBtn()).toBeDisabled();
    expect(screen.getByText(/nincs konfigurálva/)).toBeInTheDocument();
  });

  it('folyamatban lévő betöltés alatt is tiltott a gomb', () => {
    renderTab(makeState('online', { loadingRatings: true }));
    expect(loadBtn()).toBeDisabled();
    expect(screen.getByText('Betöltés…')).toBeInTheDocument();
  });

  it('a végpont-összefoglaló és a csak-olvasás figyelmeztetés mindig látszik', () => {
    renderTab(makeState('online'));
    expect(screen.getByText(/Végpont:/)).toBeInTheDocument();
    expect(screen.getByText(/nyilvános kulcsot/)).toBeInTheDocument();
  });
});
