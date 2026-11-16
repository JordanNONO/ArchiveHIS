import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LuAlertTriangle, LuHelpCircle } from 'react-icons/lu';

const ConfirmContext = createContext(null);

/**
 * Remplace window.confirm() par une boîte de dialogue au style de l'application,
 * au lieu de la fenêtre système générique du navigateur. Usage :
 *   const confirm = useConfirm();
 *   if (!await confirm({ message: '...', danger: true })) return;
 *
 * <dialog> + showModal(), et pas un <div> en position fixe : la plupart des
 * modales de l'application sont des <dialog> natives ouvertes elles aussi
 * avec showModal() (ArchiverDocumentModal, Personnel, Role...). Le navigateur
 * place ces boîtes dans la "top layer", une couche qui passe au-dessus de
 * TOUT le reste quel que soit le z-index — la pile normale n'y donne pas
 * accès. Une confirmation demandée DEPUIS une de ces modales s'affichait donc
 * derrière elle : invisible et incliquable.
 *
 * Le symptôme réel (2026-11-16) : un doublon détecté à l'archivage renvoie un
 * 409, la confirmation "archiver quand même ?" se peignait sous la modale, et
 * l'archivage s'arrêtait sans message. Cinq tentatives, aucun moyen d'aboutir.
 */
export function ConfirmDialogProvider({ children }) {
  const [state, setState] = useState(null);
  const dialogRef = useRef(null);

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

  // Ouverture/fermeture pilotées par l'état : showModal() doit être appelé
  // sur un <dialog> déjà monté, d'où le dialogue toujours présent dans l'arbre
  // (il reste invisible tant qu'il n'est pas ouvert) plutôt que monté à la
  // demande.
  useEffect(() => {
    const boite = dialogRef.current;
    if (!boite) return;
    if (state && !boite.open) boite.showModal();
    if (!state && boite.open) boite.close();
  }, [state]);

  function close(result) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        // Échap ferme nativement : on intercepte pour résoudre la promesse,
        // sinon l'appelant resterait en attente pour toujours.
        onCancel={(e) => { e.preventDefault(); close(false); }}
        // Un clic sur le fond (::backdrop) a pour cible la <dialog> elle-même.
        onClick={(e) => { if (e.target === dialogRef.current) close(false); }}
        className='w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl backdrop:bg-black/50'
      >
        {state && (
          <>
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
          </>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm doit être utilisé à l\'intérieur de ConfirmDialogProvider');
  return ctx;
}
