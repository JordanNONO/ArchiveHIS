import React, { createContext, useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LuX, LuFileText, LuMail, LuPhone, LuClipboardCheck, LuLoader } from 'react-icons/lu';
import { getDossierPersonne } from '../api/routes/personnel';
import { SERVER_URL } from '../api';

const DossierPersonneContext = createContext(null);

const ICONES_TYPE = {
  document: { icon: LuFileText, classe: 'bg-primary text-white' },
  courrier: { icon: LuMail, classe: 'bg-accent text-accent-foreground' },
  appel: { icon: LuPhone, classe: 'bg-secondary text-white' },
  pai: { icon: LuClipboardCheck, classe: 'bg-green-600 text-white' },
};

/**
 * Dossier unique d'une personne — volet léger (pas de page dédiée, décision
 * explicite : "je ne pense pas que c'est nécessaire de faire toute une page
 * pour ça") ouvrable depuis n'importe où un nom de personne apparaît déjà,
 * sans jamais changer d'URL ni quitter la page en cours.
 * Usage : const { ouvrirDossier } = useDossierPersonne(); ouvrirDossier(personnelId)
 */
export function DossierPersonneProvider({ children }) {
  const [personnelId, setPersonnelId] = useState(null);
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [tout, setTout] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const ouvrirDossier = useCallback((id) => {
    setPersonnelId(id);
    setTout(false);
    setDonnees(null);
    setChargement(true);
    getDossierPersonne(id).then(async (res) => {
      if (res.status === 200) setDonnees(await res.json());
      setChargement(false);
    }).catch(() => setChargement(false));
  }, []);

  function fermer() {
    setPersonnelId(null);
    setDonnees(null);
  }

  function allerVers(lien) {
    fermer();
    navigate(lien);
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString(i18n.language) : '';
  const evenements = donnees?.evenements || [];
  const evenementsAffiches = tout ? evenements : evenements.slice(0, 5);

  return (
    <DossierPersonneContext.Provider value={{ ouvrirDossier }}>
      {children}
      {personnelId && (
        <div className='fixed inset-0 z-[100] flex justify-end'>
          <div className='absolute inset-0 bg-black/40' onClick={fermer} />
          <div className='relative w-full max-w-[420px] h-full bg-background shadow-2xl overflow-y-auto animate-wizard-rise-in'>
            <div className='sticky top-0 bg-card border-b border-border p-5 z-10'>
              <button onClick={fermer} className='absolute top-4 right-4 flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:bg-muted transition-colors'>
                <LuX size={15} />
              </button>
              {chargement ? (
                <div className='flex items-center gap-3 py-2'>
                  <LuLoader size={18} className='animate-spin text-muted-foreground' />
                </div>
              ) : donnees ? (
                <>
                  <div className='flex items-center gap-3'>
                    {donnees.personnel?.photo_url ? (
                      <img src={SERVER_URL + donnees.personnel.photo_url} alt='' className='w-11 h-11 rounded-xl object-cover shrink-0' />
                    ) : (
                      <div className='w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center font-serif font-bold shrink-0'>
                        {`${donnees.personnel?.prenom?.[0] || ''}${donnees.personnel?.nom?.[0] || ''}`}
                      </div>
                    )}
                    <div className='min-w-0'>
                      <h2 className='font-serif text-lg font-bold truncate'>{`${donnees.personnel?.prenom || ''} ${donnees.personnel?.nom || ''}`.trim()}</h2>
                      <p className='text-xs text-muted-foreground truncate'>
                        {(donnees.personnel?.user?.roles || []).map((r) => r.nom).join(', ') || '—'}
                        {donnees.personnel?.bureau?.name ? ` · ${donnees.personnel.bureau.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className='flex gap-2 mt-3.5'>
                    {[
                      ['documents', t('sidebar.documents')],
                      ['pai', 'PAI'],
                      ['courriers', t('sidebar.courriers')],
                      ['appels', t('sidebar.appels')],
                    ].map(([cle, label]) => (
                      <div key={cle} className='flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-center'>
                        <p className='font-serif text-base font-bold leading-none tabular-nums'>{donnees.totaux?.[cle] ?? 0}</p>
                        <p className='text-[10px] text-muted-foreground mt-1 truncate'>{label}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className='p-5'>
              {!chargement && evenements.length === 0 && (
                <p className='text-sm text-muted-foreground text-center py-10'>{t('commun.aucuneDonnee')}</p>
              )}
              <div className='relative pl-6'>
                {evenementsAffiches.length > 0 && (
                  <div className='absolute left-[7px] top-1 bottom-1 w-px bg-border' />
                )}
                {evenementsAffiches.map((e, i) => {
                  const { icon: Icon, classe } = ICONES_TYPE[e.type] || ICONES_TYPE.document;
                  return (
                    <button
                      key={i}
                      onClick={() => allerVers(e.lien)}
                      className='relative block w-full text-left mb-3.5 last:mb-0'
                    >
                      <span className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center ${classe}`}>
                        <Icon size={9} />
                      </span>
                      <p className='text-sm font-medium text-foreground truncate hover:underline'>{e.titre || '—'}</p>
                      <p className='text-xs text-muted-foreground'>{formatDate(e.date)}{e.meta ? ` · ${e.meta}` : ''}</p>
                    </button>
                  );
                })}
              </div>
              {!tout && evenements.length > 5 && (
                <button
                  onClick={() => setTout(true)}
                  className='block w-full text-center text-sm font-medium text-primary border border-border rounded-lg py-2.5 mt-1 hover:bg-muted transition-colors'
                >
                  {t('commun.voirTout', { count: evenements.length })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DossierPersonneContext.Provider>
  );
}

export function useDossierPersonne() {
  const ctx = useContext(DossierPersonneContext);
  if (!ctx) throw new Error('useDossierPersonne doit être utilisé à l\'intérieur de DossierPersonneProvider');
  return ctx;
}
