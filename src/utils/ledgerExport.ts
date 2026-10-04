import { SLIP_STATUS_LABEL, gradeLine, slipStatus } from './ledger';
import { PATTERN_LABEL } from './patterns';
import type { Slip } from '../types/winmix';

const HEADER = [
'szelvény',
'létrehozva',
'szelvény_státusz',
'mérkőzés',
'liga',
'mintatípus',
'piac_kód',
'piac_megnevezés',
'jelzett_valószínűség',
'stabilitás',
'minta_n',
'ht_hazai',
'ht_vendég',
'ft_hazai',
'ft_vendég',
'kiértékelés'];


const GRADE_LABEL: Record<string, string> = {
  won: 'Bejött',
  lost: 'Nem jött be',
  pending: 'Függőben'
};

function cell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Semicolon-separated so Hungarian Excel opens it without an import wizard. */
export function slipsToCsv(slips: Slip[]): string {
  const rows: string[] = [HEADER.join(';')];

  slips.forEach((slip) => {
    const status = SLIP_STATUS_LABEL[slipStatus(slip)];
    slip.lines.forEach((line) => {
      rows.push(
        [
        slip.roundName,
        new Date(slip.createdAt).toLocaleString('hu-HU'),
        status,
        line.fixtureLabel,
        line.league,
        PATTERN_LABEL[line.type] ?? line.type,
        line.code,
        line.label,
        (line.hitRate * 100).toFixed(1).replace('.', ','),
        line.stability,
        line.sample,
        line.htHome,
        line.htAway,
        line.ftHome,
        line.ftAway,
        GRADE_LABEL[gradeLine(line)] ?? ''].

        map(cell).
        join(';')
      );
    });
  });

  return rows.join('\r\n');
}

export function downloadLedgerCsv(slips: Slip[]): void {
  // The BOM is what makes Excel read the Hungarian accents correctly.
  const blob = new Blob([`\uFEFF${slipsToCsv(slips)}`], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `winmix-naplo-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}