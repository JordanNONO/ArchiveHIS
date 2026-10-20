import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronUp, LuChevronDown, LuX, LuSend } from 'react-icons/lu';
import { useMessagerie, nomParticipant } from '../contexts/MessagerieContext';
import { getInitials } from '../utils/common';

/** Une fenêtre de discussion flottante parmi d'autres (voir FenetresMessagerie ci-dessous) — même principe que les "chat heads" LinkedIn. */
function FenetreChat({ conversation }) {
  const { t } = useTranslation();
  const { messagesParConversation, reduits, connectesIds, fermerFenetre, toggleReduit, envoyer } = useMessagerie();
  const [texte, setTexte] = useState('');
  const corpsRef = useRef(null);
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
    envoyer(conversation.id, contenu);
    setTexte('');
  }

  return (
    <div className='w-[260px] flex-shrink-0 bg-card border border-border rounded-t-xl shadow-lg overflow-hidden flex flex-col'>
      <button onClick={() => toggleReduit(conversation.id)} className='flex items-center gap-2 px-2.5 py-2 bg-primary text-white text-left'>
        <span className='relative flex-shrink-0 w-6 h-6 rounded-full bg-white/20 text-[10px] font-semibold flex items-center justify-center'>
          {getInitials(nomParticipant(autre)) || '?'}
          {connectesIds.has(autre?.id) && <span className='absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-primary' />}
        </span>
        <span className='flex-1 min-w-0 text-xs font-semibold truncate'>{nomParticipant(autre)}</span>
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
                <div key={m.id} className={`flex gap-1.5 max-w-[85%] ${estMoi ? 'self-end flex-row-reverse' : ''}`}>
                  {!estMoi && (
                    <span className='flex-shrink-0 self-end w-5 h-5 rounded-full bg-secondary text-white text-[8px] font-semibold flex items-center justify-center'>
                      {getInitials(nomParticipant(autre)) || '?'}
                    </span>
                  )}
                  <div>
                    <div className={`px-2.5 py-1.5 text-xs leading-snug ${estMoi ? 'bg-primary text-white rounded-2xl rounded-br-sm' : 'bg-muted text-foreground rounded-2xl rounded-bl-sm'}`}>
                      {m.contenu}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className='flex items-center gap-1.5 px-2 py-2 border-t border-border'>
            <input
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') envoyerSaisie(); }}
              placeholder={t('messagerie.ecrireMessage')}
              spellCheck='true'
              autoCorrect='on'
              autoCapitalize='sentences'
              className='flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30'
            />
            <button onClick={envoyerSaisie} className='flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors'>
              <LuSend size={12} />
            </button>
          </div>
        </>
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
