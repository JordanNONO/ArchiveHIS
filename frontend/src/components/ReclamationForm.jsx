import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { LuSend, LuWallet, LuCalendarClock, LuHeartHandshake, LuSwords, LuMoreHorizontal } from 'react-icons/lu'
import { createDocument } from '../api/routes/document'
import { getInitials } from '../utils/common'
import { genererPdfReclamation } from '../utils/reclamationPdf'
import { WizardShell, WizardStepHeader, WizardChoiceCard, WizardReviewLine, WizardSuccess, genererConfettis, WIZARD_TEXTAREA_CLS } from './wizard/Wizard'

const OBJETS = [
  { valeur: 'Salaire', icon: LuWallet },
  { valeur: 'Planning', icon: LuCalendarClock },
  { valeur: 'Climat de travail', icon: LuHeartHandshake },
  { valeur: 'Conflits internes', icon: LuSwords },
  { valeur: 'Autre', icon: LuMoreHorizontal },
]

const LIBELLE_ETAPE = { 1: 'Objet', 2: 'Description', 3: 'Récapitulatif' }

/**
 * Parcours séquentiel animé (une question à la fois, façon assistant
 * d'installation) — maquette approuvée avant implémentation. S'appuie sur les
 * briques partagées de wizard/Wizard.jsx (utilisées aussi par CongeForm.jsx)
 * plutôt que de recopier la mécanique d'animation ici. Le PDF continue à se
 * générer en arrière-plan exactement comme avant (reclamationPdf.js), seule
 * la façade change.
 *
 * Nom/prénom, date et la case Client/Salarié restent déduits automatiquement
 * du compte connecté — aucune étape ne les demande.
 */
function ReclamationForm({ user, currentUserName, demande, destination, onEnvoye }) {
  const [etape, setEtape] = useState(1)
  const [direction, setDirection] = useState('avant')
  const [objet, setObjet] = useState('')
  const [texte, setTexte] = useState('')
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [confettis, setConfettis] = useState([])

  const profil = user?.role === 'Beneficiaire' ? 'Client' : 'Salarié'
  // "Salaire" ne concerne que les salariés (intervenants) — un bénéficiaire
  // (client) n'a pas de salaire à réclamer.
  const objetsDisponibles = profil === 'Client' ? OBJETS.filter((o) => o.valeur !== 'Salaire') : OBJETS

  function allerA(cible) {
    setDirection(cible > etape ? 'avant' : 'arriere')
    setEtape(cible)
  }

  function choisirObjet(valeur) {
    setObjet(valeur)
    setTimeout(() => allerA(2), 420)
  }

  function reinitialiser() {
    setObjet('')
    setTexte('')
    setConfettis([])
    allerA(1)
  }

  async function envoyer() {
    if (!destination) {
      toast.error("Ce dossier n'est pas disponible pour le moment, réessayez dans un instant")
      return
    }
    try {
      setEnvoiEnCours(true)
      const blob = await genererPdfReclamation({
        nomPrenom: currentUserName,
        profil,
        date: new Date(),
        objet,
        reclamation: texte,
      })

      const codePrefixe = `${demande.code}-${getInitials(currentUserName)}`
      const reference = `${codePrefixe}-${Date.now()}`
      const fichier = new File([blob], `${codePrefixe} — Réclamation.pdf`, { type: 'application/pdf' })

      const res = await createDocument({
        category_id: destination.categorie_id,
        type_document_id: destination.type_document_id,
        titre: `${codePrefixe} — Réclamation : ${objet}`,
        auteur: currentUserName,
        nom_personne_concernee: currentUserName,
        resume: `Réclamation (${profil}) — ${objet}`,
        reference,
        file_create_date: Date.now(),
      }, fichier)

      if (res.status === 201) {
        setConfettis(genererConfettis())
        allerA(4)
        onEnvoye && onEnvoye()
      } else {
        toast.error("L'envoi de la réclamation a échoué")
      }
    } catch (error) {
      console.log(error)
      toast.error('Une erreur est survenue lors de la génération du document')
    } finally {
      setEnvoiEnCours(false)
    }
  }

  return (
    <WizardShell
      etape={etape}
      totalEtapes={3}
      libelleEtape={LIBELLE_ETAPE[etape]}
      direction={direction}
      peutRetour={etape > 1 && etape < 4}
      onRetour={() => allerA(etape - 1)}
    >
      {etape === 1 && (
        <>
          <WizardStepHeader eyebrow='Réclamation' titre="Quel est l'objet ?" sousTitre='Choisissez la catégorie la plus proche.' />
          <div className='flex flex-col gap-2'>
            {objetsDisponibles.map((o, i) => (
              <WizardChoiceCard
                key={o.valeur}
                icon={o.icon}
                label={o.valeur}
                picked={objet === o.valeur}
                onClick={() => choisirObjet(o.valeur)}
                delayMs={i * 60}
              />
            ))}
          </div>
        </>
      )}

      {etape === 2 && (
        <>
          <WizardStepHeader eyebrow='Réclamation' titre='Décrivez la situation' sousTitre='Le plus précisément possible — dates, faits, personnes concernées.' />
          <textarea
            autoFocus
            rows={6}
            maxLength={600}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder='Écrivez ici...'
            className={WIZARD_TEXTAREA_CLS}
          />
          <span className='self-end text-[11px] text-muted-foreground tabular-nums'>{texte.length}/600</span>
          <div className='flex gap-2 mt-auto'>
            <button type='button' onClick={() => allerA(1)} className='rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-transform duration-150 active:scale-95'>
              Retour
            </button>
            <button
              type='button'
              disabled={texte.trim().length === 0}
              onClick={() => allerA(3)}
              className='flex-1 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:shadow-none'
            >
              Suivant
            </button>
          </div>
        </>
      )}

      {etape === 3 && (
        <>
          <WizardStepHeader eyebrow='Réclamation' titre="Vérifiez avant d'envoyer" sousTitre="Un dernier coup d'œil, puis c'est parti." />
          <div className='flex flex-col gap-2.5'>
            <WizardReviewLine label='Objet' valeur={objet} onModifier={() => allerA(1)} delayMs={50} />
            <WizardReviewLine label='Réclamation' valeur={texte} onModifier={() => allerA(2)} delayMs={120} multiline />
          </div>
          <button
            type='button'
            disabled={envoiEnCours}
            onClick={envoyer}
            className='mt-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-60'
          >
            <LuSend size={15} /> {envoiEnCours ? 'Envoi...' : 'Envoyer la réclamation'}
          </button>
        </>
      )}

      {etape === 4 && (
        <WizardSuccess
          titre='Réclamation envoyée'
          sousTitre='RH a été notifié — vous recevrez une réponse dès que le dossier est traité.'
          confettis={confettis}
          onReset={reinitialiser}
          libelleReset='Faire une nouvelle réclamation'
        />
      )}
    </WizardShell>
  )
}

export default ReclamationForm
