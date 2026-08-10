import { rgb } from 'pdf-lib'

/**
 * Écrit un texte libre sur plusieurs lignes en respectant la vraie largeur
 * disponible (mesurée via `font.widthOfTextAtSize`, pas un nombre de
 * caractères deviné à l'œil) — sinon le texte soit s'arrête bien avant le
 * bord du bloc (largeur sous-estimée), soit déborde dessus (largeur
 * surestimée). `coord` attend `x`, `y`, `ligneHauteur`, `maxLignes`, et
 * `largeur` (largeur max en points, calée sur les vraies limites du bloc du
 * gabarit — voir COORDS dans reclamationPdf.js/congesPdf.js).
 */
export function ecrireMultiligne(page, font, texte, coord, taille = 9.5, couleur = rgb(0.07, 0.07, 0.07)) {
  if (!texte) return
  const mots = String(texte).split(/\s+/)
  let ligne = ''
  const lignes = []
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot
    if (font.widthOfTextAtSize(essai, taille) > coord.largeur) {
      if (ligne) lignes.push(ligne)
      ligne = mot
    } else {
      ligne = essai
    }
  }
  if (ligne) lignes.push(ligne)
  lignes.slice(0, coord.maxLignes).forEach((l, i) => {
    page.drawText(l, {
      x: coord.x,
      y: coord.y - i * coord.ligneHauteur,
      size: taille,
      font,
      color: couleur,
    })
  })
}
