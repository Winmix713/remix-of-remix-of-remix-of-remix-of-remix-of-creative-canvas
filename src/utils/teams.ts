/**
 * TWO-TIER TEAM IDENTITY
 * ======================
 *
 * The leagues in this application are VIRTUAL and their team names are
 * deliberate fantasy names ("London Ágyúk", "Vörös Ördögök", "Madrid Fehér",
 * …). They are the real domain entities, so they are never "corrected".
 *
 *   DISPLAY NAME     Exactly as uploaded, with original casing and accents.
 *                    Used in the UI, standings, H2H, predictor and exports.
 *                    Stored per league in `teamAliasMap[league][key]`.
 *
 *   CANONICAL KEY    Accent-stripped, lower-cased, whitespace-collapsed.
 *                    Used ONLY as an internal Map key / grouping / index /
 *                    JSON storage key, where diacritics are unsafe.
 *
 *   const teamDisplayName  = 'London Ágyúk'  // UI
 *   const teamCanonicalKey = 'london agyuk'  // Map keys, weights, indexes
 *
 * HARD RULES:
 *  - `canon()` performs a pure, reversible-by-lookup normalisation. It does NOT
 *    consult any dictionary and does NOT map a virtual team onto a real-world
 *    club. There is no fuzzy matcher in this codebase by design.
 *  - The canonical key is never rendered when a display name is available;
 *    always resolve through {@link displayNameOf}.
 */

/**
 * Internal key normalisation: lower-case, strip diacritics, collapse
 * whitespace. Nothing else — no punctuation rewriting, no abbreviation
 * expansion, no dictionary lookup.
 */
export function normalizeForMatch(value: string | null | undefined): string {
  return String(value ?? '').
  toLowerCase().
  normalize('NFD').
  replace(/[\u0300-\u036f]/g, '').
  replace(/\s+/g, ' ').
  trim();
}

/** The computational key for a team. Never shown to the user. */
export function canon(name: string | null | undefined): string {
  return normalizeForMatch(name);
}

/**
 * The user-facing name for a canonical key.
 *
 * Resolution order: the registered display name (the exact uploaded spelling),
 * then an explicit fallback, then the key itself as a last resort.
 */
export function displayNameOf(
aliases: Record<string, string> | undefined,
key: string,
fallback?: string | null)
: string {
  const registered = aliases?.[key];
  if (registered) return registered;
  if (fallback) return fallback;
  return key;
}

/** FNV-1a — used for content hashes and stable DOM-safe ids. */
export function simpleHash(str: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}