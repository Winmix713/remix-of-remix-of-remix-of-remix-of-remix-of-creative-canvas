import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CloudHttpError,
  fetchCloudTeamRatings,
  idleHealth,
  probeCloudTier,
} from '../utils/supabaseTier';

function httpError(status: number, body: Record<string, unknown> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    statusText: 'Error',
    headers: { 'content-type': 'application/json' },
  });
}

function jsonOk(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('supabaseTier — hibaüzenetek és állapotgép', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('konfigurált tier induló állapota `probing`', () => {
    expect(idleHealth()).toMatchObject({ status: 'probing', degraded: false, lastError: null });
  });

  it('sikeres nézetolvasás → online', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(jsonOk([]));
    const health = await probeCloudTier();
    expect(health.status).toBe('online');
    expect(health.degraded).toBe(false);
  });

  it('401 → degraded, a kulcs/legacy JWT magyarázattal', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      httpError(401, { message: 'Invalid API key' }),
    );
    const health = await probeCloudTier();
    expect(health.status).toBe('degraded');
    expect(health.degraded).toBe(true);
    expect(health.lastError).toContain('HTTP 401');
    expect(health.lastError).toContain('anon kulcsot');
    expect(health.lastError).toContain('PostgREST: Invalid API key');
    // 401 nem maszkolható a REST-gyökérrel: csak egy kérés mehetett ki.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('403 → degraded, RLS magyarázattal, fallback nélkül', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(httpError(403));
    const health = await probeCloudTier();
    expect(health.lastError).toContain('HTTP 403');
    expect(health.lastError).toContain('RLS');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('404 (nézet még nincs telepítve) → REST-gyökér próbája, és online marad', async () => {
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce(httpError(404)).mockResolvedValueOnce(jsonOk({}));
    const health = await probeCloudTier();
    expect(f).toHaveBeenCalledTimes(2);
    expect(health.status).toBe('online');
  });

  it('404 mindkét kérésre → degraded, a hiányzó nézet üzenetével', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(httpError(404));
    const health = await probeCloudTier();
    expect(health.status).toBe('degraded');
    expect(health.lastError).toContain('HTTP 404');
    expect(health.lastError).toContain('nem létezik');
  });

  it('429 → degraded, rate-limit üzenettel', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(httpError(429));
    const health = await probeCloudTier();
    expect(health.status).toBe('degraded');
    expect(health.lastError).toContain('HTTP 429');
  });

  it('hálózati hiba → degraded, nem dob', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    const health = await probeCloudTier();
    expect(health.status).toBe('degraded');
    expect(health.lastError).toContain('network down');
  });

  it('opak publishable kulcsot sosem küld Bearerként, apikey mindig megy', async () => {
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValue(jsonOk([]));
    await probeCloudTier();
    const headers = f.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.apikey).toBeTruthy();
    if (headers.apikey.startsWith('sb_publishable_')) {
      expect(headers.Authorization).toBeUndefined();
    }
  });

  it('fetchCloudTeamRatings a dokumentált oszlopokat kéri és map-eli', async () => {
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValue(
      jsonOk([
        {
          canonical_key: 'arsenal',
          display_name: 'Arsenal',
          total_played: 38,
          net_home: '1.25',
          net_away: 0.5,
          ppg: 2.1,
          auto_weight_index: 1.4,
        },
      ]),
    );
    const rows = await fetchCloudTeamRatings('premier_league' as never);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/rest/v1/view_team_ratings');
    expect(url).toContain('league=eq.premier_league');
    expect(url).toContain('auto_weight_index');
    expect(rows[0]).toEqual({
      canonicalKey: 'arsenal',
      displayName: 'Arsenal',
      totalPlayed: 38,
      netHome: 1.25,
      netAway: 0.5,
      ppg: 2.1,
      autoWeightIndex: 1.4,
    });
  });

  it('a hibák CloudHttpError-ként jönnek, státusszal együtt', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(httpError(403));
    await expect(fetchCloudTeamRatings('premier_league' as never)).rejects.toBeInstanceOf(
      CloudHttpError,
    );
  });
});
