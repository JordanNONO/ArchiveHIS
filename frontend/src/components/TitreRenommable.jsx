import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPencil } from 'react-icons/lu';

const LONGUEUR_MAX = 120;

/**
 * Titre de document renommable sur place, façon Google Docs : un clic sur le
 * titre le rend modifiable, Entrée enregistre, Échap annule.
 *
 * Il fallait auparavant rouvrir tout le formulaire d'archivage — catégorie,
 * référence, auteur — pour corriger un simple nom, ce qui exposait à écraser
 * un autre champ au passage.
 *
 * `peutRenommer` faux : le titre reste du texte, sans aucune affordance. Le
 * serveur reste l'autorité (voir DocumentController::renommer()), ceci
 * n'évite que de proposer une action qui serait refusée.
 */
function TitreRenommable({ titre, peutRenommer, onRenommer }) {
  const { t } = useTranslation();
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(titre || '');
  const [envoi, setEnvoi] = useState(false);
  const champRef = useRef(null);
  // Enregistrer puis perdre le focus ne doit pas déclencher un second envoi.
  const termineRef = useRef(false);

  useEffect(() => { if (!edition) setValeur(titre || ''); }, [titre, edition]);

  useEffect(() => {
    if (!edition) return;
    champRef.current?.focus();
    champRef.current?.select();
  }, [edition]);

  // F2 : raccourci attendu pour renommer, repris des explorateurs de fichiers.
  useEffect(() => {
    if (!peutRenommer) return undefined;
    function surTouche(e) {
      if (e.key === 'F2' && !edition) {
        e.preventDefault();
        ouvrir();
      }
    }
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peutRenommer, edition]);

  function ouvrir() {
    termineRef.current = false;
    setValeur(titre || '');
    setEdition(true);
  }

  function annuler() {
    termineRef.current = true;
    setEdition(false);
    setValeur(titre || '');
  }

  async function enregistrer() {
    if (termineRef.current) return;
    const propre = valeur.trim();
    if (!propre) return;
    termineRef.current = true;

    if (propre === (titre || '')) {
      setEdition(false);
      return;
    }

    setEnvoi(true);
    const ok = await onRenommer(propre);
    setEnvoi(false);
    setEdition(false);
    if (!ok) setValeur(titre || '');
  }

  if (!peutRenommer) {
    return <h2 className='font-bold text-xl break-words'>{titre}</h2>;
  }

  if (edition) {
    const propre = valeur.trim();
    const vide = !propre;
    return (
      <div className='flex flex-col gap-1 min-w-0 flex-1 max-w-xl'>
        <input
          ref={champRef}
          value={valeur}
          maxLength={LONGUEUR_MAX}
          disabled={envoi}
          aria-label={t('docView.nouveauNom')}
          aria-invalid={vide || undefined}
          onChange={(e) => setValeur(e.target.value)}
          onBlur={() => (vide ? annuler() : enregistrer())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); enregistrer(); }
            if (e.key === 'Escape') { e.preventDefault(); annuler(); }
          }}
          className={`w-full rounded-md border-2 bg-background px-2 py-1 font-bold text-xl focus:outline-none disabled:opacity-60 ${vide ? 'border-destructive' : 'border-primary'}`}
        />
        <small className={`text-xs ${vide ? 'text-destructive' : 'text-muted-foreground'}`}>
          {vide ? t('docView.nomVide') : t('docView.aideRenommage', { n: propre.length, max: LONGUEUR_MAX })}
        </small>
      </div>
    );
  }

  return (
    <button
      type='button'
      onClick={ouvrir}
      title={t('docView.renommer')}
      className='group flex items-center gap-1.5 min-w-0 rounded-md border border-transparent px-2 py-0.5 text-left hover:border-border hover:bg-muted transition-colors'
    >
      <h2 className='font-bold text-xl break-words'>{titre}</h2>
      <LuPencil size={15} className='shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity' />
    </button>
  );
}

export default TitreRenommable;
