import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type State = { error: Error | null };

/** Catches render errors anywhere in the studio and offers a recovery path. */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('WinMix render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-lg">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold text-foreground">Hiba történt a megjelenítésben</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Az adataid a böngészőben biztonságban vannak. Próbáld újra, vagy töltsd újra az oldalt.
          </p>
          <p className="mt-3 break-words rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
            {this.state.error.message}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Újrapróbálás
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Oldal újratöltése
            </button>
          </div>
        </div>
      </div>
    );
  }
}
