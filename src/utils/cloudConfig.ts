/** Public browser configuration pinned to the requested WinMix project. */
const PROJECT_URL = 'https://dpmyxypqcsugycqhifaf.supabase.co';
const PUBLIC_KEY = 'sb_publishable_Xll_LdXYYBtizcduj2aPDQ_tqkI5r1S';
export interface CloudEnv { url: string; anonKey: string; source: 'env' | 'fallback'; dataVersionId?: string; }
function publicKey(key: string): boolean {
  return key.length > 0 && (key.startsWith('sb_publishable_') || /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key) || !key.includes(' '));
}
function validEndpoint(value: string, expectedOrigin: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === expectedOrigin && !url.username && !url.password &&
      !url.search && !url.hash && (url.pathname === '/' || url.pathname === '');
  } catch { return false; }
}
export function resolveCloudEnv(
  env: Record<string, string | undefined>,
  fallback = { url: PROJECT_URL, anonKey: PUBLIC_KEY }
): CloudEnv | null {
  const url = (env.VITE_SUPABASE_URL ?? '').trim();
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim() || (env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const dataVersionId = (env.VITE_WINMIX_DATA_VERSION_ID ?? '').trim();
  if (dataVersionId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(dataVersionId)) return null;
  const fallbackOrigin = (() => {
    try { return new URL(fallback.url).origin; } catch { return ''; }
  })();
  const withVersion = (value: { url: string; anonKey: string; source: 'env' | 'fallback' }): CloudEnv =>
    dataVersionId ? Object.freeze({ ...value, dataVersionId }) : Object.freeze(value);
  if (url && validEndpoint(url, fallbackOrigin) && publicKey(key)) {
    return withVersion({ url: fallbackOrigin, anonKey: key, source: 'env' });
  }
  return fallbackOrigin && validEndpoint(fallbackOrigin, fallbackOrigin) && publicKey(fallback.anonKey)
    ? withVersion({ url: fallbackOrigin, anonKey: fallback.anonKey, source: 'fallback' }) : null;
}
let cached: CloudEnv | null | undefined;
export function readCloudEnv(): CloudEnv | null {
  if (cached !== undefined) return cached;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return cached = resolveCloudEnv(env);
}
