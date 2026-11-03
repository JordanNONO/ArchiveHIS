import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LuCheck, LuChevronLeft, LuChevronRight, LuCrop, LuLoader2, LuPlus, LuRotateCw, LuTrash2, LuX } from 'react-icons/lu'
import { FILTRES } from '../../utils/scannerEngine'

const SEUIL_BALAYAGE_PX = 50

/**
 * Vérification des pages avant l'envoi : une page à la fois en grand (balayage
 * ou flèches pour passer de l'une à l'autre), bande de miniatures, et pour la
 * page affichée : rognage, rotation, filtre, déplacement et suppression.
 */
function RevuePages({ pages, index, onIndex, onRogner, onPivoter, onFiltre, onSupprimer, onDeplacer, onAjouter, onValider, onFermer }) {
  const { t } = useTranslation()
  const toucheRef = useRef(null)
  const bandeRef = useRef(null)
  const page = pages[index]
  const total = pages.length

  // Garde la miniature de la page affichée visible dans la bande.
  useEffect(() => {
    bandeRef.current?.children[index]?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [index])

  function onTouchStart(e) {
    toucheRef.current = e.touches.length === 1 ? e.touches[0].clientX : null
  }

  function onTouchEnd(e) {
    if (toucheRef.current === null) return
    const delta = e.changedTouches[0].clientX - toucheRef.current
    toucheRef.current = null
    if (delta < -SEUIL_BALAYAGE_PX && index < total - 1) onIndex(index + 1)
    else if (delta > SEUIL_BALAYAGE_PX && index > 0) onIndex(index - 1)
  }

  const boutonOutil = 'flex flex-col items-center justify-center gap-1 min-w-[60px] h-14 rounded-xl text-[11px] font-medium text-white/90 hover:bg-white/10 disabled:opacity-35'

  return (
    <div className='absolute inset-0 flex flex-col bg-neutral-950 text-white'>
      <div className='flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 shrink-0'>
        <button type='button' onClick={onFermer} className='w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10' title={t('scanner.fermer')} aria-label={t('scanner.fermer')}>
          <LuX size={22} />
        </button>
        <span className='text-sm font-semibold'>
          {page ? t('scanner.revue.titre', { numero: index + 1, total }) : t('scanner.titre')}
        </span>
        <span className='w-11' />
      </div>

      {/* Page affichée */}
      <div className='relative flex-1 min-h-0 flex items-center justify-center px-4 py-2' onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {page ? (
          <>
            <img src={page.url} alt={t('scanner.revue.titre', { numero: index + 1, total })} className='max-w-full max-h-full object-contain rounded-sm shadow-2xl bg-white' />
            {page.enRendu && (
              <span className='absolute inset-0 flex items-center justify-center bg-black/30'>
                <LuLoader2 size={28} className='animate-spin' />
              </span>
            )}
            {index > 0 && (
              <button type='button' onClick={() => onIndex(index - 1)} className='hidden sm:flex absolute left-3 w-10 h-10 rounded-full bg-black/50 items-center justify-center' aria-label={t('scanner.revue.titre', { numero: index, total })}>
                <LuChevronLeft size={20} />
              </button>
            )}
            {index < total - 1 && (
              <button type='button' onClick={() => onIndex(index + 1)} className='hidden sm:flex absolute right-3 w-10 h-10 rounded-full bg-black/50 items-center justify-center' aria-label={t('scanner.revue.titre', { numero: index + 2, total })}>
                <LuChevronRight size={20} />
              </button>
            )}
          </>
        ) : (
          <p className='text-sm text-white/70'>{t('scanner.revue.aucunePage')}</p>
        )}
      </div>

      {/* Filtres de la page affichée */}
      {page && (
        <div className='shrink-0 flex justify-center px-4 pt-2'>
          <div className='inline-flex p-1 rounded-full bg-white/10' role='radiogroup'>
            {FILTRES.map((filtre) => (
              <button
                key={filtre}
                type='button'
                role='radio'
                aria-checked={page.filtre === filtre}
                onClick={() => page.filtre !== filtre && onFiltre(page.id, filtre)}
                className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-colors ${page.filtre === filtre ? 'bg-white text-black' : 'text-white/80'}`}
              >
                {t(`scanner.filtres.${filtre}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Miniatures */}
      <div ref={bandeRef} className='shrink-0 flex gap-2 overflow-x-auto px-4 py-3'>
        {pages.map((p, i) => (
          <button
            key={p.id}
            type='button'
            onClick={() => onIndex(i)}
            className={`relative shrink-0 w-12 h-16 rounded-md overflow-hidden border-2 transition-colors ${i === index ? 'border-primary' : 'border-transparent opacity-70'}`}
          >
            <img src={p.miniature} alt='' className='w-full h-full object-cover bg-white' />
            <span className='absolute bottom-0 inset-x-0 text-[10px] font-semibold bg-black/60'>{i + 1}</span>
          </button>
        ))}
        <button
          type='button'
          onClick={onAjouter}
          className='shrink-0 w-12 h-16 rounded-md border-2 border-dashed border-white/40 flex items-center justify-center text-white/80'
          title={t('scanner.revue.ajouterPage')}
          aria-label={t('scanner.revue.ajouterPage')}
        >
          <LuPlus size={20} />
        </button>
      </div>

      {/* Outils de la page affichée */}
      {page && (
        <div className='shrink-0 flex items-center justify-around px-2 border-t border-white/10 pt-1'>
          <button type='button' className={boutonOutil} onClick={() => onDeplacer(page.id, -1)} disabled={index === 0}>
            <LuChevronLeft size={20} /> {t('scanner.revue.deplacerAvant')}
          </button>
          <button type='button' className={boutonOutil} onClick={() => onRogner(page.id)} disabled={page.enRendu}>
            <LuCrop size={20} /> {t('scanner.revue.rogner')}
          </button>
          <button type='button' className={boutonOutil} onClick={() => onPivoter(page.id)}>
            <LuRotateCw size={20} /> {t('scanner.revue.pivoter')}
          </button>
          <button type='button' className={`${boutonOutil} text-red-400`} onClick={() => onSupprimer(page.id)}>
            <LuTrash2 size={20} /> {t('scanner.revue.supprimer')}
          </button>
          <button type='button' className={boutonOutil} onClick={() => onDeplacer(page.id, 1)} disabled={index === total - 1}>
            <LuChevronRight size={20} /> {t('scanner.revue.deplacerApres')}
          </button>
        </div>
      )}

      <div className='shrink-0 grid grid-cols-2 gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]'>
        <button type='button' onClick={onAjouter} className='h-12 rounded-xl bg-white/10 text-sm font-medium flex items-center justify-center gap-1.5'>
          <LuPlus size={16} /> {t('scanner.revue.ajouterPage')}
        </button>
        <button
          type='button'
          onClick={onValider}
          disabled={total === 0 || pages.some((p) => p.enRendu)}
          className='h-12 rounded-xl bg-primary text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50'
        >
          <LuCheck size={16} /> {t('scanner.revue.valider', { count: total })}
        </button>
      </div>
    </div>
  )
}

export default RevuePages
