import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import hisLogoUrl from '../assets/his-logo.png'
import badgeUrl from '../assets/logo-services-a-la-personne.jpg'
import badgeHandeoUrl from '../assets/logo-cap-handeo.jpg'

/**
 * Génère le PDF du protocole de prise en charge (ProtocolePai.jsx) — reprend
 * l'en-tête/pied de page/badges de paiPdf.js (même identité visuelle), mais
 * avec une mise en page propre à ce document : page de garde, puis sections à
 * bandeau rouge (comme le gabarit papier fourni par HIS), étapes numérotées
 * ou à puces avec sous-étapes imbriquées, tableau du dispositif.
 */

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGE = 50
const COULEUR_TEXTE = rgb(0.09, 0.11, 0.14)
const COULEUR_MUTED = rgb(0.45, 0.48, 0.53)
const COULEUR_ROUGE = rgb(0.643, 0.137, 0.102)
const COULEUR_BORDURE = rgb(0.85, 0.86, 0.89)
const COULEUR_FOND_LIGNE = rgb(0.97, 0.98, 0.98)

function decouperEnLignes(font, texte, taille, largeurMax) {
  const mots = String(texte || '').split(/\s+/).filter(Boolean)
  const lignes = []
  let ligne = ''
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot
    if (font.widthOfTextAtSize(essai, taille) > largeurMax && ligne) {
      lignes.push(ligne)
      ligne = mot
    } else {
      ligne = essai
    }
  }
  if (ligne) lignes.push(ligne)
  return lignes.length ? lignes : ['']
}

function etapeAContenu(e) {
  return !!(e?.texte?.trim() || e?.label?.trim() || (e?.sous || []).some((s) => s?.texte?.trim()))
}

export async function genererPdfProtocolePai(p) {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const fontTitre = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

  const [logoBytes, badgeBytes, badgeHandeoBytes] = await Promise.all([
    fetch(hisLogoUrl).then((r) => r.arrayBuffer()),
    fetch(badgeUrl).then((r) => r.arrayBuffer()),
    fetch(badgeHandeoUrl).then((r) => r.arrayBuffer()),
  ])
  const logoImage = await pdfDoc.embedPng(logoBytes)
  const badgeImage = await pdfDoc.embedJpg(badgeBytes)
  const badgeHandeoImage = await pdfDoc.embedJpg(badgeHandeoBytes)

  const logoHeaderLargeur = 110
  const logoHeaderHauteur = logoHeaderLargeur * (logoImage.height / logoImage.width)
  const LIGNES_PIED_DE_PAGE = [
    '8 place Georges Braque, 93120 La Courneuve  Tél: 01 43 52 64 23  Fax: 01 43 11 09 67',
    'Sarl au Capital de 6000 euros, Siret : 493 761 175 00030 R.C.S.Bobigny',
    'APE 9609Z. Agrément Qualité Préfectorale : SAP493761175',
  ]

  function dessinerPiedDePage(page, numero, total) {
    page.drawLine({ start: { x: MARGE, y: 56 }, end: { x: PAGE_W - MARGE, y: 56 }, thickness: 0.5, color: rgb(0, 0, 0) })
    LIGNES_PIED_DE_PAGE.forEach((ligne, i) => {
      const largeur = fontRegular.widthOfTextAtSize(ligne, 8)
      page.drawText(ligne, { x: (PAGE_W - largeur) / 2, y: 44 - i * 10, size: 8, font: fontRegular, color: rgb(0, 0, 0) })
    })
    const largeurBadge = 46
    const hauteurBadge = largeurBadge * (badgeImage.height / badgeImage.width)
    page.drawImage(badgeImage, { x: PAGE_W - MARGE - largeurBadge, y: 20, width: largeurBadge, height: hauteurBadge })
    const hauteurBadgeHandeo = largeurBadge * (badgeHandeoImage.height / badgeHandeoImage.width)
    page.drawImage(badgeHandeoImage, { x: MARGE, y: 20, width: largeurBadge, height: hauteurBadgeHandeo })

    const texte = `Page ${numero}/${total}`
    const largeurTexte = fontRegular.widthOfTextAtSize(texte, 8)
    page.drawText(texte, { x: PAGE_W - MARGE - largeurTexte, y: PAGE_H - 24, size: 8, font: fontRegular, color: COULEUR_MUTED })
  }

  let page, y
  const pages = []

  function nouvellePage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    page.drawImage(logoImage, { x: MARGE, y: PAGE_H - 34 - logoHeaderHauteur, width: logoHeaderLargeur, height: logoHeaderHauteur })
    page.drawText('HETEP-IAOUT SERVICES', { x: MARGE + logoHeaderLargeur + 12, y: PAGE_H - 34 - logoHeaderHauteur / 2 + 2, size: 11, font: fontBold, color: rgb(0.106, 0.212, 0.365) })
    page.drawText("« L'utilité sur le chemin de la sérénité »", { x: MARGE + logoHeaderLargeur + 12, y: PAGE_H - 34 - logoHeaderHauteur / 2 - 10, size: 8.5, font: fontItalic, color: COULEUR_MUTED })
    page.drawLine({ start: { x: MARGE, y: PAGE_H - 44 - logoHeaderHauteur }, end: { x: PAGE_W - MARGE, y: PAGE_H - 44 - logoHeaderHauteur }, thickness: 1.2, color: COULEUR_ROUGE })
    y = PAGE_H - 44 - logoHeaderHauteur - 22
    return page
  }

  function assurerEspace(hauteur) {
    if (y - hauteur < 75) nouvellePage()
  }

  function titreSection(texte) {
    assurerEspace(26)
    page.drawRectangle({ x: MARGE, y: y - 11, width: 3, height: 13, color: COULEUR_ROUGE })
    page.drawText(texte.toUpperCase(), { x: MARGE + 9, y: y - 9, size: 9.5, font: fontBold, color: COULEUR_ROUGE })
    y -= 20
  }

  function sousTitre(texte) {
    assurerEspace(16)
    page.drawText(texte, { x: MARGE, y, size: 10.5, font: fontBold, color: COULEUR_TEXTE })
    y -= 16
  }

  function ligneDeuxColonnes(label1, val1, label2, val2) {
    assurerEspace(14)
    const largeurCol = (PAGE_W - 2 * MARGE) / 2
    page.drawText(`${label1} :`, { x: MARGE, y, size: 9.5, font: fontBold, color: COULEUR_MUTED })
    page.drawText(String(val1 || '—'), { x: MARGE + fontBold.widthOfTextAtSize(`${label1} : `, 9.5), y, size: 9.5, font: fontRegular, color: COULEUR_TEXTE })
    if (label2) {
      page.drawText(`${label2} :`, { x: MARGE + largeurCol, y, size: 9.5, font: fontBold, color: COULEUR_MUTED })
      page.drawText(String(val2 || '—'), { x: MARGE + largeurCol + fontBold.widthOfTextAtSize(`${label2} : `, 9.5), y, size: 9.5, font: fontRegular, color: COULEUR_TEXTE })
    }
    y -= 13.5
  }

  function listeEtapes(etapes, numerote) {
    const items = (etapes || []).filter(etapeAContenu)
    if (!items.length) {
      assurerEspace(12)
      page.drawText('Aucune étape.', { x: MARGE + 12, y, size: 9, font: fontItalic, color: COULEUR_MUTED })
      y -= 13
      return
    }
    items.forEach((e, i) => {
      const puce = numerote ? `${i + 1}.` : '•'
      const prefixe = e.label ? `${e.label}${e.texte ? ' : ' : ''}` : ''
      const texteComplet = `${prefixe}${e.texte}`
      const lignes = decouperEnLignes(fontRegular, texteComplet, 9.5, PAGE_W - 2 * MARGE - 18)
      assurerEspace(lignes.length * 12.5 + 2)
      page.drawText(puce, { x: MARGE, y, size: 9.5, font: fontBold, color: COULEUR_TEXTE })
      lignes.forEach((l, li) => {
        const estPremiereLigneAvecLabel = li === 0 && e.label
        if (estPremiereLigneAvecLabel) {
          page.drawText(e.label + (e.texte ? ' : ' : ''), { x: MARGE + 15, y: y - li * 12.5, size: 9.5, font: fontBold, color: COULEUR_TEXTE })
          const largeurLabel = fontBold.widthOfTextAtSize(e.label + (e.texte ? ' : ' : ''), 9.5)
          const reste = l.slice((e.label + (e.texte ? ' : ' : '')).length)
          if (reste) page.drawText(reste, { x: MARGE + 15 + largeurLabel, y: y - li * 12.5, size: 9.5, font: fontRegular, color: COULEUR_TEXTE })
        } else {
          page.drawText(l, { x: MARGE + 15, y: y - li * 12.5, size: 9.5, font: fontRegular, color: COULEUR_TEXTE })
        }
      })
      y -= lignes.length * 12.5 + 2
      const sous = (e.sous || []).filter((s) => s?.texte?.trim())
      sous.forEach((s) => {
        const sLignes = decouperEnLignes(fontRegular, s.texte, 9, PAGE_W - 2 * MARGE - 34)
        assurerEspace(sLignes.length * 11.5)
        sLignes.forEach((l, li) => {
          page.drawText(li === 0 ? `o ${l}` : l, { x: MARGE + 30, y: y - li * 11.5, size: 9, font: fontRegular, color: COULEUR_TEXTE })
        })
        y -= sLignes.length * 11.5
      })
    })
  }

  function tableauDispositif(lignes) {
    const largeurCol1 = 200
    const largeurCol2 = PAGE_W - 2 * MARGE - largeurCol1
    lignes.forEach(([label, valeur]) => {
      const vLignes = decouperEnLignes(fontRegular, valeur || '—', 9, largeurCol2 - 12)
      const hauteur = Math.max(vLignes.length * 12, 18) + 6
      assurerEspace(hauteur)
      page.drawRectangle({ x: MARGE, y: y - hauteur, width: largeurCol1, height: hauteur, color: COULEUR_FOND_LIGNE, borderColor: COULEUR_BORDURE, borderWidth: 0.5 })
      page.drawRectangle({ x: MARGE + largeurCol1, y: y - hauteur, width: largeurCol2, height: hauteur, borderColor: COULEUR_BORDURE, borderWidth: 0.5 })
      page.drawText(label, { x: MARGE + 6, y: y - 13, size: 9, font: fontBold, color: COULEUR_TEXTE })
      vLignes.forEach((l, li) => page.drawText(l, { x: MARGE + largeurCol1 + 6, y: y - 13 - li * 12, size: 9, font: fontRegular, color: COULEUR_TEXTE }))
      y -= hauteur
    })
  }

  // ---- page de garde ----
  nouvellePage()
  const nomComplet = `${p.beneficiaire?.prenom || ''} ${p.beneficiaire?.nom || ''}`.trim() || '—'
  y -= 30
  const titreTxt = `Protocole de prise en charge de ${nomComplet}`.toUpperCase()
  const titreLignes = decouperEnLignes(fontTitre, titreTxt, 16, PAGE_W - 2 * MARGE)
  titreLignes.forEach((l) => {
    const largeur = fontTitre.widthOfTextAtSize(l, 16)
    const x = (PAGE_W - largeur) / 2
    page.drawText(l, { x, y, size: 16, font: fontTitre, color: COULEUR_ROUGE })
    page.drawLine({ start: { x, y: y - 3 }, end: { x: x + largeur, y: y - 3 }, thickness: 0.75, color: COULEUR_ROUGE })
    y -= 28
  })
  y -= 220
  const metaLignes = [`Réalisé le : ${p.meta?.realiseLe || new Date().toLocaleDateString('fr-FR')}`, `Réalisé par : ${p.meta?.realisePar || '—'}`]
  metaLignes.forEach((l) => {
    const largeur = fontItalic.widthOfTextAtSize(l, 10.5)
    page.drawText(l, { x: (PAGE_W - largeur) / 2, y, size: 10.5, font: fontItalic, color: COULEUR_MUTED })
    y -= 15
  })

  // ---- page(s) de contenu ----
  nouvellePage()

  titreSection('Identité du bénéficiaire')
  ligneDeuxColonnes('Nom', p.beneficiaire?.nom, 'Prénom', p.beneficiaire?.prenom)
  ligneDeuxColonnes('Téléphone', p.beneficiaire?.telephone, 'Pathologie', p.beneficiaire?.pathologie)
  ligneDeuxColonnes("Type d'intervention", p.beneficiaire?.typeIntervention, 'Fréquence', p.beneficiaire?.frequence)
  if (p.beneficiaire?.adresse) ligneDeuxColonnes('Adresse', p.beneficiaire.adresse, null, null)
  y -= 6

  titreSection('Identité du tuteur')
  ligneDeuxColonnes('Nom', p.tuteur?.nom, 'Prénom', p.tuteur?.prenom)
  ligneDeuxColonnes('Lien', p.tuteur?.lien, 'Téléphone', p.tuteur?.telephone)
  if (p.tuteur?.mail) ligneDeuxColonnes('Mail', p.tuteur.mail, null, null)
  y -= 6

  titreSection('Description des interventions')
  ;(p.moments || []).forEach((m) => {
    sousTitre(`${m.titre || 'Moment sans titre'} :`)
    listeEtapes(m.etapes, m.type !== 'puces')
    y -= 4
  })
  if ((p.procedures || []).length) {
    sousTitre(`${p.procSpecifiquesTitre || 'Procédures spécifiques'} :`)
    p.procedures.forEach((pr) => {
      sousTitre(pr.nom || 'Procédure sans nom')
      listeEtapes(pr.etapes, pr.type !== 'puces')
      y -= 4
    })
  }

  titreSection('Objectifs de la prise en charge')
  listeEtapes(p.objectifs, false)
  y -= 6

  titreSection('Instructions particulières')
  listeEtapes(p.instructions, false)
  y -= 6

  titreSection('Dispositif à mettre en place')
  const d = p.dispositif || {}
  tableauDispositif([
    ['Cahier de courses', d.cahierCourses ? 'Oui' : 'Non'],
    ['Cahier de liaison', (d.cahierLiaison ? 'Oui' : 'Non') + (d.cahierLiaisonNote ? ` — ${d.cahierLiaisonNote}` : '')],
    ['Remise de clé', d.remiseCle ? 'Oui' : 'Non'],
    ["En cas d'absence ou de retard", d.absenceRetard],
    ['Niveau de remplacement', d.niveauRemplacement],
    ['Comportements particuliers', d.comportements],
    ["Numéro d'astreinte", d.numeroAstreinte],
  ])

  pages.forEach((pg, i) => dessinerPiedDePage(pg, i + 1, pages.length))

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}
