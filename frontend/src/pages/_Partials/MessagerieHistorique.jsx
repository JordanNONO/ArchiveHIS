import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuSearch, LuArrowLeft, LuMessageSquare, LuShieldCheck } from 'react-icons/lu'
import { getToutesConversations, getHistoriqueCompletConversation } from '../../api/routes/messagerie'
import { nomParticipant } from '../../contexts/MessagerieContext'
import { getInitials } from '../../utils/common'

/**
 * Historique complet d'une conversation, réservé à l'Administration — retour
 * utilisateur : une conversation peut servir de preuve (ex: montrer qu'un
 * travail a été demandé/effectué), il faut donc pouvoir la retrouver même si
 * l'un des deux participants a utilisé « Vider la discussion ». Cette action
 * ne supprime déjà rien en base (voir MessagerieController::viderConversation()),
 * elle masque juste l'historique antérieur du côté de qui l'a fait — cette vue
 * ignore volontairement ce filtre pour les deux participants.
 */
function MessagerieHistorique() {
  const { t, i18n } = useTranslation()
  const [conversations, setConversations] = useState([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [conversationOuverte, setConversationOuverte] = useState(null)
  const [messages, setMessages] = useState([])
  const [chargementMessages, setChargementMessages] = useState(false)

  useEffect(() => {
    getToutesConversations().then(async (res) => {
      if (res.status === 200) setConversations(await res.json())
    }).catch((err) => console.log(err)).finally(() => setChargement(false))
  }, [])

  function ouvrirConversation(conversation) {
    setConversationOuverte(conversation)
    setChargementMessages(true)
    getHistoriqueCompletConversation(conversation.id).then(async (res) => {
      if (res.status === 200) setMessages(await res.json())
    }).catch((err) => console.log(err)).finally(() => setChargementMessages(false))
  }

  const rechercheNormalisee = recherche.trim().toLowerCase()
  const conversationsFiltrees = rechercheNormalisee
    ? conversations.filter((c) => c.utilisateurs.some((u) => nomParticipant(u).toLowerCase().includes(rechercheNormalisee)))
    : conversations

  function expediteur(message) {
    const u = conversationOuverte?.utilisateurs.find((x) => x.id === message.utilisateur_id)
    return nomParticipant(u) || '—'
  }

  if (conversationOuverte) {
    return (
      <div className='flex flex-col gap-4'>
        <button type='button' onClick={() => { setConversationOuverte(null); setMessages([]) }} className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit'>
          <LuArrowLeft size={14} /> {t('messagerieHistorique.retour')}
        </button>
        <h3 className='text-sm font-semibold'>
          {conversationOuverte.utilisateurs.map((u) => nomParticipant(u)).join(' ↔ ')}
        </h3>
        {chargementMessages ? (
          <p className='text-sm text-muted-foreground'>{t('messagerieHistorique.chargement')}</p>
        ) : messages.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{t('messagerieHistorique.aucunMessage')}</p>
        ) : (
          <ul className='flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1'>
            {messages.map((m) => (
              <li key={m.id} className='border border-border rounded-lg px-3.5 py-2.5'>
                <div className='flex items-center justify-between gap-2 mb-1'>
                  <span className='text-xs font-semibold text-foreground'>{expediteur(m)}</span>
                  <span className='text-[11px] text-muted-foreground shrink-0'>{new Date(m.created_at).toLocaleString(i18n.language)}</span>
                </div>
                <p className='text-sm whitespace-pre-wrap'>{m.contenu}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <p className='flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2.5'>
        <LuShieldCheck size={15} className='text-primary shrink-0 mt-0.5' />
        {t('messagerieHistorique.explication')}
      </p>
      <div className='relative'>
        <LuSearch size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
        <input
          type='text'
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={t('messagerieHistorique.rechercherPersonne')}
          className='w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
        />
      </div>
      {chargement ? (
        <p className='text-sm text-muted-foreground'>{t('messagerieHistorique.chargement')}</p>
      ) : conversationsFiltrees.length === 0 ? (
        <p className='text-sm text-muted-foreground'>{t('messagerieHistorique.aucuneConversation')}</p>
      ) : (
        <ul className='flex flex-col gap-1.5'>
          {conversationsFiltrees.map((c) => (
            <li key={c.id}>
              <button
                type='button'
                onClick={() => ouvrirConversation(c)}
                className='w-full flex items-center gap-3 text-left border border-border rounded-lg px-3.5 py-2.5 hover:bg-muted/40 transition-colors'
              >
                <span className='flex -space-x-2 shrink-0'>
                  {c.utilisateurs.map((u) => (
                    <span key={u.id} className='w-7 h-7 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center border-2 border-card'>
                      {getInitials(nomParticipant(u)) || '?'}
                    </span>
                  ))}
                </span>
                <span className='flex-1 min-w-0 text-sm font-medium truncate'>
                  {c.utilisateurs.map((u) => nomParticipant(u)).join(' ↔ ')}
                </span>
                <span className='flex items-center gap-1 text-[11px] text-muted-foreground shrink-0'>
                  <LuMessageSquare size={12} /> {new Date(c.updated_at).toLocaleDateString(i18n.language)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MessagerieHistorique
