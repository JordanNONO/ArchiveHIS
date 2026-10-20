import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMessageCircle, LuPencil, LuChevronDown, LuArrowLeft, LuInbox, LuSearch } from 'react-icons/lu';
import { useMessagerie, nomParticipant } from '../contexts/MessagerieContext';
import { getInitials } from '../utils/common';
import { correspondARequete } from '../utils/recherche';
import { timeAgo } from '../utils/fileTypeIcons';

/**
 * Icône "Messagerie" de la navbar + son panneau — même position/style que
 * NotificationBell.jsx (panneau ancré sous l'icône), mais reste TOUJOURS la
 * liste des conversations : cliquer une personne ouvre sa fenêtre à part en
 * bas de l'écran (voir FenetresMessagerie.jsx), ne remplace jamais ce
 * panneau — exactement le comportement de Messagerie sur LinkedIn.
 */
function MessagerieIcone() {
  const { t } = useTranslation();
  const { conversations, personnes, totalNonLus, chargerPersonnes, ouvrirFenetre, demarrerAvec } = useMessagerie();
  const [open, setOpen] = useState(false);
  const [vueCompose, setVueCompose] = useState(false);
  const [recherche, setRecherche] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function ouvrirCompose() {
    setVueCompose(true);
    setRecherche('');
    chargerPersonnes();
  }

  function choisirPersonne(utilisateurId) {
    demarrerAvec(utilisateurId);
    setVueCompose(false);
    setOpen(false);
  }

  const conversationsFiltrees = conversations.filter((c) => !recherche.trim() || correspondARequete([nomParticipant(c.autre_participant), c.dernier_message?.contenu], recherche));
  const personnesFiltrees = personnes.filter((p) => !recherche.trim() || correspondARequete([nomParticipant(p)], recherche));

  // Barre de recherche masquée quand il n'y a rien à chercher — sinon elle
  // reste affichée au-dessus d'un état vide pour rien (retour utilisateur :
  // panneau "trop vide/haut" sur un compte qui n'a encore aucune conversation).
  const rechercheUtile = vueCompose ? personnes.length > 0 : conversations.length > 0;

  return (
    <div className='relative' ref={rootRef}>
      <button className='relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors' onClick={() => setOpen((o) => !o)} title={t('messagerie.titre')}>
        <LuMessageCircle size={18} />
        {totalNonLus > 0 && (
          <span className='absolute top-0.5 right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-semibold leading-none'>
            {totalNonLus > 9 ? '9+' : totalNonLus}
          </span>
        )}
      </button>

      {open && (
        <div className='fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-auto mt-0 sm:mt-2 w-auto sm:w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col'>
          <div className='flex items-center gap-2 px-4 py-3 border-b border-border'>
            {vueCompose && (
              <button onClick={() => setVueCompose(false)} className='text-muted-foreground hover:text-foreground' title={t('messagerie.retour')}>
                <LuArrowLeft size={16} />
              </button>
            )}
            <span className='font-semibold text-sm text-foreground flex-1'>{t('messagerie.titre')}</span>
            {!vueCompose && (
              <button onClick={ouvrirCompose} className='text-muted-foreground hover:text-foreground' title={t('messagerie.nouveauMessage')}>
                <LuPencil size={15} />
              </button>
            )}
            <button onClick={() => setOpen(false)} className='text-muted-foreground hover:text-foreground' title={t('messagerie.reduire')}>
              <LuChevronDown size={15} />
            </button>
          </div>

          {rechercheUtile && (
            <div className='px-3 py-2 border-b border-border'>
              <div className='relative'>
                <LuSearch size={13} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground' />
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder={vueCompose ? t('messagerie.rechercherPersonne') : t('messagerie.rechercherMessages')}
                  className='w-full rounded-lg border border-border bg-background pl-7 pr-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30'
                />
              </div>
            </div>
          )}

          <div className='max-h-96 overflow-y-auto'>
            {vueCompose ? (
              personnesFiltrees.length === 0 ? (
                <div className='flex flex-col items-center gap-2 py-6 text-muted-foreground'>
                  <LuInbox size={20} />
                  <span className='text-xs'>{t('messagerie.aucunePersonne')}</span>
                </div>
              ) : personnesFiltrees.map((p) => (
                <button key={p.id} onClick={() => choisirPersonne(p.id)} className='flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60 transition-colors'>
                  <span className='flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center'>
                    {getInitials(nomParticipant(p)) || '?'}
                  </span>
                  <span className='text-sm font-medium text-foreground truncate'>{nomParticipant(p)}</span>
                </button>
              ))
            ) : conversationsFiltrees.length === 0 ? (
              <div className='flex flex-col items-center gap-2 py-5 px-4 text-center'>
                <span className='flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary'>
                  <LuInbox size={16} />
                </span>
                <span className='text-xs text-muted-foreground'>{t('messagerie.aucuneConversation')}</span>
                <button onClick={ouvrirCompose} className='mt-0.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors'>
                  {t('messagerie.nouveauMessage')}
                </button>
              </div>
            ) : conversationsFiltrees.map((c) => (
              <button
                key={c.id}
                onClick={() => { ouvrirFenetre(c.id); setOpen(false); }}
                className='flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-muted/60 transition-colors border-b border-border/60 last:border-0'
              >
                <span className='flex-shrink-0 w-9 h-9 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center'>
                  {getInitials(nomParticipant(c.autre_participant)) || '?'}
                </span>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-baseline justify-between gap-2'>
                    <span className='text-sm font-semibold text-foreground truncate'>{nomParticipant(c.autre_participant)}</span>
                    {c.dernier_message && <span className='text-[10px] text-muted-foreground shrink-0'>{timeAgo(c.dernier_message.created_at)}</span>}
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${c.non_lus ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {c.dernier_message?.contenu || ''}
                  </p>
                </div>
                {c.non_lus > 0 && (
                  <span className='flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center mt-0.5'>
                    {c.non_lus > 9 ? '9+' : c.non_lus}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagerieIcone;
