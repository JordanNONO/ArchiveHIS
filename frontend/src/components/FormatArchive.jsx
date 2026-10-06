import React from 'react'
import { useTranslation } from 'react-i18next'
import { FaFileZipper } from 'react-icons/fa6'
import { LuDownload } from 'react-icons/lu'

/**
 * Remplace InvalideFormat pour un .zip — "pas encore pris en charge, en
 * développement" est trompeur ici : une archive ne se prévisualisera
 * jamais comme un PDF/Word, ce n'est pas une question de développement.
 * Message dédié et honnête, avec le fichier et son téléchargement en évidence.
 */
function FormatArchive({ href, nomFichier, taille }) {
  const { t } = useTranslation()
  return (
    <div className='flex items-center justify-center p-3 bg-accent/20 absolute w-full h-full left-0'>
      <div className='mx-12 flex flex-col items-center justify-center mb-3 gap-4 max-w-sm'>
        <div className='flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600'>
          <FaFileZipper size={30} />
        </div>
        <h1 className='text-center text-lg font-semibold'>{t('docView.formatZipTitre')}</h1>
        <p className='text-center text-sm text-muted-foreground'>{t('docView.formatZipMessage')}</p>
        {nomFichier && (
          <div className='flex items-center gap-2.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm'>
            <FaFileZipper size={15} className='text-amber-600 shrink-0' />
            <span className='flex-1 min-w-0 truncate font-medium'>{nomFichier}</span>
            {taille && <span className='shrink-0 text-xs text-muted-foreground'>{taille}</span>}
          </div>
        )}
        <a className='flex items-center gap-2 p-2.5 px-5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors' href={href}>
          <LuDownload size={15} />
          {t('docView.telecharger')}
        </a>
      </div>
    </div>
  )
}

export default FormatArchive
