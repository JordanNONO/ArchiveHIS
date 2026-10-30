import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import hisLogoUrl from '../assets/his-logo.png'
import badgeUrl from '../assets/logo-services-a-la-personne.jpg'
import badgeHandeoUrl from '../assets/logo-cap-handeo.jpg'

/**
 * Génère le PDF du "Projet Individualisé d'Aide et d'Accompagnement" (PIAA)
 * rédigé depuis ProtocolePai.jsx — reprend l'en-tête/pied de page/badges de
 * paiPdf.js (même identité visuelle), avec la mise en page du gabarit papier
 * fourni par HIS : page de garde, rubriques numérotées à bandeau rouge,
 * planning hebdomadaire en tableau, dispositif, accepte/refuse, signatures.
 */

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGE = 48
const COULEUR_TEXTE = rgb(0.09, 0.11, 0.14)
const COULEUR_MUTED = rgb(0.54, 0.58, 0.64)
const COULEUR_ROUGE = rgb(0.643, 0.137, 0.102)
const COULEUR_ROUGE_FOND = rgb(0.984, 0.918, 0.910)
const COULEUR_BORDURE = rgb(0.84, 0.86, 0.9)
const COULEUR_FOND_LIGNE = rgb(0.97, 0.98, 0.98)
const COULEUR_NAVY = rgb(0.106, 0.212, 0.365)
const COULEUR_OK = rgb(0.122, 0.478, 0.271)
const COULEUR_OK_FOND = rgb(0.894, 0.961, 0.918)

const JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
const HEURE_MIN = 7
const HEURE_MAX = 20

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

function age(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const t = new Date()
  let a = t.getFullYear() - d.getFullYear()
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--
  return isNaN(a) ? null : a
}
function formatDateFr(iso) {
  if (!iso) return ''
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}
function hhmmToMin(t) { if (!t) return 0; const p = t.split(':'); return (+p[0]) * 60 + (+(p[1] || 0)) }
function fmtDureeMin(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h` }
function statsPlanning(creneaux) {
  const passages = creneaux.length
  const minutesTotal = creneaux.reduce((s, c) => s + Math.max(0, hhmmToMin(c.fin) - hhmmToMin(c.debut)), 0)
  const jours = new Set(creneaux.map((c) => c.jour))
  const moy = passages ? minutesTotal / passages : 0
  return { passages, heures: fmtDureeMin(minutesTotal), jours: jours.size, moy: fmtDureeMin(moy) }
}
function dureeJourTexte(creneaux, jour) {
  const crJour = creneaux.filter((c) => c.jour === jour)
  if (!crJour.length) return '—'
  return fmtDureeMin(crJour.reduce((s, c) => s + Math.max(0, hhmmToMin(c.fin) - hhmmToMin(c.debut)), 0))
}

export async function genererPdfProtocolePai(p, extra = {}) {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const fontTitre = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
  const fontTitreItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)

  const [logoBytes, badgeBytes, badgeHandeoBytes] = await Promise.all([
    fetch(hisLogoUrl).then((r) => r.arrayBuffer()),
    fetch(badgeUrl).then((r) => r.arrayBuffer()),
    fetch(badgeHandeoUrl).then((r) => r.arrayBuffer()),
  ])
  const logoImage = await pdfDoc.embedPng(logoBytes)
  const badgeImage = await pdfDoc.embedJpg(badgeBytes)
  const badgeHandeoImage = await pdfDoc.embedJpg(badgeHandeoBytes)

  const LIGNES_PIED_DE_PAGE = [
    '8 place Georges Braque, 93120 La Courneuve  Tél: 01 43 52 64 23  Fax: 01 43 11 09 67',
    'Sarl au Capital de 6000 euros, Siret : 493 761 175 00030 R.C.S.Bobigny',
    'APE 9609Z. Agrément Qualité Préfectoral : SAP493761175',
  ]

  function dessinerPiedDePage(page, numero, total) {
    page.drawLine({ start: { x: MARGE, y: 54 }, end: { x: PAGE_W - MARGE, y: 54 }, thickness: 0.5, color: rgb(0, 0, 0) })
    LIGNES_PIED_DE_PAGE.forEach((ligne, i) => {
      const largeur = fontRegular.widthOfTextAtSize(ligne, 7.5)
      page.drawText(ligne, { x: (PAGE_W - largeur) / 2, y: 42 - i * 9.5, size: 7.5, font: fontRegular, color: rgb(0, 0, 0) })
    })
    const largeurBadge = 42
    const hauteurBadge = largeurBadge * (badgeImage.height / badgeImage.width)
    page.drawImage(badgeImage, { x: PAGE_W - MARGE - largeurBadge, y: 18, width: largeurBadge, height: hauteurBadge })
    const hauteurBadgeHandeo = largeurBadge * (badgeHandeoImage.height / badgeHandeoImage.width)
    page.drawImage(badgeHandeoImage, { x: MARGE, y: 18, width: largeurBadge, height: hauteurBadgeHandeo })
    const texte = `${numero} / ${total}`
    const largeurTexte = fontRegular.widthOfTextAtSize(texte, 8)
    page.drawText(texte, { x: PAGE_W - MARGE - largeurTexte, y: PAGE_H - 24, size: 8, font: fontRegular, color: COULEUR_MUTED })
  }

  let page, y
  const pages = []
  const nomComplet = `${p.beneficiaire?.prenom || ''} ${p.beneficiaire?.nom || ''}`.trim() || '—'
  const ageVal = age(p.beneficiaire?.dateNaissance)

  function enteteContenu(pg) {
    const logoL = 24, logoH = logoL * (logoImage.height / logoImage.width)
    pg.drawImage(logoImage, { x: MARGE, y: PAGE_H - 28 - logoH, width: logoL, height: logoH })
    const t1 = 'HETEP-IAOUT SERVICES'
    const l1 = fontBold.widthOfTextAtSize(t1, 10.5)
    pg.drawText(t1, { x: PAGE_W - MARGE - l1, y: PAGE_H - 32, size: 10.5, font: fontBold, color: COULEUR_NAVY })
    const t2 = "« L'utilité sur le chemin de la sérénité »"
    const l2 = fontItalic.widthOfTextAtSize(t2, 8)
    pg.drawText(t2, { x: PAGE_W - MARGE - l2, y: PAGE_H - 42, size: 8, font: fontItalic, color: COULEUR_MUTED })
    const t3 = `PIAA · Mme ${nomComplet.toUpperCase()}`
    const l3 = fontRegular.widthOfTextAtSize(t3, 7)
    pg.drawText(t3, { x: PAGE_W - MARGE - l3, y: PAGE_H - 51, size: 7, font: fontRegular, color: rgb(0.76, 0.78, 0.82) })
    pg.drawLine({ start: { x: MARGE, y: PAGE_H - 58 }, end: { x: PAGE_W - MARGE, y: PAGE_H - 58 }, thickness: 1.3, color: COULEUR_NAVY })
    y = PAGE_H - 58 - 22
  }

  function ajouterPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    return page
  }

  function nouvellePage() {
    ajouterPage()
    enteteContenu(page)
    return page
  }

  function assurerEspace(hauteur) { if (y - hauteur < 72) nouvellePage() }

  function titreSection(n, texte) {
    assurerEspace(24)
    page.drawRectangle({ x: MARGE, y: y - 13, width: 15, height: 15, color: COULEUR_NAVY })
    const nLargeur = fontBold.widthOfTextAtSize(n, 8.5)
    page.drawText(n, { x: MARGE + (15 - nLargeur) / 2, y: y - 9.5, size: 8.5, font: fontBold, color: rgb(1, 1, 1) })
    page.drawText(texte, { x: MARGE + 22, y: y - 10, size: 12, font: fontTitreItalic, color: COULEUR_ROUGE })
    y -= 18
    page.drawLine({ start: { x: MARGE, y }, end: { x: PAGE_W - MARGE, y }, thickness: 1, color: COULEUR_ROUGE, opacity: 0.35 })
    y -= 12
  }

  function infoItem(x, largeur, label, valeur) {
    page.drawText(label.toUpperCase(), { x, y, size: 7, font: fontBold, color: COULEUR_MUTED })
    const lignes = decouperEnLignes(fontBold, valeur || '—', 9.5, largeur)
    lignes.forEach((l, i) => page.drawText(l, { x, y: y - 12 - i * 11, size: 9.5, font: fontBold, color: COULEUR_TEXTE }))
    return lignes.length
  }

  function carteInfo(items) {
    // items: [[label, valeur, pleineLargeur], ...] deux colonnes par défaut
    const largeurCol = (PAGE_W - 2 * MARGE - 24) / 2
    assurerEspace(16)
    const yDebutCarte = y
    let yCourant = y - 10
    let i = 0
    const positions = []
    while (i < items.length) {
      const [l1, v1, pleine1] = items[i]
      if (pleine1) {
        positions.push({ x: MARGE + 12, y: yCourant, l: l1, v: v1, largeur: PAGE_W - 2 * MARGE - 24 })
        const lignes = decouperEnLignes(fontBold, v1 || '—', 9.5, PAGE_W - 2 * MARGE - 24)
        yCourant -= 12 + (lignes.length - 1) * 11 + 12
        i += 1
      } else {
        const [l2, v2] = items[i + 1] || [null, null]
        positions.push({ x: MARGE + 12, y: yCourant, l: l1, v: v1, largeur: largeurCol })
        if (l2) positions.push({ x: MARGE + 12 + largeurCol + 24, y: yCourant, l: l2, v: v2, largeur: largeurCol })
        const h1 = decouperEnLignes(fontBold, v1 || '—', 9.5, largeurCol).length
        const h2 = l2 ? decouperEnLignes(fontBold, v2 || '—', 9.5, largeurCol).length : 1
        yCourant -= 12 + (Math.max(h1, h2) - 1) * 11 + 12
        i += 2
      }
    }
    const hauteurCarte = yDebutCarte - yCourant + 2
    page.drawRectangle({ x: MARGE, y: yCourant - 2, width: PAGE_W - 2 * MARGE, height: hauteurCarte, color: COULEUR_FOND_LIGNE, borderColor: COULEUR_BORDURE, borderWidth: 0.6 })
    y = yDebutCarte
    positions.forEach((pos) => { y = pos.y; infoItem(pos.x, pos.largeur, pos.l, pos.v) })
    y = yCourant - 10
  }

  function paragraphe(texte, taille = 9.5) {
    const lignes = decouperEnLignes(fontRegular, texte || '—', taille, PAGE_W - 2 * MARGE)
    assurerEspace(lignes.length * 13)
    lignes.forEach((l, i) => page.drawText(l, { x: MARGE, y: y - i * 13, size: taille, font: fontRegular, color: rgb(0.19, 0.23, 0.29) }))
    y -= lignes.length * 13 + 6
  }

  function listeEtapes(etapes, numerote) {
    const items = (etapes || []).filter(etapeAContenu)
    items.forEach((e, i) => {
      const puce = numerote ? `${i + 1}.` : '•'
      const texteComplet = `${e.label ? e.label + (e.texte ? ' : ' : '') : ''}${e.texte}`
      const lignes = decouperEnLignes(fontRegular, texteComplet, 9, PAGE_W - 2 * MARGE - 16)
      assurerEspace(lignes.length * 11.5 + 2)
      page.drawText(puce, { x: MARGE, y, size: 9, font: fontBold, color: COULEUR_TEXTE })
      lignes.forEach((l, li) => page.drawText(l, { x: MARGE + 14, y: y - li * 11.5, size: 9, font: fontRegular, color: COULEUR_TEXTE }))
      y -= lignes.length * 11.5 + 2
      const sous = (e.sous || []).filter((s) => s?.texte?.trim())
      sous.forEach((s) => {
        const sLignes = decouperEnLignes(fontRegular, s.texte, 8.5, PAGE_W - 2 * MARGE - 32)
        assurerEspace(sLignes.length * 11)
        sLignes.forEach((l, li) => page.drawText(li === 0 ? `o ${l}` : l, { x: MARGE + 28, y: y - li * 11, size: 8.5, font: fontRegular, color: COULEUR_TEXTE }))
        y -= sLignes.length * 11
      })
    })
  }

  // ---- page de garde (pas d'en-tête de contenu : elle a son propre logo/titre) ----
  ajouterPage()
  const coverLogoL = 60, coverLogoH = coverLogoL * (logoImage.height / logoImage.width)
  page.drawImage(logoImage, { x: MARGE, y: PAGE_H - 30 - coverLogoH, width: coverLogoL, height: coverLogoH })
  const orgT = 'HETEP-IAOUT SERVICES'
  const orgL = fontBold.widthOfTextAtSize(orgT, 12)
  page.drawText(orgT, { x: PAGE_W - MARGE - orgL, y: PAGE_H - 40, size: 12, font: fontBold, color: COULEUR_NAVY })
  const orgT2 = "SERVICE D'AIDE À DOMICILE"
  const orgL2 = fontRegular.widthOfTextAtSize(orgT2, 8)
  page.drawText(orgT2, { x: PAGE_W - MARGE - orgL2, y: PAGE_H - 51, size: 8, font: fontRegular, color: COULEUR_MUTED })

  y = PAGE_H - 94
  const badgeTxt = 'DOCUMENT DE PRISE EN CHARGE'
  const badgeLargeur = fontBold.widthOfTextAtSize(badgeTxt, 8) + 26
  page.drawRectangle({ x: (PAGE_W - badgeLargeur) / 2, y: y - 13, width: badgeLargeur, height: 20, color: COULEUR_FOND_LIGNE, borderColor: COULEUR_BORDURE, borderWidth: 0.7 })
  page.drawText(badgeTxt, { x: (PAGE_W - fontBold.widthOfTextAtSize(badgeTxt, 8)) / 2, y: y - 7, size: 8, font: fontBold, color: COULEUR_NAVY })
  y -= 40

  ;['Projet Individualisé d\'Aide', "et d'Accompagnement"].forEach((l) => {
    const largeur = fontTitre.widthOfTextAtSize(l, 21)
    page.drawText(l, { x: (PAGE_W - largeur) / 2, y, size: 21, font: fontTitre, color: COULEUR_ROUGE })
    y -= 27
  })
  y -= 6
  const nomTxt = `Mme ${nomComplet.toUpperCase()}`
  const nomLargeur = fontTitre.widthOfTextAtSize(nomTxt, 15)
  page.drawText(nomTxt, { x: (PAGE_W - nomLargeur) / 2, y, size: 15, font: fontTitre, color: COULEUR_TEXTE })
  y -= 20
  const metaTxt = `${p.beneficiaire?.dateNaissance ? `Né(e) le ${formatDateFr(p.beneficiaire.dateNaissance)}${ageVal !== null ? ` · ${ageVal} ans` : ''} · ` : ''}${p.beneficiaire?.adresse || ''}`
  const metaLargeur = fontRegular.widthOfTextAtSize(metaTxt, 9.5)
  page.drawText(metaTxt, { x: (PAGE_W - metaLargeur) / 2, y, size: 9.5, font: fontRegular, color: COULEUR_MUTED })
  y -= 30

  const photoH = 190, photoW = PAGE_W - 2 * MARGE - 40
  page.drawRectangle({ x: MARGE + 20, y: y - photoH, width: photoW, height: photoH, color: rgb(0.925, 0.937, 0.953) })
  const photoTxt = "photo à charger"
  const photoTxtL = fontItalic.widthOfTextAtSize(photoTxt, 9)
  page.drawText(photoTxt, { x: (PAGE_W - photoTxtL) / 2, y: y - photoH / 2, size: 9, font: fontItalic, color: COULEUR_MUTED })
  y -= photoH + 26

  const org2 = 'HETEP IAOUT SERVICES (HIS)'
  const org2L = fontTitre.widthOfTextAtSize(org2, 11)
  page.drawText(org2, { x: (PAGE_W - org2L) / 2, y, size: 11, font: fontTitre, color: COULEUR_NAVY })
  y -= 14
  const org3 = "« L'utilité sur le chemin de la sérénité »"
  const org3L = fontTitreItalic.widthOfTextAtSize(org3, 9.5)
  page.drawText(org3, { x: (PAGE_W - org3L) / 2, y, size: 9.5, font: fontTitreItalic, color: COULEUR_MUTED })
  y -= 26

  const boxesY = y, boxW = (PAGE_W - 2 * MARGE - 16) / 3
  ;[
    ['Réalisé le', p.meta?.realiseLe],
    ['Réalisé par', p.meta?.realisePar],
    ['Responsable de secteur', extra.responsableSecteur],
  ].forEach(([label, valeur], i) => {
    const bx = MARGE + i * (boxW + 8)
    page.drawRectangle({ x: bx, y: boxesY - 38, width: boxW, height: 38, borderColor: COULEUR_BORDURE, borderWidth: 0.7 })
    page.drawText(label.toUpperCase(), { x: bx + 8, y: boxesY - 14, size: 6.5, font: fontBold, color: COULEUR_MUTED })
    page.drawText(valeur || '—', { x: bx + 8, y: boxesY - 28, size: 9, font: fontBold, color: COULEUR_TEXTE })
  })

  // ---- page 2 ----
  nouvellePage()
  titreSection('01', 'Identité du bénéficiaire')
  carteInfo([
    ['Nom(s)', p.beneficiaire?.nom], ['Prénom(s)', p.beneficiaire?.prenom],
    ['Date de naissance', p.beneficiaire?.dateNaissance ? `${formatDateFr(p.beneficiaire.dateNaissance)}${ageVal !== null ? ` (${ageVal} ans)` : ''}` : null], ['Téléphone', p.beneficiaire?.telephone],
    ['Adresse', p.beneficiaire?.adresse, true],
    ['Pathologie', p.beneficiaire?.pathologie], ['Médecin traitant', p.beneficiaire?.medecinTraitant],
    ['Traitement(s)', p.beneficiaire?.traitements, true],
  ])
  y -= 6
  titreSection('02', 'Identité du tuteur')
  carteInfo([
    ['Nom(s)', p.tuteur?.nom], ['Prénom(s)', p.tuteur?.prenom],
    ['Lien avec le bénéficiaire', p.tuteur?.lien], ['Téléphone', p.tuteur?.telephone],
    ['Téléphone fixe', p.tuteur?.telephoneFixe], ['E-mail', p.tuteur?.mail],
    ['Adresse', p.tuteur?.adresse, true],
  ])
  y -= 6
  titreSection('03', 'Historique de la pathologie ou de sa survenance')
  paragraphe(p.historique)

  // ---- page 3 : planning + interventions + objectifs ----
  nouvellePage()
  const creneaux = p.planning?.creneaux || []
  const st = statsPlanning(creneaux)
  titreSection('04', 'Organisation des prestations')
  paragraphe(`HIS intervient ${st.passages} fois par semaine chez ${p.beneficiaire?.nom ? `Mme ${p.beneficiaire.nom}` : 'le/la bénéficiaire'} selon le planning ci-dessous.`)

  assurerEspace(50)
  const tuileW = (PAGE_W - 2 * MARGE - 18) / 4
  ;[[st.passages, 'Passages / semaine', false], [st.heures, 'Heures / semaine', false], [st.jours, "Jours d'intervention", false], [st.moy, 'Durée moy. passage', true]].forEach(([val, label, accent], i) => {
    const tx = MARGE + i * (tuileW + 6)
    page.drawRectangle({ x: tx, y: y - 36, width: tuileW, height: 36, color: accent ? COULEUR_ROUGE_FOND : COULEUR_FOND_LIGNE })
    const valTxt = String(val)
    page.drawText(valTxt, { x: tx + 8, y: y - 18, size: 15, font: fontBold, color: accent ? COULEUR_ROUGE : COULEUR_NAVY })
    const lignes = decouperEnLignes(fontBold, label, 6, tuileW - 14)
    lignes.forEach((l, li) => page.drawText(l, { x: tx + 8, y: y - 26 - li * 7, size: 6, font: fontBold, color: COULEUR_MUTED }))
  })
  y -= 50

  // Tableau du planning — grille hebdomadaire avec cellules fusionnées pour
  // chaque créneau, comme une vraie planification papier (demande explicite
  // : "mets ça sous forme de tableau comme sur le pdf").
  const rowsH = HEURE_MAX - HEURE_MIN
  const ligneH = 12.5
  const colHeureW = 24
  const colJourW = (PAGE_W - 2 * MARGE - colHeureW) / 7
  assurerEspace(20 + rowsH * ligneH)
  const tableTop = y
  page.drawRectangle({ x: MARGE, y: tableTop - 20, width: PAGE_W - 2 * MARGE, height: 20, color: COULEUR_NAVY })
  JOURS.forEach((j, i) => {
    const jx = MARGE + colHeureW + i * colJourW
    const jl = fontBold.widthOfTextAtSize(j, 7)
    page.drawText(j, { x: jx + (colJourW - jl) / 2, y: tableTop - 11, size: 7, font: fontBold, color: rgb(1, 1, 1) })
    const dTxt = dureeJourTexte(creneaux, j)
    const dl = fontRegular.widthOfTextAtSize(dTxt, 5.5)
    page.drawText(dTxt, { x: jx + (colJourW - dl) / 2, y: tableTop - 18, size: 5.5, font: fontRegular, color: rgb(0.8, 0.84, 0.9) })
    if (i > 0) page.drawLine({ start: { x: jx, y: tableTop - 20 }, end: { x: jx, y: tableTop }, thickness: 0.5, color: rgb(1, 1, 1), opacity: 0.2 })
  })

  const bodyTop = tableTop - 20
  const bodyBottom = bodyTop - rowsH * ligneH
  page.drawRectangle({ x: MARGE, y: bodyBottom, width: PAGE_W - 2 * MARGE, height: rowsH * ligneH, color: rgb(1, 1, 1), borderColor: COULEUR_BORDURE, borderWidth: 0.6 })
  for (let h = 0; h <= rowsH; h++) {
    const ly = bodyTop - h * ligneH
    page.drawLine({ start: { x: MARGE, y: ly }, end: { x: PAGE_W - MARGE, y: ly }, thickness: 0.4, color: COULEUR_BORDURE })
    if (h < rowsH) page.drawText(`${HEURE_MIN + h}h`, { x: MARGE + 2, y: ly - 9, size: 5.5, font: fontRegular, color: COULEUR_MUTED })
  }
  for (let i = 0; i <= 7; i++) {
    const lx = MARGE + colHeureW + i * colJourW
    page.drawLine({ start: { x: lx, y: bodyTop }, end: { x: lx, y: bodyBottom }, thickness: 0.4, color: COULEUR_BORDURE })
  }
  JOURS.forEach((j, i) => {
    const jx = MARGE + colHeureW + i * colJourW
    const crJour = creneaux.filter((c) => c.jour === j)
    if (!crJour.length) {
      page.drawRectangle({ x: jx + 0.4, y: bodyBottom, width: colJourW - 0.8, height: rowsH * ligneH, color: rgb(0.95, 0.96, 0.97) })
    }
    crJour.forEach((c) => {
      const hDeb = Math.max(HEURE_MIN, hhmmToMin(c.debut) / 60)
      const hFin = Math.min(HEURE_MAX, Math.max(hDeb + 0.25, hhmmToMin(c.fin) / 60))
      const blocTop = bodyTop - (hDeb - HEURE_MIN) * ligneH
      const blocH = (hFin - hDeb) * ligneH
      page.drawRectangle({ x: jx + 1, y: blocTop - blocH, width: colJourW - 2, height: blocH, color: COULEUR_NAVY })
      const heureTxt = `${c.debut}-${c.fin}`
      const htL = fontBold.widthOfTextAtSize(heureTxt, 5)
      page.drawText(heureTxt, { x: jx + (colJourW - htL) / 2, y: blocTop - 8, size: 5, font: fontBold, color: rgb(1, 1, 1) })
      if (c.label && blocH > 16) {
        const lblLignes = decouperEnLignes(fontRegular, c.label, 4.8, colJourW - 4)
        lblLignes.slice(0, 2).forEach((l, li) => {
          const ll = fontRegular.widthOfTextAtSize(l, 4.8)
          page.drawText(l, { x: jx + (colJourW - ll) / 2, y: blocTop - 15 - li * 6, size: 4.8, font: fontRegular, color: rgb(0.9, 0.93, 0.97) })
        })
      }
    })
  })
  y = bodyBottom - 16

  titreSection('05', 'Description des interventions')
  paragraphe(p.interventions?.description)
  const tags = (p.interventions?.tags || []).filter((t) => t.trim())
  if (tags.length) {
    assurerEspace(18)
    let tx = MARGE
    tags.forEach((tag) => {
      const tl = fontBold.widthOfTextAtSize(tag, 7.5)
      const pillW = tl + 16
      if (tx + pillW > PAGE_W - MARGE) { tx = MARGE; y -= 16 }
      page.drawRectangle({ x: tx, y: y - 11, width: pillW, height: 14, color: rgb(0.906, 0.925, 0.953) })
      page.drawText(tag, { x: tx + 8, y: y - 7, size: 7.5, font: fontBold, color: COULEUR_NAVY })
      tx += pillW + 6
    })
    y -= 22
  }

  titreSection('06', 'Objectifs de la prise en charge')
  paragraphe(p.objectifs)

  const moments = p.moments || [], procedures = p.procedures || []
  if (moments.length || procedures.length) {
    assurerEspace(20)
    page.drawRectangle({ x: MARGE, y: y - 13, width: 15, height: 15, color: COULEUR_ROUGE })
    page.drawText('+', { x: MARGE + 5, y: y - 10, size: 9, font: fontBold, color: rgb(1, 1, 1) })
    page.drawText('Programme détaillé', { x: MARGE + 22, y: y - 10, size: 12, font: fontTitreItalic, color: COULEUR_ROUGE })
    y -= 18
    page.drawLine({ start: { x: MARGE, y }, end: { x: PAGE_W - MARGE, y }, thickness: 1, color: COULEUR_ROUGE, opacity: 0.35 })
    y -= 12
    moments.forEach((m) => {
      assurerEspace(12)
      page.drawText(`${m.titre || 'Moment'} :`, { x: MARGE, y, size: 10, font: fontBold, color: COULEUR_TEXTE })
      y -= 14
      listeEtapes(m.etapes, m.type !== 'puces')
      y -= 4
    })
    if (procedures.length && p.procSpecifiquesTitre) {
      assurerEspace(12)
      page.drawText(`${p.procSpecifiquesTitre} :`, { x: MARGE, y, size: 10, font: fontBold, color: COULEUR_TEXTE })
      y -= 14
    }
    procedures.forEach((pr) => {
      assurerEspace(12)
      page.drawText(`${pr.nom || 'Procédure'} :`, { x: MARGE, y, size: 10, font: fontBold, color: COULEUR_TEXTE })
      y -= 14
      listeEtapes(pr.etapes, pr.type !== 'puces')
      y -= 4
    })
  }

  // ---- page 4 : dispositif, à savoir, décision, signatures ----
  nouvellePage()
  titreSection('07', 'Dispositif à mettre en place')
  const d = p.dispositif || {}
  function lignePill(label, actif) {
    assurerEspace(18)
    page.drawText(label, { x: MARGE, y, size: 9.5, font: fontBold, color: COULEUR_TEXTE })
    const txt = actif ? 'Oui' : 'Non'
    const pillW = fontBold.widthOfTextAtSize(txt, 8) + 16
    page.drawRectangle({ x: MARGE + 220, y: y - 3, width: pillW, height: 13, color: actif ? COULEUR_OK_FOND : COULEUR_FOND_LIGNE })
    page.drawText(txt, { x: MARGE + 220 + 8, y: y, size: 8, font: fontBold, color: actif ? COULEUR_OK : COULEUR_MUTED })
    page.drawLine({ start: { x: MARGE, y: y - 7 }, end: { x: PAGE_W - MARGE, y: y - 7 }, thickness: 0.4, color: COULEUR_BORDURE })
    y -= 18
  }
  function ligneTexte(label, valeur) {
    assurerEspace(16)
    page.drawText(label, { x: MARGE, y, size: 9.5, font: fontBold, color: COULEUR_TEXTE })
    y -= 12
    const lignes = decouperEnLignes(fontRegular, valeur || '—', 9, PAGE_W - 2 * MARGE)
    lignes.forEach((l, i) => page.drawText(l, { x: MARGE, y: y - i * 11, size: 9, font: fontRegular, color: rgb(0.19, 0.23, 0.29) }))
    y -= lignes.length * 11 + 3
    page.drawLine({ start: { x: MARGE, y: y + 2 }, end: { x: PAGE_W - MARGE, y: y + 2 }, thickness: 0.4, color: COULEUR_BORDURE })
    y -= 6
  }
  lignePill('Cahier de courses', d.cahierCourses)
  lignePill('Cahier de liaison', d.cahierLiaison)
  lignePill('Remise de clé', d.remiseCle)
  ligneTexte("En cas d'absence ou de retard", d.absenceRetard)
  ligneTexte('Niveau de remplacement', d.niveauRemplacement)
  ligneTexte('Comportements particuliers', d.comportements)
  ligneTexte('Autres', d.autres)

  if (p.aSavoir) {
    y -= 4
    const lignes = decouperEnLignes(fontItalic, p.aSavoir, 9.5, PAGE_W - 2 * MARGE - 24)
    assurerEspace(lignes.length * 13 + 26)
    const hBoite = lignes.length * 13 + 24
    page.drawRectangle({ x: MARGE, y: y - hBoite, width: PAGE_W - 2 * MARGE, height: hBoite, color: COULEUR_ROUGE_FOND, borderColor: COULEUR_ROUGE, borderWidth: 0.8 })
    page.drawText('À SAVOIR · PS', { x: MARGE + 12, y: y - 14, size: 7.5, font: fontBold, color: COULEUR_ROUGE })
    lignes.forEach((l, i) => page.drawText(l, { x: MARGE + 12, y: y - 28 - i * 13, size: 9.5, font: fontItalic, color: rgb(0.29, 0.14, 0.13) }))
    y -= hBoite + 14
  }

  assurerEspace(30)
  const decW = (PAGE_W - 2 * MARGE - 10) / 2
  ;[['Le bénéficiaire accepte le projet', p.decision === 'accepte'], ['Le bénéficiaire refuse le projet', p.decision === 'refuse']].forEach(([label, actif], i) => {
    const bx = MARGE + i * (decW + 10)
    page.drawRectangle({ x: bx, y: y - 22, width: decW, height: 22, borderColor: actif ? COULEUR_NAVY : COULEUR_BORDURE, borderWidth: actif ? 1.2 : 0.7, color: actif ? rgb(0.906, 0.925, 0.953) : undefined })
    page.drawRectangle({ x: bx + 8, y: y - 15, width: 9, height: 9, borderColor: actif ? COULEUR_NAVY : rgb(0.78, 0.81, 0.86), borderWidth: 1, color: actif ? COULEUR_NAVY : rgb(1, 1, 1) })
    if (actif) page.drawText('X', { x: bx + 10, y: y - 14, size: 7, font: fontBold, color: rgb(1, 1, 1) })
    const lignes = decouperEnLignes(fontBold, label, 8, decW - 28)
    lignes.forEach((l, li) => page.drawText(l, { x: bx + 24, y: y - 12 - li * 9, size: 8, font: fontBold, color: COULEUR_TEXTE }))
  })
  y -= 36

  page.drawText('Fait à', { x: MARGE, y, size: 8, font: fontRegular, color: COULEUR_MUTED })
  page.drawText('Le', { x: MARGE + 160, y, size: 8, font: fontRegular, color: COULEUR_MUTED })
  y -= 12
  page.drawText(p.faitA || '—', { x: MARGE, y, size: 10, font: fontBold, color: COULEUR_TEXTE })
  page.drawText(p.faitLe ? formatDateFr(p.faitLe) : '—', { x: MARGE + 160, y, size: 10, font: fontBold, color: COULEUR_TEXTE })
  y -= 26

  const signW = (PAGE_W - 2 * MARGE - 14) / 2
  ;[['Signature du représentant du prestataire', 'HETEP-IAOUT SERVICES'], ['Signature du bénéficiaire', `Mme ${nomComplet}`]].forEach(([label, who], i) => {
    const bx = MARGE + i * (signW + 14)
    page.drawRectangle({ x: bx, y: y - 56, width: signW, height: 56, borderColor: rgb(0.84, 0.86, 0.9), borderWidth: 0.7, dashArray: [2, 2] })
    const lignes = decouperEnLignes(fontBold, label, 7.5, signW - 16)
    lignes.forEach((l, li) => page.drawText(l, { x: bx + 8, y: y - 12 - li * 9, size: 7.5, font: fontBold, color: COULEUR_MUTED }))
    page.drawText(who, { x: bx + 8, y: y - 46, size: 8.5, font: fontBold, color: COULEUR_TEXTE })
  })

  pages.forEach((pg, i) => dessinerPiedDePage(pg, i + 1, pages.length))

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}
