import React, { createContext, useCallback, useContext, useState } from 'react';
import { LuAlertTriangle, LuHelpCircle } from 'react-icons/lu';

const ConfirmContext = createContext(null);

/**
 * Remplace window.confirm() par une boîte de dialogue au style de l'application,
 * au lieu de la fenêtre système générique du navigateur. Usage :
 *   const confirm = useConfirm();
 *   if (!await confirm({ message: '...', danger: true })) return;
 */
export function ConfirmDialogProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    const {
      title = opts.danger ? 'Confirmer la suppression' : 'Confirmer',
      message,
      confirmLabel = opts.danger ? 'Supprimer' : 'Confirmer',
      cancelLabel = 'Annuler',
      danger = false,
    } = opts;
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, cancelLabel, danger, resolve });
    });
  }, []);

  function close(result) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-black/50' onClick={() => close(false)} />
          <div className='relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl'>
            <div className='flex items-start gap-3'>
              <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${state.danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                {state.danger ? <LuAlertTriangle size={20} /> : <LuHelpCircle size={20} />}
              </span>
              <div className='min-w-0 pt-1'>
                <h3 className='text-base font-semibold text-foreground'>{state.title}</h3>
                <p className='text-sm text-muted-foreground mt-1'>{state.message}</p>
              </div>
            </div>
            <div className='flex justify-end gap-2 mt-5'>
              <button onClick={() => close(false)} className='btn btn-sm btn-ghost'>
                {state.cancelLabel}
              </button>
              <button
                onClick={() => close(true)}
                className={`btn btn-sm text-white border-0 hover:opacity-90 ${state.danger ? 'bg-destructive' : 'bg-primary'}`}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm doit être utilisé à l\'intérieur de ConfirmDialogProvider');
  return ctx;
}
