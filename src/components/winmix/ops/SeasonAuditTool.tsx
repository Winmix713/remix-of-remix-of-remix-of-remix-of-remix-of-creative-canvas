import React, { useState } from 'react';
import { FileSearch } from 'lucide-react';
import { auditSeasonFile, type SeasonAuditResult } from '../../../utils/supabaseTier';

const MAX_CHARS = 120_000;

/** Admin-only AI review of a season file. Suggestions only — nothing is changed automatically. */
export function SeasonAuditTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SeasonAuditResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const content = await file.text();
      if (content.length > MAX_CHARS) throw new Error(`A fájl túl nagy (max. ${MAX_CHARS.toLocaleString('hu-HU')} karakter). Szezononként küldd.`);
      setResult(await auditSeasonFile(file.name, content));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="border-b border-border px-3 py-3 text-ui-xs sm:px-4">
      <summary className="cursor-pointer font-bold text-foreground">
        <FileSearch className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
        Szezonfájl ellenőrzése (AI)
      </summary>
      <p className="mt-2 text-muted-foreground">
        Válassz ki egy szezon CSV- vagy JSON-fájlt. Az AI megkeresi a hibás vagy ellentmondásos mérkőzéssorokat, és javítást
        javasol. Semmi nem módosul automatikusan.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".csv,.json,.txt,text/csv,application/json"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(''); }}
          className="text-foreground"
        />
        <button type="button" className="btn btn--outline btn--sm tap" disabled={busy || !file} onClick={() => void run()}>
          {busy ? 'Ellenőrzés…' : 'Ellenőrzés indítása'}
        </button>
      </div>
      {error ? <p className="mt-2 text-error">{error}</p> : null}
      {result ? (
        <div className="mt-3">
          {result.summary ? <p className="text-foreground">{result.summary}</p> : null}
          <p className="mt-1 text-muted-foreground">
            {result.rowsChecked !== null ? `${result.rowsChecked} sor ellenőrizve · ` : ''}{result.issues.length} találat
          </p>
          {result.issues.length ? (
            <div className="mt-2 max-h-96 overflow-auto">
              <table className="w-full text-ui-xs">
                <thead className="text-muted-foreground">
                  <tr><th className="text-left">Sor</th><th className="text-left">Mérkőzés</th><th className="text-left">Mező</th><th className="text-left">Probléma</th><th className="text-left">Javaslat</th></tr>
                </thead>
                <tbody>
                  {result.issues.map((i, k) => (
                    <tr key={k} className="border-t border-border align-top">
                      <td className="pr-2">{i.row ?? '—'}</td>
                      <td className="pr-2">{i.match}</td>
                      <td className="pr-2 font-mono">{i.field}</td>
                      <td className={`pr-2 ${i.severity === 'error' ? 'text-error' : 'text-warning'}`}>{i.problem}</td>
                      <td className="text-foreground">{i.suggestion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
