import { EN_VIRTUAL_TEAMS, ES_VIRTUAL_TEAMS } from '../data/leagues';
import type {
  CsvParseStats,
  LeagueDetection,
  MatchRow,
  ParsedCsv,
  SkippedRow } from
'../types/winmix';
import { finalizeMatchOrder, parseMatchDate } from './matchDate';
import { checkScores, fixtureSignature } from './matchIntegrity';
import { canon, normalizeForMatch, simpleHash } from './teams';

export { finalizeMatchOrder };
export type { OrderedMatches } from './matchDate';

export function parseCsvLine(line: string): string[] {
  const res: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;else
    if (c === ',' && !inQuotes) {
      res.push(cur.replace(/^"|"$/g, ''));
      cur = '';
    } else cur += c;
  }
  res.push(cur.replace(/^"|"$/g, ''));
  return res;
}

export interface ParseCsvOptions {
  /**
   * Stable identity of the file being parsed. Together with the row index this
   * gives every undated row a unique identity, so genuine repeat fixtures are
   * never mistaken for duplicates.
   */
  sourceFileId?: string;
}

function emptyStats(): CsvParseStats {
  return {
    dataRows: 0,
    accepted: 0,
    rejected: 0,
    repaired: 0,
    dated: 0,
    hasDateColumn: false
  };
}

/** Per-row diagnostics instead of silently dropping unreadable rows. */
export function parseCsvText(csvContent: string, options: ParseCsvOptions = {}): ParsedCsv {
  const sourceFileId = options.sourceFileId ?? null;
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const skippedRows: SkippedRow[] = [];
  const repairedRows: SkippedRow[] = [];
  const stats = emptyStats();

  if (lines.length < 2) {
    return {
      matches: [],
      skippedRows: [
      { line: 0, reason: 'A fájl üres vagy nincs benne fejléc + adatsor.', kind: 'header' }],

      repairedRows,
      stats
    };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const idxDate = headers.indexOf('date');
  const idxHome = headers.indexOf('home_team');
  const idxAway = headers.indexOf('away_team');
  const idxHtHome = headers.indexOf('ht_home_score');
  const idxHtAway = headers.indexOf('ht_away_score');
  const idxHomeScore = headers.indexOf('home_score');
  const idxAwayScore = headers.indexOf('away_score');
  stats.hasDateColumn = idxDate !== -1;

  if (idxHome === -1 || idxAway === -1 || idxHomeScore === -1 || idxAwayScore === -1) {
    return {
      matches: [],
      skippedRows: [
      {
        line: 1,
        reason:
        'Hiányzó kötelező oszlop(ok): home_team / away_team / home_score / away_score.',
        kind: 'header'
      }],

      repairedRows,
      stats
    };
  }

  const results: MatchRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = i + 1;
    const rowIndex = i;
    stats.dataRows++;

    const row = parseCsvLine(lines[i]);
    if (row.length <= Math.max(idxHome, idxAway, idxHomeScore, idxAwayScore)) {
      skippedRows.push({ line, reason: 'Túl kevés oszlop a sorban.', kind: 'structure' });
      stats.rejected++;
      continue;
    }

    const homeTeam = row[idxHome]?.trim();
    const awayTeam = row[idxAway]?.trim();
    if (!homeTeam || !awayTeam) {
      skippedRows.push({ line, reason: 'Hiányzó csapatnév.', kind: 'missing_team' });
      stats.rejected++;
      continue;
    }

    const rawDate = idxDate !== -1 ? row[idxDate]?.trim() ?? '' : '';
    const parsedDate = parseMatchDate(rawDate);
    if (parsedDate.unparsed) {
      repairedRows.push({
        line,
        reason: `Értelmezhetetlen dátum ("${rawDate}") — a sor megtartva, de kronológiailag nem rendezhető.`,
        kind: 'invalid_date'
      });
    }

    const rawHtHome = idxHtHome !== -1 ? row[idxHtHome]?.trim() : '';
    const rawHtAway = idxHtAway !== -1 ? row[idxHtAway]?.trim() : '';
    const htHome = rawHtHome ? Number.parseInt(rawHtHome, 10) : NaN;
    const htAway = rawHtAway ? Number.parseInt(rawHtAway, 10) : NaN;
    const homeScore = Number.parseInt(row[idxHomeScore], 10);
    const awayScore = Number.parseInt(row[idxAwayScore], 10);

    const check = checkScores({
      homeScore,
      awayScore,
      htHome: Number.isNaN(htHome) ? null : htHome,
      htAway: Number.isNaN(htAway) ? null : htAway
    });

    if (check.status === 'rejected') {
      skippedRows.push({ line, reason: check.reason ?? 'Érvénytelen eredmény.', kind: 'invalid_score' });
      stats.rejected++;
      continue;
    }
    if (check.status === 'repaired' && check.reason) {
      repairedRows.push({ line, reason: check.reason, kind: 'invalid_score' });
      stats.repaired++;
    }

    stats.accepted++;
    if (parsedDate.iso) stats.dated++;

    results.push({
      // Reassigned to the chronological position by `finalizeMatchOrder`.
      match_no: rowIndex,
      date: rawDate,
      kickoffIso: parsedDate.iso,
      rowIndex,
      sourceFileId,
      home_team: homeTeam,
      away_team: awayTeam,
      ht_home_score: check.htHome,
      ht_away_score: check.htAway,
      home_score: homeScore,
      away_score: awayScore,
      total_goals: homeScore + awayScore,
      btts: homeScore > 0 && awayScore > 0,
      outcome: homeScore > awayScore ? 'H' : homeScore === awayScore ? 'D' : 'A'
    });
  }

  return { matches: results, skippedRows, repairedRows, stats };
}

export interface DedupeResult {
  unique: MatchRow[];
  /** Rows removed as provable duplicates (same instant, teams and score). */
  dupCount: number;
  /**
   * Undated rows that look alike (same fixture and score) but cannot be proven
   * duplicates. These are KEPT — two 1-1 draws between the same teams are a
   * normal home/away pair, not a data error.
   */
  ambiguousCount: number;
}

/**
 * Duplicate row detection.
 *
 * PHASE 0 FIX — the previous key was `date|home|away|score`, and because a
 * missing date column was substituted with the literal `'00:00'`, every second
 * meeting of two teams that ended with the same score was silently deleted. A
 * season with two 1-1 draws between the same pair lost a real match.
 *
 * The identity is now:
 *   - dated row   → kickoff instant + teams + score (a provable duplicate)
 *   - undated row → source file + row index (unique by construction)
 */
export function dedupeMatches(matches: MatchRow[]): DedupeResult {
  const seen = new Set<string>();
  const undatedSignatures = new Set<string>();
  const unique: MatchRow[] = [];
  let dupCount = 0;
  let ambiguousCount = 0;

  matches.forEach((m, index) => {
    const homeKey = canon(m.home_team);
    const awayKey = canon(m.away_team);
    const scores = `${m.home_score}-${m.away_score}`;

    if (m.kickoffIso) {
      const key = `d|${m.kickoffIso}|${homeKey}|${awayKey}|${scores}`;
      if (seen.has(key)) {
        dupCount++;
        return;
      }
      seen.add(key);
    } else {
      const signature = fixtureSignature({
        homeKey,
        awayKey,
        homeScore: m.home_score,
        awayScore: m.away_score
      });
      if (undatedSignatures.has(signature)) ambiguousCount++;else
      undatedSignatures.add(signature);

      const key = `u|${m.sourceFileId ?? 'unknown'}|${m.rowIndex ?? index}`;
      if (seen.has(key)) {
        dupCount++;
        return;
      }
      seen.add(key);
    }
    unique.push(m);
  });

  return { unique, dupCount, ambiguousCount };
}

/** Whole-file duplicate detection via a lightweight content hash. */
export function contentHashForMatches(matches: MatchRow[]): string {
  const norm = matches.
  map(
    (m) =>
    `${m.kickoffIso ?? m.date ?? ''}|${canon(m.home_team)}|${canon(m.away_team)}|${m.home_score}|${m.away_score}`
  ).
  join(';');
  return simpleHash(norm);
}

/**
 * League routing for an uploaded file.
 *
 * Compares the file's team names against the VIRTUAL team registries using
 * EXACT normalised equality. It only decides *which league a file belongs to* —
 * it never renames, aliases or merges a team, and there is no fuzzy matching.
 * When it cannot tell, it returns 'unknown' so the user picks the league
 * explicitly instead of the data being routed by guesswork.
 */
export function detectLeagueFromMatches(
matches: MatchRow[],
filename: string)
: LeagueDetection {
  const fn = (filename || '').toLowerCase();
  if (
  fn.includes('spanyol') ||
  fn.includes('laliga') ||
  fn.includes('la_liga') ||
  fn.includes('spain'))
  {
    return { league: 'spanyol', confidence: 1, source: 'filename' };
  }
  if (
  fn.includes('angol') ||
  fn.includes('premier') ||
  fn.includes('epl') ||
  fn.includes('england'))
  {
    return { league: 'angol', confidence: 1, source: 'filename' };
  }

  const esSet = new Set(ES_VIRTUAL_TEAMS.map(normalizeForMatch));
  const enSet = new Set(EN_VIRTUAL_TEAMS.map(normalizeForMatch));
  const sampleTeams = new Set<string>();
  matches.slice(0, 30).forEach((m) => {
    sampleTeams.add(m.home_team);
    sampleTeams.add(m.away_team);
  });

  let esScore = 0;
  let enScore = 0;
  sampleTeams.forEach((t) => {
    const nt = normalizeForMatch(t);
    if (esSet.has(nt)) esScore++;
    if (enSet.has(nt)) enScore++;
  });

  const total = sampleTeams.size || 1;
  const esConf = esScore / total;
  const enConf = enScore / total;
  if (Math.max(esConf, enConf) < 0.15) {
    return { league: 'unknown', confidence: Math.max(esConf, enConf), source: 'heuristic' };
  }
  return esConf > enConf ?
  { league: 'spanyol', confidence: esConf, source: 'heuristic' } :
  { league: 'angol', confidence: enConf, source: 'heuristic' };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result ?? ''));
    reader.onerror = () => reject(new Error(`Nem sikerült beolvasni: ${file.name}`));
    reader.readAsText(file);
  });
}

/** Bounded-concurrency batch reader with progress reporting. */
export async function readFilesWithConcurrency(
files: File[],
concurrency: number,
onProgress: (done: number, total: number) => void,
onError?: (message: string) => void)
: Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(files.length).fill(null);
  let nextIndex = 0;
  let done = 0;

  async function worker() {
    while (nextIndex < files.length) {
      const i = nextIndex++;
      try {
        results[i] = await readFileAsText(files[i]);
      } catch (e) {
        results[i] = null;
        onError?.(e instanceof Error ? e.message : String(e));
      }
      done++;
      onProgress(done, files.length);
    }
  }

  const workerCount = Math.min(concurrency, files.length) || 1;
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}