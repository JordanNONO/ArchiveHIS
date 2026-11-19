import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { LuX, LuFileText, LuMail, LuPhone, LuClipboardCheck, LuLoader, LuFilePlus, LuRefreshCw, LuEye, LuPhoneCall } from 'react-icons/lu';
import { getDossierPersonne } from '../api/routes/personnel';
import { SERVER_URL } from '../api';

const DossierPersonneContext = createContext(null);

const ICONES_TYPE = {
  document: { icon: LuFileText, classe: 'bg-primary text-white' },
  courrier: { icon: LuMail, classe: 'bg-accent text-accent-foreground' },
  appel: { icon: LuPhone, classe: 'bg-secondary text-white' },
  pai: { icon: LuClipboardCheck, classe: 'bg-green-600 text-white' },
  // Onglet "Ses actions" (ce que la personne a fait elle-même)
  creation: { icon: LuFilePlus, classe: 'bg-primary text-white' },
  statut: { icon: LuRefreshCw, classe: 'bg-secondary text-white' },
  consultation: { icon: LuEye, classe: 'bg-muted-foreground text-white' },
  appel_saisi: { icon: LuPhone, classe: 'bg-secondary text-white' },
  appel_traite: { icon: LuPhoneCall, classe: 'bg-green-600 text-white' },
};

// Le volet reçoit tout l'historique (depuis la création de l'application) :
// on l'affiche par tranches pour rester lisible sur une longue carrière.
const TRANCHE = 30;

/**
 * Dossier unique d'une personne — volet léger (pas de page dédiée, décision
 * explicite : "je ne pense pas que c'est nécessaire de faire toute une page
 * pour ça") ouvrable depuis n'importe où un nom de personne apparaît déjà,
 * sans quitter la page en cours (seuls ?fiche/?ficheOnglet s'ajoutent à
 * son adresse, voir plus bas).
 * Usage : const { ouvrirDossier } = useDossierPersonne(); ouvrirDossier(personnelId)
 */
export function DossierPersonneProvider({ children }) {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [nbAffiches, setNbAffiches] = useState(TRANCHE);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Volet ouvert et onglet vivent dans l'adresse de la page en cours
  // (?fiche=12&ficheOnglet=actions) : en revenant d'une action ouverte depuis
  // le volet (« retour »), il se rouvre tel qu'il était, au lieu de
  // disparaître avec la liste remise à zéro (retour utilisateur).
  const params = new URLSearchParams(location.search);
  const personnelId = params.get('fiche');
  const onglet = params.get('ficheOnglet') === 'actions' ? 'actions' : 'concernant';

  useEffect(() => {
    if (!personnelId) { setDonnees(null); return undefined; }
    let annule = false;
    setNbAffiches(TRANCHE);
    setDonnees(null);
    setChargement(true);
    getDossierPersonne(personnelId).then(async (res) => {
      if (annule) return;
      if (res.status === 200) setDonnees(await res.json());
      setChargement(false);
    }).catch(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [personnelId]);

  const changerParams = useCallback((modifs, { replace = false, marquer = false } = {}) => {
    const p = new URLSearchParams(window.location.search);
    Object.entries(modifs).forEach(([cle, valeur]) => (valeur == null ? p.delete(cle) : p.set(cle, String(valeur))));
    const search = p.toString();
    const etat = window.history.state?.usr || {};
    navigate(
      { pathname: window.location.pathname, search: search ? `?${search}` : '', hash: window.location.hash },
      { replace, state: marquer ? { ...etat, __ficheIdx: window.history.state?.idx ?? 0 } : etat },
    );
  }, [navigate]);

  const ouvrirDossier = useCallback((id) => {
    changerParams({ fiche: id, ficheOnglet: null }, { marquer: true });
  }, [changerParams]);

  // Fermer = revenir à l'étape d'avant l'ouverture : un « retour » suivant
  // ne doit pas rouvrir le volet qu'on vient de fermer.
  function fermer() {
    const debut = window.history.state?.usr?.__ficheIdx;
    const idx = window.history.state?.idx;
    if (typeof debut === 'number' && typeof idx === 'number' && idx > debut) navigate(debut - idx);
    else changerParams({ fiche: null, ficheOnglet: null }, { replace: true });
  }

  // Le volet reste dans l'historique : « retour » depuis la page ouverte le
  // retrouve, à l'onglet où il était.
  function allerVers(lien) {
    navigate(lien);
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString(i18n.language) : '';
  const formatDateHeure = (d) => d ? new Date(d).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }) : '';
  const actionsDisponibles = Array.isArray(donnees?.actions);
  const evenements = (onglet === 'actions' && actionsDisponibles ? donnees.actions : donnees?.evenements) || [];
  const evenementsAffiches = evenements.slice(0, nbAffiches);

  function changerOnglet(nouvelOnglet) {
    changerParams({ ficheOnglet: nouvelOnglet === 'actions' ? 'actions' : null }, { replace: true });
    setNbAffiches(TRANCHE);
  }

  // Ligne principale d'une action : le verbe ("A consulté") puis l'objet.
  function libelleAction(e) {
    if (onglet !== 'actions') return e.titre || '—';
    const verbe = t(`voletPersonne.action_${e.type}`);
    return e.titre ? `${verbe} · ${e.titre}` : verbe;
  }

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
              {actionsDisponibles && (
                <div className='flex gap-1 p-1 mb-4 rounded-lg bg-muted'>
                  {[
                    ['concernant', t('voletPersonne.ongletConcernant', { count: donnees.evenements?.length || 0 })],
                    ['actions', t('voletPersonne.ongletActions', { count: donnees.actions.length })],
                  ].map(([cle, label]) => (
                    <button
                      key={cle}
                      onClick={() => changerOnglet(cle)}
                      aria-pressed={onglet === cle}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${onglet === cle ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
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
                      onClick={() => e.lien && allerVers(e.lien)}
                      className='relative block w-full text-left mb-3.5 last:mb-0'
                    >
                      <span className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center ${classe}`}>
                        <Icon size={9} />
                      </span>
                      <p className='text-sm font-medium text-foreground truncate hover:underline'>{libelleAction(e)}</p>
                      <p className='text-xs text-muted-foreground'>{onglet === 'actions' ? formatDateHeure(e.date) : formatDate(e.date)}{e.meta ? ` · ${e.meta}` : ''}</p>
                    </button>
                  );
                })}
              </div>
              {evenements.length > nbAffiches && (
                <button
                  onClick={() => setNbAffiches((n) => n + TRANCHE)}
                  className='block w-full text-center text-sm font-medium text-primary border border-border rounded-lg py-2.5 mt-1 hover:bg-muted transition-colors'
                >
                  {t('voletPersonne.voirPlus', { affiches: nbAffiches, total: evenements.length })}
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
