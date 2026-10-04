import type { League } from '../types/winmix';

/* ------------------------------------------------------------------ *
 * VIRTUAL TEAM REGISTRIES
 * ------------------------------------------------------------------
 * These leagues are VIRTUAL. Their team names ("London Ágyúk", "Vörös
 * Ördögök", "Manchester Kék", "Madrid Fehér", "Katalán Óriás", "Aston
 * Oroszlán", "Matracosok", …) are the true domain entities of this
 * application — they are NOT typos or approximations of real-world clubs.
 *
 * HARD RULES:
 *  - These lists are used for ONE purpose only: routing an uploaded file to the
 *    right league when the filename does not say. They NEVER rename, alias,
 *    merge or "correct" a team.
 *  - Matching is EXACT (on the accent-stripped internal key). There is no fuzzy
 *    matcher, no edit-distance search and no real-world club dictionary.
 *  - Real-world counterparts of virtual names were deliberately removed from
 *    these registries so they cannot act as an aliasing dictionary.
 *  - A name appearing here is never substituted into the UI. Display names
 *    always come from the uploaded data (see `utils/teams.ts`).
 * ------------------------------------------------------------------ */

export const EN_VIRTUAL_TEAMS = [
'chelsea',
'west ham',
'nottingham',
'vörös ördögök',
'wolverhampton',
'brighton',
'crystal palace',
'newcastle',
'liverpool',
'everton',
'brentford',
'fulham',
'manchester kék',
'tottenham',
'london ágyúk',
'aston oroszlán'];


export const ES_VIRTUAL_TEAMS = [
'madrid fehér',
'katalán óriás',
'matracosok',
'sevilla',
'valencia',
'villarreal',
'betis',
'athletic bilbao',
'celta vigo',
'mallorca',
'osasuna',
'rayo vallecano',
'getafe',
'alaves',
'las palmas',
'granada',
'cadiz',
'almeria'];


export const LEAGUE_LABEL: Record<League, string> = {
  angol: 'Angol',
  spanyol: 'Spanyol'
};

export const LEAGUE_FLAG: Record<League, string> = {
  angol: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  spanyol: '🇪🇸'
};

export const LEAGUE_SEASON_PREFIX: Record<League, string> = {
  angol: 'Angol bajnokság',
  spanyol: 'Spanyol bajnokság'
};

export const LEAGUES: League[] = ['angol', 'spanyol'];