import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronUp, LuChevronDown, LuX, LuSend, LuPencil, LuTrash2, LuTrash } from 'react-icons/lu';
import { useMessagerie, nomParticipant } from '../contexts/MessagerieContext';
import { getInitials } from '../utils/common';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import { signalerSaisie } from '../api/routes/messagerie';

/** On ne prévient le serveur qu'au plus une fois par intervalle, pas à chaque frappe — l'indicateur côté destinataire reste affiché 3s (voir MessagerieContext.jsx), largement de quoi couvrir ce délai entre deux signaux. */
const INTERVALLE_SIGNAL_SAISIE_MS = 2000;

/** Au-delà de ce délai depuis l'envoi, un message n'est plus modifiable — même règle côté serveur (voir DELAI_MODIFICATION_MINUTES dans MessagerieController.php), reprise ici pour ne pas proposer une option qui échouerait de toute façon. */
const DELAI_MODIFICATION_MS = 2 * 60 * 1000;

function modifiable(message) {
  return Date.now() - new Date(message.created_at).getTime() < DELAI_MODIFICATION_MS;
}

function memeJour(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function formatHeureMessage(iso, langue) {
  return new Date(iso).toLocaleTimeString(langue, { hour: '2-digit', minute: '2-digit' });
}

/** Séparateur de jour entre deux messages, façon messagerie standard : "Aujourd'hui" / "Hier" / la date sinon. */
function formatSeparateurJour(iso, langue, t) {
  const date = new Date(iso);
  const maintenant = new Date();
  if (memeJour(date, maintenant)) return t('messagerie.aujourdhui');
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (memeJour(date, hier)) return t('messagerie.hier');
  return date.toLocaleDateString(langue, {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== maintenant.getFullYear() ? 'numeric' : undefined,
  });
}

/** Menu contextuel (clic droit) sur un de ses propres messages — Modifier / Supprimer. Positionné au point de clic, fermé au clic ailleurs ou à Échap. */
function MenuMessage({ x, y, modifiable: peutModifier, onModifier, onSupprimer, onFermer }) {
  const { t } = useTranslation();
  const ref = useRef(null);

  useEffect(() => {
    function onClickDehors(e) { if (ref.current && !ref.current.contains(e.target)) onFermer(); }
    function onEchap(e) { if (e.key === 'Escape') onFermer(); }
    document.addEventListener('mousedown', onClickDehors);
    document.addEventListener('keydown', onEchap);
    return () => {
      document.removeEventListener('mousedown', onClickDehors);
      document.removeEventListener('keydown', onEchap);
    };
  }, [onFermer]);

  return (
    <div ref={ref} style={{ position: 'fixed', left: x, top: y, zIndex: 200 }} className='w-36 rounded-lg border border-border bg-card shadow-lg overflow-hidden py-1'>
      {peutModifier && (
        <button onClick={onModifier} className='flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'>
          <LuPencil size={12} /> {t('messagerie.modifier')}
        </button>
      )}
      <button onClick={onSupprimer} className='flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors'>
        <LuTrash2 size={12} /> {t('messagerie.supprimer')}
      </button>
    </div>
  );
}

/** Une fenêtre de discussion flottante parmi d'autres (voir FenetresMessagerie ci-dessous) — même principe que les "chat heads" LinkedIn. */
function FenetreChat({ conversation }) {
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
  const { messagesParConversation, reduits, connectesIds, enTrainDecrire, fermerFenetre, toggleReduit, envoyer, modifier, supprimer, vider } = useMessagerie();
  const [texte, setTexte] = useState('');
  const [enEdition, setEnEdition] = useState(null); // { id, contenu } du message en cours de modification
  const [menu, setMenu] = useState(null); // { messageId, x, y }
  const corpsRef = useRef(null);
  const saisieRef = useRef(null);
  const dernierSignalSaisieRef = useRef(0);

  function surFrappe(e) {
    setTexte(e.target.value);
    const maintenant = Date.now();
    if (maintenant - dernierSignalSaisieRef.current > INTERVALLE_SIGNAL_SAISIE_MS) {
      dernierSignalSaisieRef.current = maintenant;
      signalerSaisie(conversation.id).catch(() => {});
    }
  }

  // Le champ grandit avec le texte (jusqu'à une limite) au lieu de rester
  // sur une seule ligne qui défile horizontalement — retour utilisateur :
  // "on doit pouvoir voir tout le message juste à la saisie". Recalculé à
  // chaque frappe : repartir de 'auto' avant de lire scrollHeight, sinon la
  // hauteur ne redescend jamais quand on efface du texte.
  useEffect(() => {
    const el = saisieRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [texte]);
  const estReduit = reduits.includes(conversation.id);
  const messages = messagesParConversation[conversation.id] || [];
  const autre = conversation.autre_participant;
  // Relu à chaque rendu (pas une constante de module) : reste correct si la
  // session change (déconnexion/reconnexion) sans rechargement complet.
  const moiId = JSON.parse(sessionStorage.getItem('user') || '{}')?.id;

  useEffect(() => {
    if (!estReduit) corpsRef.current?.scrollTo({ top: corpsRef.current.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, estReduit, enTrainDecrire[conversation.id]]);

  function envoyerSaisie() {
    const contenu = texte.trim();
    if (!contenu) return;
    if (enEdition) {
      modifier(conversation.id, enEdition.id, contenu);
      setEnEdition(null);
    } else {
      envoyer(conversation.id, contenu);
    }
    setTexte('');
  }

  function ouvrirMenu(e, message) {
    e.preventDefault();
    setMenu({ messageId: message.id, contenu: message.contenu, modifiable: modifiable(message), x: e.clientX, y: e.clientY });
  }

  function commencerModification() {
    setEnEdition({ id: menu.messageId, contenu: menu.contenu });
    setTexte(menu.contenu);
    setMenu(null);
  }

  async function confirmerSuppressionMessage() {
    const messageId = menu.messageId;
    setMenu(null);
    if (!(await confirm({ message: t('messagerie.confirmerSuppressionMessage'), danger: true, confirmLabel: t('messagerie.supprimer') }))) return;
    supprimer(conversation.id, messageId);
  }

  async function confirmerVider() {
    if (!(await confirm({ message: t('messagerie.confirmerViderDiscussion'), danger: true, confirmLabel: t('messagerie.viderDiscussion') }))) return;
    vider(conversation.id);
  }

  return (
    <div className='w-[260px] flex-shrink-0 bg-card border border-border rounded-t-xl shadow-lg overflow-hidden flex flex-col'>
      <button onClick={() => toggleReduit(conversation.id)} className='relative flex items-center gap-2 px-2.5 py-2 bg-primary text-white text-left'>
        <span className='relative flex-shrink-0 w-6 h-6 rounded-full bg-white/20 text-[10px] font-semibold flex items-center justify-center'>
          {getInitials(nomParticipant(autre)) || '?'}
          {connectesIds.has(autre?.id) && <span className='absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-primary' />}
        </span>
        <span className='flex-1 min-w-0 text-xs font-semibold truncate'>{nomParticipant(autre)}</span>
        {/* Réduite + nouveau message depuis : le seul moyen de le voir sans
            redéplier chaque fenêtre une par une (retour utilisateur). */}
        {estReduit && conversation.non_lus > 0 && (
          <span className='absolute top-1 right-[52px] min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[9.5px] font-bold flex items-center justify-center border border-primary animate-mascotte-pop'>
            {conversation.non_lus > 9 ? '9+' : conversation.non_lus}
          </span>
        )}
        <span onClick={(e) => { e.stopPropagation(); confirmerVider(); }} title={t('messagerie.viderDiscussion')} className='opacity-85 hover:opacity-100'>
          <LuTrash size={13} />
        </span>
        <span onClick={(e) => { e.stopPropagation(); toggleReduit(conversation.id); }} className='opacity-85 hover:opacity-100'>
          {estReduit ? <LuChevronUp size={13} /> : <LuChevronDown size={13} />}
        </span>
        <span onClick={(e) => { e.stopPropagation(); fermerFenetre(conversation.id); }} className='opacity-85 hover:opacity-100'>
          <LuX size={13} />
        </span>
      </button>

      {!estReduit && (
        <>
          <div ref={corpsRef} className='h-[280px] overflow-y-auto p-2.5 flex flex-col gap-2'>
            {messages.map((m, index) => {
              const estMoi = m.utilisateur_id === moiId;
              const precedent = messages[index - 1];
              const changeDeJour = !precedent || !memeJour(precedent.created_at, m.created_at);
              return (
                <React.Fragment key={m.id}>
                  {changeDeJour && (
                    <div className='text-center text-[10px] text-muted-foreground my-1'>
                      {formatSeparateurJour(m.created_at, i18n.language, t)}
                    </div>
                  )}
                  <div
                    onContextMenu={(e) => { if (estMoi) ouvrirMenu(e, m); }}
                    className={`flex gap-1.5 max-w-[85%] ${estMoi ? 'self-end flex-row-reverse' : ''}`}
                  >
                    {!estMoi && (
                      <span className='flex-shrink-0 self-end w-5 h-5 rounded-full bg-secondary text-white text-[8px] font-semibold flex items-center justify-center'>
                        {getInitials(nomParticipant(autre)) || '?'}
                      </span>
                    )}
                    <div>
                      <div className={`px-2.5 py-1.5 text-xs leading-snug ${estMoi ? 'bg-primary text-white rounded-2xl rounded-br-sm cursor-context-menu' : 'bg-muted text-foreground rounded-2xl rounded-bl-sm'}`}>
                        {m.contenu}
                      </div>
                      <div className={`flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5 ${estMoi ? 'justify-end' : ''}`}>
                        <span>{formatHeureMessage(m.created_at, i18n.language)}</span>
                        {m.modifie_le && <span>· {t('messagerie.modifieTag')}</span>}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {enTrainDecrire[conversation.id] && (
              <div className='flex gap-1.5 max-w-[85%]'>
                <span className='flex-shrink-0 self-end w-5 h-5 rounded-full bg-secondary text-white text-[8px] font-semibold flex items-center justify-center'>
                  {getInitials(nomParticipant(autre)) || '?'}
                </span>
                <div className='bg-muted rounded-2xl rounded-bl-sm px-3 py-2 inline-flex items-center gap-1'>
                  <span className='w-1.5 h-1.5 rounded-full bg-muted-foreground animate-rebond-saisie' />
                  <span className='w-1.5 h-1.5 rounded-full bg-muted-foreground animate-rebond-saisie' style={{ animationDelay: '0.15s' }} />
                  <span className='w-1.5 h-1.5 rounded-full bg-muted-foreground animate-rebond-saisie' style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            )}
          </div>

          {enEdition && (
            <div className='flex items-center justify-between gap-2 px-3 py-1 bg-muted/60 border-t border-border text-[10.5px] text-muted-foreground'>
              <span>{t('messagerie.modificationEnCours')}</span>
              <button onClick={() => { setEnEdition(null); setTexte(''); }} className='hover:text-foreground'><LuX size={11} /></button>
            </div>
          )}

          <div className='flex items-end gap-1.5 px-2 py-2 border-t border-border'>
            <textarea
              ref={saisieRef}
              rows={1}
              value={texte}
              onChange={surFrappe}
              onKeyDown={(e) => {
                // Entrée seule envoie (comme avant) ; Maj+Entrée insère un
                // retour à la ligne plutôt que d'envoyer — sinon impossible
                // d'écrire un message sur plusieurs lignes volontairement.
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerSaisie(); }
                if (e.key === 'Escape' && enEdition) { setEnEdition(null); setTexte(''); }
              }}
              placeholder={t('messagerie.ecrireMessage')}
              spellCheck='true'
              autoCorrect='on'
              autoCapitalize='sentences'
              className='flex-1 resize-none rounded-xl border border-border bg-background px-3 py-1.5 text-xs leading-snug focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-[120px] overflow-y-auto'
            />
            <button onClick={envoyerSaisie} className='flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors mb-0.5'>
              <LuSend size={12} />
            </button>
          </div>
        </>
      )}

      {menu && (
        <MenuMessage
          x={menu.x}
          y={menu.y}
          modifiable={menu.modifiable}
          onModifier={commencerModification}
          onSupprimer={confirmerSuppressionMessage}
          onFermer={() => setMenu(null)}
        />
      )}
    </div>
  );
}

/**
 * Conteneur des fenêtres de discussion flottantes, ancré en bas à droite de
 * l'écran — monté une seule fois dans MainLayout.jsx (comme AssistantChat),
 * donc visible quelle que soit la page affichée derrière. Les fenêtres
 * ouvertes vivent dans MessagerieContext, pas ici : ce composant ne fait que
 * les disposer côte à côte.
 */
function FenetresMessagerie() {
  const { conversations, ouverts } = useMessagerie();
  if (ouverts.length === 0) return null;

  // right-24 (pas right-4) : laisse la place à la bulle de l'assistant IA,
  // ancrée bottom-5 right-5 (56px de large) dans AssistantChat.jsx — sans
  // cette marge les deux se chevauchaient dans le coin bas-droit.
  return (
    <div className='fixed bottom-0 right-24 z-40 flex items-end gap-2'>
      {ouverts.map((id) => {
        const conversation = conversations.find((c) => c.id === id);
        if (!conversation) return null;
        return <FenetreChat key={id} conversation={conversation} />;
      })}
    </div>
  );
}

export default FenetresMessagerie;
