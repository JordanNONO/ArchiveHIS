import React, { useState } from 'react'
import {
  LuMessageSquare, LuWallet, LuCalendarClock, LuCamera, LuBell, LuInbox, LuCheck, LuArrowRight,
  LuFolderOpen, LuUsers2, LuClipboardCheck, LuDownload, LuUserPlus,
} from 'react-icons/lu'

/**
 * Tour de bienvenue affiché une seule fois, à la toute première connexion sur
 * un appareil (voir utils/onboarding.js) — explique chaque fonctionnalité
 * principale avant que la personne se retrouve seule devant l'appli, comme
 * le font la plupart des applis grand public. Le contenu diffère selon le
 * profil : un compte "dépôt" (intervenant/bénéficiaire) et un compte
 * personnel interne n'utilisent pas du tout les mêmes écrans.
 */
const ETAPES_DEPOT = [
  {
    icon: LuMessageSquare,
    titre: 'Un dossier par type de démarche',
    description: "Réclamation, Fiche de paie, Congés, Document administratif, Autres... chaque dossier de la page d'accueil correspond à un type précis. Ouvrez celui qui correspond à ce que vous voulez envoyer.",
  },
  {
    icon: LuCamera,
    titre: 'Scannez directement avec votre téléphone',
    description: "Dans un dossier, le bouton \"Scanner\" ouvre l'appareil photo : les bords du document sont détectés et redressés automatiquement, comme un vrai scanner. Vous pouvez aussi ajouter une photo/un fichier déjà pris.",
  },
  {
    icon: LuWallet,
    titre: 'Plusieurs pages, un seul envoi',
    description: 'Un document sur plusieurs pages ? Ajoutez-les une à une avant de valider — elles seront regroupées ensemble, exportables en une seule pièce si besoin.',
  },
  {
    icon: LuCalendarClock,
    titre: 'Suivez où en est chaque envoi',
    description: "Chaque pièce déposée affiche son statut (reçue, en cours de traitement, traitée...) avec une couleur dédiée, directement dans la liste \"Déjà envoyés dans ce dossier\".",
  },
  {
    icon: LuInbox,
    titre: 'Ce qu\'on partage avec vous',
    description: "La section \"Documents partagés avec moi\", sur le tableau de bord, regroupe tout ce qu'un service vous a transmis.",
  },
  {
    icon: LuBell,
    titre: 'Une notification à chaque nouveauté',
    description: 'Un message, un changement de statut, un document partagé... vous êtes prévenu instantanément (son + popup + cloche en haut de l\'écran).',
  },
]

const ETAPES_PERSONNEL = [
  {
    icon: LuFolderOpen,
    titre: 'Vos dossiers, organisés par catégorie',
    description: "Chaque catégorie (page d'accueil) contient des sous-dossiers, eux-mêmes remplis de documents. Cliquez pour naviguer, comme un explorateur de fichiers classique.",
  },
  {
    icon: LuClipboardCheck,
    titre: '« À traiter bientôt »',
    description: "En haut du tableau de bord, ce bloc signale les documents en attente de validation depuis longtemps ou proches de leur date de purge — un coup d'œil suffit pour savoir quoi prioriser.",
  },
  {
    icon: LuUsers2,
    titre: 'Regroupement par personne',
    description: "Dans un sous-dossier, le bouton \"Grouper par salarié\" range automatiquement les documents par personne concernée — pratique quand plusieurs dossiers individuels se mélangent.",
  },
  {
    icon: LuUserPlus,
    titre: 'Statuts et actions rapides',
    description: "Chaque document affiche une bordure colorée selon son statut. Vous pouvez le faire évoluer (transmettre, valider, archiver directement...) depuis sa page de détail.",
  },
  {
    icon: LuDownload,
    titre: 'Téléchargement groupé',
    description: "Le bouton \"Télécharger\" d'un dossier prépare une archive ZIP en tâche de fond et vous notifie dès qu'elle est prête — pas besoin d'attendre sur place.",
  },
  {
    icon: LuBell,
    titre: 'Une notification à chaque nouveauté',
    description: 'Un document soumis, un partage, une export prête... vous êtes prévenu instantanément (son + popup + cloche en haut de l\'écran).',
  },
]

function OnboardingTour({ profil = 'personnel', onTermine }) {
  const etapes = profil === 'depot' ? ETAPES_DEPOT : ETAPES_PERSONNEL
  const [etape, setEtape] = useState(0)
  const derniere = etape === etapes.length - 1
  const { icon: Icon, titre, description } = etapes[etape]

  return (
    <div className='fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4'>
      <div className='w-full max-w-sm rounded-2xl bg-card border border-border shadow-xl p-6 flex flex-col items-center text-center gap-4'>
        <div className='flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary'>
          <Icon size={28} />
        </div>
        <div>
          <h2 className='text-lg font-semibold text-foreground'>{titre}</h2>
          <p className='text-sm text-muted-foreground mt-2 leading-relaxed'>{description}</p>
        </div>

        <div className='flex items-center gap-1.5 mt-1'>
          {etapes.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === etape ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`}
            />
          ))}
        </div>

        <div className='flex items-center justify-between w-full mt-2'>
          <button
            onClick={onTermine}
            className='text-xs text-muted-foreground hover:text-foreground transition-colors'
          >
            Passer
          </button>
          <button
            onClick={() => (derniere ? onTermine() : setEtape((e) => e + 1))}
            className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'
          >
            {derniere ? (<><LuCheck size={15} /> Compris, terminer</>) : (<>Suivant <LuArrowRight size={15} /></>)}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OnboardingTour
