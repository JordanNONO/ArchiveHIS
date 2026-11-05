import React from 'react'
import { useTranslation } from 'react-i18next'
import { LuDownload } from 'react-icons/lu'

/**
 * Carte affichée quand un fichier n'a pas d'aperçu dans le navigateur.
 *
 * L'ancien message — « pas encore prise en charge et en cours de
 * développement » — laissait croire à une fonctionnalité à venir pour TOUS
 * les formats, y compris ceux qui ne s'afficheront jamais dans un navigateur
 * (plan AutoCAD, exécutable...). Et il ne disait pas de quel type de fichier
 * il s'agissait, ce qui rendait la situation incompréhensible.
 *
 * On annonce donc le type exact, la taille, et le téléchargement comme seule
 * façon d'ouvrir le document.
 */
function InvalideFormat({ href, libelle, extension, nomFichier, taille }) {
  const { t } = useTranslation()

  return (
    <div className='flex items-center justify-center p-3 bg-muted/40 absolute w-full h-full left-0'>
      <div className='mx-6 flex flex-col items-center justify-center gap-4 max-w-md text-center'>
        <span className='relative grid place-items-center w-[72px] h-[88px] rounded-lg bg-muted-foreground text-white font-mono font-medium text-lg'>
          {(extension || '?').toUpperCase().slice(0, 4)}
        </span>
        <h1 className='text-lg font-semibold text-foreground'>{libelle || t('docView.apercuIndisponibleTitre')}</h1>
        <p className='text-sm text-muted-foreground'>{t('docView.apercuIndisponibleTexte')}</p>
        {(nomFichier || taille) && (
          <p className='text-xs text-muted-foreground font-mono'>
            {[nomFichier, taille].filter(Boolean).join(' · ')}
          </p>
        )}
        <a
          className='inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors'
          href={href}
        >
          <LuDownload size={15} />
          {t('docView.telecharger')}
        </a>
      </div>
    </div>
  )
}

export default InvalideFormat
