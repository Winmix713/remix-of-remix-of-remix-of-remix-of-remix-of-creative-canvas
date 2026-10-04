import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface DialogRequest {
  kind: 'confirm' | 'alert';
  message: string;
  resolve: (value: boolean) => void;
}

interface DialogContextValue {
  confirm: (message: string) => Promise<boolean>;
  alert: (message: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: {children: React.ReactNode;}) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (message: string) =>
    new Promise<boolean>((resolve) => {
      setRequest({ kind: 'confirm', message, resolve });
    }),
    []
  );

  const alert = useCallback(
    (message: string) =>
    new Promise<void>((resolve) => {
      setRequest({ kind: 'alert', message, resolve: () => resolve() });
    }),
    []
  );

  const settle = useCallback(
    (value: boolean) => {
      setRequest((current) => {
        current?.resolve(value);
        return null;
      });
    },
    []
  );

  const onEscape = useCallback(() => settle(false), [settle]);

  /**
   * PHASE 0 FIX — this dialog used to call `preventDefault()` on every Tab, so
   * focus was pinned to a single button with no keyboard route between "Mégse"
   * and "Megerősítem". A real trap cycles focus inside the dialog and restores
   * it on close.
   */
  const trapRef = useFocusTrap<HTMLDivElement>({
    active: Boolean(request),
    onEscape,
    initialFocusRef: primaryRef
  });

  // Enter confirms an alert (its only action); confirms need an explicit choice.
  useEffect(() => {
    if (!request || request.kind !== 'alert') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') settle(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [request, settle]);

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {request ?
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) settle(false);
        }}>
        
          <div
          ref={trapRef}
          role="dialog"
          aria-modal="true"
          aria-label={request.kind === 'confirm' ? 'Megerősítés' : 'Értesítés'}
          className="flex w-full max-w-[420px] flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-panel-lg">
          
            <p className="text-[13px] leading-relaxed text-foreground">{request.message}</p>
            <div className="flex justify-end gap-2">
              {request.kind === 'confirm' ?
            <>
                  <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => settle(false)}>
                
                    Mégse
                  </button>
                  <button
                ref={primaryRef}
                type="button"
                className="btn btn--sm border border-destructive/40 bg-destructive/15 text-destructive hover:border-destructive"
                onClick={() => settle(true)}>
                
                    Megerősítem
                  </button>
                </> :

            <button
              ref={primaryRef}
              type="button"
              className="btn btn--signal btn--sm"
              onClick={() => settle(true)}>
              
                  Rendben
                </button>
            }
            </div>
          </div>
        </div> :
      null}
    </DialogContext.Provider>);

}

export function useDialogs(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside a DialogProvider');
  return ctx;
}