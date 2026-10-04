/** Public browser configuration pinned to the requested WinMix project. */
const PROJECT_URL = 'https://dpmyxypqcsugycqhifaf.supabase.co';
const PUBLIC_KEY = 'sb_publishable_Xll_LdXYYBtizcduj2aPDQ_tqkI5r1S';
export interface CloudEnv { url: string; anonKey: string; source: 'env' | 'fallback'; dataVersionId?: string; }
function publicKey(key: string): boolean {
  return key.startsWith('sb_publishable_') || /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key);
}
function validEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === PROJECT_URL && !url.username && !url.password &&
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
  // Explicit but wrong/partial configuration must not silently use another key.
  if (url || key) return validEndpoint(url) && publicKey(key)
    ? Object.freeze({ url: PROJECT_URL, anonKey: key, source: 'env', dataVersionId }) : null;
  return validEndpoint(fallback.url) && publicKey(fallback.anonKey)
    ? Object.freeze({ url: PROJECT_URL, anonKey: fallback.anonKey, source: 'fallback', dataVersionId }) : null;
}
let cached: CloudEnv | null | undefined;
export function readCloudEnv(): CloudEnv | null {
  if (cached !== undefined) return cached;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return cached = resolveCloudEnv(env);
}
