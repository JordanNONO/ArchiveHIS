import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronUp, LuChevronDown, LuX, LuSend, LuPencil, LuTrash2, LuTrash } from 'react-icons/lu';
import { useMessagerie, nomParticipant } from '../contexts/MessagerieContext';
import { getInitials } from '../utils/common';
import { useConfirm } from '../contexts/ConfirmDialogContext';

/** Menu contextuel (clic droit) sur un de ses propres messages — Modifier / Supprimer. Positionné au point de clic, fermé au clic ailleurs ou à Échap. */
function MenuMessage({ x, y, onModifier, onSupprimer, onFermer }) {
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
      <button onClick={onModifier} className='flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'>
        <LuPencil size={12} /> {t('messagerie.modifier')}
      </button>
      <button onClick={onSupprimer} className='flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors'>
        <LuTrash2 size={12} /> {t('messagerie.supprimer')}
      </button>
    </div>
  );
}

/** Une fenêtre de discussion flottante parmi d'autres (voir FenetresMessagerie ci-dessous) — même principe que les "chat heads" LinkedIn. */
function FenetreChat({ conversation }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { messagesParConversation, reduits, connectesIds, fermerFenetre, toggleReduit, envoyer, modifier, supprimer, vider } = useMessagerie();
  const [texte, setTexte] = useState('');
  const [enEdition, setEnEdition] = useState(null); // { id, contenu } du message en cours de modification
  const [menu, setMenu] = useState(null); // { messageId, x, y }
  const corpsRef = useRef(null);
  const saisieRef = useRef(null);

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
  }, [messages.length, estReduit]);

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
    setMenu({ messageId: message.id, contenu: message.contenu, x: e.clientX, y: e.clientY });
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
      <button onClick={() => toggleReduit(conversation.id)} className='flex items-center gap-2 px-2.5 py-2 bg-primary text-white text-left'>
        <span className='relative flex-shrink-0 w-6 h-6 rounded-full bg-white/20 text-[10px] font-semibold flex items-center justify-center'>
          {getInitials(nomParticipant(autre)) || '?'}
          {connectesIds.has(autre?.id) && <span className='absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-primary' />}
        </span>
        <span className='flex-1 min-w-0 text-xs font-semibold truncate'>{nomParticipant(autre)}</span>
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
            {messages.map((m) => {
              const estMoi = m.utilisateur_id === moiId;
              return (
                <div
                  key={m.id}
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
                    {m.modifie_le && <div className={`text-[9px] text-muted-foreground mt-0.5 ${estMoi ? 'text-right' : ''}`}>{t('messagerie.modifieTag')}</div>}
                  </div>
                </div>
              );
            })}
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
              onChange={(e) => setTexte(e.target.value)}
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
