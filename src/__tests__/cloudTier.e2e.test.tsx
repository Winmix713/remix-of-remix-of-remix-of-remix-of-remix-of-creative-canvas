import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CloudTierProvider } from '../contexts/CloudTierContext';
import { CloudTierTab } from '../components/winmix/ops/CloudTierTab';

/**
 * End-to-end a valós providerrel: csak a hálózat van kicserélve, így a
 * probing → online / degraded átmenetet és a gombok tiltását pontosan úgy
 * gyakorolja, ahogy a staging környezetben fel-/lekapcsolódik a felhő tier.
 */

let resolveProbe: (r: Response) => void;

function jsonOk(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
function httpError(status: number) {
  return new Response(JSON.stringify({ message: 'boom' }), { status, statusText: 'Error' });
}

function renderApp() {
  return render(
    <CloudTierProvider>
      <CloudTierTab
        league={'premier_league' as never}
        crossCheck={[]}
        ingestToCloud={vi.fn()}
        ingesting={false}
        ingestResult={null}
      />
    </CloudTierProvider>,
  );
}

const loadBtn = () => screen.getByRole('button', { name: /SQL értékelés betöltése|Betöltés…/ });

describe('felhő tier fel- és lekapcsolódás (e2e)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('probing alatt tiltott a gomb, sikeres probe után engedélyezett, majd betölt', async () => {
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockImplementation(
      () =>
        new Promise<Response>((res) => {
          resolveProbe = res;
        }),
    );
    renderApp();

    expect(screen.getByText(/kapcsolat ellenőrzése/i)).toBeInTheDocument();
    expect(loadBtn()).toBeDisabled();

    resolveProbe(jsonOk([]));
    await waitFor(() => expect(loadBtn()).toBeEnabled());
    expect(screen.getByText(/elérhető/)).toBeInTheDocument();

    f.mockResolvedValue(
      jsonOk([
        {
          canonical_key: 'arsenal',
          display_name: 'Arsenal',
          total_played: 38,
          net_home: 1,
          net_away: 0.2,
          ppg: 2,
          auto_weight_index: 1.1,
        },
      ]),
    );
    await userEvent.click(loadBtn());
    await waitFor(() =>
      expect(String(f.mock.calls.at(-1)?.[0])).toContain('view_team_ratings?league=eq.'),
    );
  });

  it('401 probe → lekapcsolódik: degraded felirat, tiltott betöltés, engedélyezett újrapróbálás', async () => {
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValue(httpError(401));
    renderApp();

    await waitFor(() => expect(screen.getByText(/helyi módra váltva/)).toBeInTheDocument());
    expect(screen.getByText(/HTTP 401/)).toBeInTheDocument();
    expect(loadBtn()).toBeDisabled();

    // Újrapróbálás javított hitelesítéssel → visszakapcsolódik.
    f.mockResolvedValue(jsonOk([]));
    await userEvent.click(screen.getByRole('button', { name: /újrapróbálása/i }));
    await waitFor(() => expect(loadBtn()).toBeEnabled());
    expect(screen.queryByRole('button', { name: /újrapróbálása/i })).not.toBeInTheDocument();
  });

  it('429 a betöltés közben → ragadós degrade a session hátralévő részére', async () => {
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValue(jsonOk([]));
    renderApp();
    await waitFor(() => expect(loadBtn()).toBeEnabled());

    f.mockResolvedValue(httpError(429));
    await userEvent.click(loadBtn());
    await waitFor(() => expect(screen.getByText(/HTTP 429/)).toBeInTheDocument());
    expect(loadBtn()).toBeDisabled();
    expect(screen.getByRole('button', { name: /újrapróbálása/i })).toBeEnabled();
  });
});
