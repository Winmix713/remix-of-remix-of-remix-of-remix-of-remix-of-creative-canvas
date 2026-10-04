import { describe, expect, it } from 'vitest';
import { resolveCloudEnv, readCloudEnv } from '../utils/cloudConfig';
import { cloudEndpointSummary, isCloudTierConfigured } from '../utils/supabaseTier';

const FB = { url: 'https://fbproject.supabase.co', anonKey: 'sb_publishable_fallback' };

describe('cloudConfig — feloldási sorrend', () => {
  it('a .env-et részesíti előnyben, ha az URL és a kulcs is érvényes (záró / levágva)', () => {
    expect(
      resolveCloudEnv(
        {
          VITE_SUPABASE_URL: ' https://fbproject.supabase.co/ ',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging',
        },
        FB,
      ),
    ).toEqual({
      url: 'https://fbproject.supabase.co',
      anonKey: 'sb_publishable_staging',
      source: 'env',
    });
  });

  it('elfogadja a történeti VITE_SUPABASE_ANON_KEY nevet is', () => {
    const env = resolveCloudEnv(
      {
        VITE_SUPABASE_URL: 'https://fbproject.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: '',
        VITE_SUPABASE_ANON_KEY: 'legacy-jwt-key',
      },
      FB,
    );
    expect(env).toMatchObject({ anonKey: 'legacy-jwt-key', source: 'env' });
  });

  it.each([
    ['hiányzó séma', 'fbproject.supabase.co'],
    ['üres URL', ''],
    ['szemét', 'nem-egy-url'],
    ['nem http protokoll', 'ftp://fbproject.supabase.co'],
  ])('érvénytelen env URL (%s) → fallback', (_label, url) => {
    expect(
      resolveCloudEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: 'valami' }, FB),
    ).toMatchObject({ source: 'fallback', url: FB.url, anonKey: FB.anonKey });
  });

  it('az auto-injektált Lovable Cloud (*.lovable.cloud) env végpontot figyelmen kívül hagyja → fallback', () => {
    expect(
      resolveCloudEnv(
        {
          VITE_SUPABASE_URL: 'https://c--abc123-prod.lovable.cloud',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_lovable_cloud',
        },
        FB,
      ),
    ).toMatchObject({ source: 'fallback', url: FB.url, anonKey: FB.anonKey });
  });

  it('eltérő Supabase projekt ref az env URL-ben → fallback (kulcs nem tartozik a projekthez)', () => {
    expect(
      resolveCloudEnv(
        {
          VITE_SUPABASE_URL: 'https://other-project.supabase.co',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fallback',
        },
        FB,
      ),
    ).toMatchObject({ source: 'fallback', url: FB.url, anonKey: FB.anonKey });
  });

  it('ugyanaz a projekt ref mint a fallback → env (nem fallback)', () => {
    expect(
      resolveCloudEnv(
        {
          VITE_SUPABASE_URL: 'https://fbproject.supabase.co',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging',
        },
        FB,
      ),
    ).toMatchObject({ source: 'env', anonKey: 'sb_publishable_staging' });
  });

  it('csak whitespace kulcs → fallback, nem env', () => {
    expect(
      resolveCloudEnv(
        {
          VITE_SUPABASE_URL: 'https://fbproject.supabase.co',
          VITE_SUPABASE_PUBLISHABLE_KEY: '   ',
          VITE_SUPABASE_ANON_KEY: '',
        },
        FB,
      ),
    ).toMatchObject({ source: 'fallback' });
  });

  it('null csak akkor, ha az env ÉS a fallback is érvénytelen', () => {
    expect(resolveCloudEnv({}, { url: '', anonKey: '' })).toBeNull();
    expect(resolveCloudEnv({}, { url: FB.url, anonKey: '' })).toBeNull();
  });

  it('a beépített fallback miatt a futó app sosem `unconfigured`', () => {
    const env = readCloudEnv();
    expect(env).not.toBeNull();
    expect(isCloudTierConfigured()).toBe(true);
    expect(cloudEndpointSummary()?.url).toMatch(/^https:\/\//);
  });

  it('a feloldott konfiguráció a session alatt stabil és fagyasztott (cache)', () => {
    const first = readCloudEnv();
    expect(readCloudEnv()).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
  });
});
