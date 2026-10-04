import React, { useEffect, useState } from 'react';
import { KeyRound, Sparkles } from 'lucide-react';
import { ADMIN_TOKEN_KEY, analyzeSchemaSnapshot, readAdminToken, type IngestRowError } from '../../../utils/supabaseTier';

export function AdminTokenField() {
  const [token, setToken] = useState('');
  useEffect(() => setToken(readAdminToken()), []);
  return (
    <label className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-ui-xs text-muted-foreground sm:px-4">
      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
      Admin kód (feltöltéshez és séma-elemzéshez):
      <input
        type="password"
        className="min-w-[12rem] flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-foreground"
        value={token}
        onChange={(e) => {
          setToken(e.target.value);
          try { window.sessionStorage.setItem(ADMIN_TOKEN_KEY, e.target.value); } catch { /* ignore */ }
        }}
        placeholder="csak ebben a böngészőfülben marad meg"
      />
    </label>
  );
}

export function RowErrorTable({ rows }: { rows: IngestRowError[] }) {
  if (!rows.length) return null;
  return (
    <div className="max-h-72 overflow-auto border-b border-border px-3 py-2 sm:px-4">
      <p className="mb-1 text-ui-xs font-bold text-foreground">Kihagyott sorok ({rows.length})</p>
      <table className="w-full text-ui-xs">
        <thead className="text-muted-foreground">
          <tr><th className="text-left">Szezon</th><th className="text-left">#</th><th className="text-left">Mérkőzés</th><th className="text-left">Ok</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="pr-2">{r.season}</td><td className="pr-2">{r.matchNo}</td>
              <td className="pr-2">{r.match}</td><td className="text-error">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SchemaAnalyzer() {
  const [schema, setSchema] = useState('');
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setError(''); setReport('');
    try {
      setReport(await analyzeSchemaSnapshot(schema));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="border-b border-border px-3 py-3 text-ui-xs sm:px-4">
      <summary className="cursor-pointer font-bold text-foreground">
        <Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
        Séma-kompatibilitás elemzése (AI)
      </summary>
      <p className="mt-2 text-muted-foreground">
        Illeszd be az adatbázis táblákat létrehozó SQL-t vagy a táblaszerkezetet. Az elemzés megmutatja, mi hiányzik
        a WinMix oldalakhoz, és futtatható SQL javaslatot ad.
      </p>
      <textarea
        className="mt-2 h-40 w-full rounded border border-border bg-background p-2 font-mono text-foreground"
        value={schema}
        onChange={(e) => setSchema(e.target.value)}
        placeholder="CREATE TABLE public.winmix_matches (...)"
      />
      <button type="button" className="btn btn--outline btn--sm tap mt-2" disabled={busy || schema.trim().length < 10} onClick={() => void run()}>
        {busy ? 'Elemzés…' : 'Elemzés indítása'}
      </button>
      {error ? <p className="mt-2 text-error">{error}</p> : null}
      {report ? <pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded border border-border bg-muted p-2 text-foreground">{report}</pre> : null}
    </details>
  );
}
