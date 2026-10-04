/**
 * Public, read-only connection details for the optional cloud tier.
 *
 * The publishable key is a PUBLIC key: it is safe in client source because every
 * table it can reach sits behind RLS that grants `select` only. The service-role
 * key is a server-only secret and must never appear anywhere in client code.
 *
 * Resolution order:
 *  1. Vite environment (`.env` → VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY,
 *     or the historical VITE_SUPABASE_ANON_KEY name)
 *  2. The baked-in fallback below (the Lovable Cloud project of this app), so
 *     the tier also works in builds where a `.env` file is not injected.
 *  3. `null` — genuinely unconfigured. Reachable only if BOTH the env and the
 *     fallback fail validation (e.g. someone blanks out the constants below
 *     for a stripped build). See docs/supabase-migration.md §1.3.
 */

const FALLBACK_URL = 'https://dpmyxypqcsugycqhifaf.supabase.co';
/** Publishable key (WinMix project dpmyxypqcsugycqhifaf) — browser-safe behind RLS. */
const FALLBACK_ANON_KEY = 'sb_publishable_Xll_LdXYYBtizcduj2aPDQ_tqkI5r1S';

export interface CloudEnv {
  url: string;
  anonKey: string;
  /** Where the credentials came from — surfaced in diagnostics. */
  source: 'env' | 'fallback';
}

function fromEnv(key: string): string {
  const env =
  (import.meta as unknown as {env?: Record<string, string | undefined>;}).env ?? {};
  return (env[key] ?? '').trim();
}

/**
 * Only a well-formed `http(s)://…` URL counts as "present". A blank or
 * malformed `.env` value (missing scheme, stray whitespace, a pasted
 * dashboard URL) must fail validation here rather than surface as a
 * confusing CORS/network error three layers down in `supabaseTier.ts`.
 */
function isValidHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isNonEmptyKey(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * The auto-injected Lovable Cloud endpoint (`*.lovable.cloud`) is a separate,
 * empty backend — it must NOT override this app's own Supabase project. When
 * the env points there, we fall through to the baked-in fallback instead.
 */
function isLovableCloudUrl(value: string): boolean {
  try {
    return new URL(value).hostname.endsWith('.lovable.cloud');
  } catch {
    return false;
  }
}

/** Extracts the project ref (first subdomain label) from a `*.supabase.co` URL. */
function supabaseProjectRef(value: string): string | null {
  try {
    const host = new URL(value).hostname;
    const m = /^([^.]+)\.supabase\.co$/.exec(host);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Pure resolution over an arbitrary env bag — the single source of truth for
 * the documented order, and the unit-testable seam (`import.meta.env` is
 * frozen at build time, so it cannot be stubbed in tests).
 */
export function resolveCloudEnv(
  env: Record<string, string | undefined>,
  fallback: { url: string; anonKey: string } = { url: FALLBACK_URL, anonKey: FALLBACK_ANON_KEY }
): CloudEnv | null {
  const envUrl = (env['VITE_SUPABASE_URL'] ?? '').trim();
  const envKey =
    (env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? '').trim() ||
    (env['VITE_SUPABASE_ANON_KEY'] ?? '').trim();


  // If the env URL points to a different Supabase project than the fallback,
  // the baked-in key won't be accepted (401). Fall through to the fallback so
  // the cloud tier connects to the project the key actually belongs to.
  const envRef = supabaseProjectRef(envUrl);
  const fallbackRef = supabaseProjectRef(fallback.url);
  const refMismatch = envRef && fallbackRef && envRef !== fallbackRef;

  if (isValidHttpUrl(envUrl) && isNonEmptyKey(envKey) && !isLovableCloudUrl(envUrl) && !refMismatch) {
    return Object.freeze({
      url: envUrl.replace(/\/+$/, ''),
      anonKey: envKey,
      source: 'env' as const
    });
  }

  if (isValidHttpUrl(fallback.url) && isNonEmptyKey(fallback.anonKey)) {
    return Object.freeze({
      url: fallback.url.replace(/\/+$/, ''),
      anonKey: fallback.anonKey,
      source: 'fallback' as const
    });
  }

  return null;
}

// `.env` is baked in at build time by Vite, so the resolved config can never
// change within a running session — compute it once and reuse it.
let cachedEnv: CloudEnv | null | undefined;

export function readCloudEnv(): CloudEnv | null {
  if (cachedEnv !== undefined) return cachedEnv;
  cachedEnv = resolveCloudEnv({
    VITE_SUPABASE_URL: fromEnv('VITE_SUPABASE_URL'),
    VITE_SUPABASE_PUBLISHABLE_KEY: fromEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
    VITE_SUPABASE_ANON_KEY: fromEnv('VITE_SUPABASE_ANON_KEY')
  });
  return cachedEnv;
}

