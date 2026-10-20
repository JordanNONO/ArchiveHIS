import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  getConversations, getPersonnesMessagerie, demarrerConversation, getMessages, envoyerMessage, marquerConversationLue,
} from '../api/routes/messagerie';
import { getDisplayName } from '../utils/common';
import { playMessageSound } from '../utils/notificationSound';
import echo from '../utils/echo';

const MessagerieContext = createContext(null);

/** Même repli que nomUtilisateur() dans FluctuationRh.jsx : la fiche Personnel (prénom/nom) prime sur le nom de compte brut. */
export function nomParticipant(u) {
  if (!u) return '';
  return getDisplayName({ personnel: u.personnels?.[0] }) || u.nom || '';
}

/**
 * Messagerie interne entre collègues, façon LinkedIn (maquette validée) :
 * un panneau de liste sous l'icône 💬 de la navbar (voir MessagerieIcone.jsx)
 * et plusieurs fenêtres de discussion flottantes qui peuvent rester ouvertes
 * en même temps, indépendamment de la page affichée — d'où ce contexte
 * global plutôt qu'un state local à un composant : le panneau (dans Navbar)
 * et les fenêtres flottantes (montées dans MainLayout) doivent partager le
 * même état sans être imbriqués l'un dans l'autre.
 */
export function MessagerieProvider({ children }) {
  const [conversations, setConversations] = useState([]);
  const [personnes, setPersonnes] = useState([]);
  const [ouverts, setOuverts] = useState([]); // ids de conversation ouverts en fenêtre flottante
  const [reduits, setReduits] = useState([]); // ids réduits parmi les ouverts
  const [messagesParConversation, setMessagesParConversation] = useState({});
  const [connectesIds, setConnectesIds] = useState(new Set());

  // Le listener temps réel (monté une seule fois) a besoin de la valeur à
  // jour de `ouverts`/`conversations` sans redevenir une fonction périmée —
  // même raison que openRef dans NotificationBell.jsx.
  const ouvertsRef = useRef(ouverts);
  useEffect(() => { ouvertsRef.current = ouverts; }, [ouverts]);
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  const chargerConversations = useCallback(() => {
    return getConversations()
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const chargerPersonnes = useCallback(() => {
    return getPersonnesMessagerie()
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPersonnes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function chargerMessages(conversationId) {
    getMessages(conversationId)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMessagesParConversation((prec) => ({ ...prec, [conversationId]: Array.isArray(data) ? data : [] })))
      .catch(() => {});
  }

  function marquerLuLocalement(conversationId) {
    setConversations((prec) => prec.map((c) => (c.id === conversationId ? { ...c, non_lus: 0 } : c)));
    marquerConversationLue(conversationId).catch(() => {});
  }

  /** Ouvre (ou ramène au premier plan / dé-réduit) la fenêtre flottante d'une conversation — plusieurs peuvent coexister, comme sur LinkedIn. */
  function ouvrirFenetre(conversationId) {
    setReduits((prec) => prec.filter((x) => x !== conversationId));
    setOuverts((prec) => {
      if (prec.includes(conversationId)) return prec;
      // Comme LinkedIn, on limite le nombre de fenêtres visibles à la fois.
      const suivant = prec.length >= 3 ? prec.slice(1) : prec;
      return [...suivant, conversationId];
    });
    if (!messagesParConversation[conversationId]) chargerMessages(conversationId);
    marquerLuLocalement(conversationId);
  }

  /** Retrouve (ou crée) la conversation à deux avec cette personne, puis l'ouvre. */
  function demarrerAvec(utilisateurId) {
    return demarrerConversation(utilisateurId)
      .then((r) => (r.ok ? r.json() : null))
      .then((conversation) => {
        if (!conversation) return;
        setConversations((prec) => (prec.some((c) => c.id === conversation.id) ? prec : [conversation, ...prec]));
        ouvrirFenetre(conversation.id);
      })
      .catch(() => {});
  }

  function fermerFenetre(conversationId) {
    setOuverts((prec) => prec.filter((x) => x !== conversationId));
    setReduits((prec) => prec.filter((x) => x !== conversationId));
  }

  function toggleReduit(conversationId) {
    setReduits((prec) => (prec.includes(conversationId) ? prec.filter((x) => x !== conversationId) : [...prec, conversationId]));
  }

  function envoyer(conversationId, contenu) {
    return envoyerMessage(conversationId, contenu)
      .then((r) => (r.ok ? r.json() : null))
      .then((message) => {
        if (!message) return;
        setMessagesParConversation((prec) => {
          const existants = prec[conversationId] || [];
          if (existants.some((m) => m.id === message.id)) return prec;
          return { ...prec, [conversationId]: [...existants, message] };
        });
        setConversations((prec) => {
          const copie = prec.map((c) => (c.id === conversationId ? { ...c, dernier_message: message, updated_at: message.created_at } : c));
          const conv = copie.find((c) => c.id === conversationId);
          return conv ? [conv, ...copie.filter((c) => c.id !== conversationId)] : copie;
        });
      })
      .catch(() => {});
  }

  const totalNonLus = conversations.reduce((s, c) => s + (c.non_lus || 0), 0);

  useEffect(() => {
    chargerConversations();
  }, [chargerConversations]);

  // Qui est en ligne — même canal de présence déjà rejoint pour toute la
  // session dans MainLayout.jsx (voir Personnel.jsx, même motif ici) ;
  // rejoindre à nouveau ne fait que s'abonner aux mêmes événements, Echo
  // déduplique la connexion WebSocket sous-jacente.
  useEffect(() => {
    let monte = true;
    const canal = echo.join('presence-connectes');
    canal.here((utilisateurs) => { if (monte) setConnectesIds(new Set(utilisateurs.map((u) => u.id))); });
    canal.joining((u) => { if (monte) setConnectesIds((prec) => new Set(prec).add(u.id)); });
    canal.leaving((u) => {
      if (!monte) return;
      setConnectesIds((prec) => {
        const suivant = new Set(prec);
        suivant.delete(u.id);
        return suivant;
      });
    });
    return () => { monte = false; };
  }, []);

  // Diffusion en temps réel (voir MessageEnvoye.php, même canal privé par
  // utilisateur que les Notifications) : un message arrive instantanément,
  // qu'on l'ait envoyé soi-même (autre onglet) ou reçu d'un collègue.
  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (!user?.id) return;

    const channel = echo.private(`App.Models.Utilisateurs.${user.id}`);
    channel.listen('.message.envoye', (payload) => {
      const { conversation_id: conversationId, id: messageId, utilisateur_id: expediteurId } = payload;
      const fenetreOuverte = ouvertsRef.current.includes(conversationId);

      // Son distinct de celui des notifications (demande explicite) — pas
      // pour l'écho de son propre message envoyé depuis un autre onglet.
      if (expediteurId !== user.id) playMessageSound();

      setMessagesParConversation((prec) => {
        const existants = prec[conversationId];
        if (!existants) return prec; // fenêtre jamais ouverte : pas la peine de charger son fil maintenant
        if (existants.some((m) => m.id === messageId)) return prec; // déjà ajouté par envoyer() ci-dessus
        return { ...prec, [conversationId]: [...existants, payload] };
      });

      const connue = conversationsRef.current.some((c) => c.id === conversationId);
      if (!connue) {
        chargerConversations();
        return;
      }
      setConversations((prec) => {
        const copie = prec.map((c) => (c.id === conversationId ? {
          ...c,
          dernier_message: payload,
          updated_at: payload.created_at,
          non_lus: expediteurId === user.id || fenetreOuverte ? 0 : (c.non_lus || 0) + 1,
        } : c));
        const conv = copie.find((c) => c.id === conversationId);
        return conv ? [conv, ...copie.filter((c) => c.id !== conversationId)] : copie;
      });
      if (fenetreOuverte && expediteurId !== user.id) marquerConversationLue(conversationId).catch(() => {});
    });

    return () => { echo.leave(`App.Models.Utilisateurs.${user.id}`); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valeur = {
    conversations, personnes, ouverts, reduits, messagesParConversation, totalNonLus, connectesIds,
    chargerConversations, chargerPersonnes, ouvrirFenetre, demarrerAvec, fermerFenetre, toggleReduit, envoyer,
  };

  return <MessagerieContext.Provider value={valeur}>{children}</MessagerieContext.Provider>;
}

/**
 * Ne lève plus d'exception hors du Provider (ex: NotificationBell.jsx, monté
 * pour tout le monde y compris un compte dépôt, qui lui n'a pas de
 * MessagerieProvider) — renvoie simplement `null`, à l'appelant de vérifier.
 */
export function useMessagerie() {
  return useContext(MessagerieContext);
}
