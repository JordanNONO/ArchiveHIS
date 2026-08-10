import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LuStar, LuUser } from 'react-icons/lu'
import { getMesAuxiliaires } from '../api/routes/affectation'
import { getInitials } from '../utils/common'

/**
 * Carrousel d'auxiliaires à glisser (défilement horizontal avec accroche,
 * swipe tactile natif) pour "Qualité de la prestation" — chaque carte propose
 * une note en étoiles, avec un commentaire qui apparaît une fois notée.
 * `onChange(texteResume)` renvoie un résumé texte des notes déjà données, prêt
 * à être déposé comme message — pas de flux de soumission séparé, ça reste le
 * formulaire générique (EspaceDossier.jsx) qui envoie.
 */
function NotationAuxiliaires({ onChange }) {
  const [auxiliaires, setAuxiliaires] = useState([])
  const uneSeuleCarte = auxiliaires.length === 1
  const [chargement, setChargement] = useState(true)
  const [notes, setNotes] = useState({}) // { [id]: { note, commentaire } }
  const [carteActive, setCarteActive] = useState(0)
  const pisteRef = useRef(null)
  // Glissement géré explicitement au pointeur (souris ET tactile) plutôt que
  // de compter uniquement sur le défilement natif du navigateur — plus fiable
  // partout, et permet de tester au clic-glissé sur ordinateur aussi.
  const glisseRef = useRef({ actif: false, verrouille: false, depart: 0, departY: 0, scrollDepart: 0 })

  useEffect(() => {
    getMesAuxiliaires().then(async (res) => {
      if (res.status === 200) setAuxiliaires(await res.json())
    }).catch(() => {}).finally(() => setChargement(false))
  }, [])

  const resume = useMemo(() => {
    const lignes = auxiliaires
      .filter((a) => notes[a.id]?.note > 0)
      .map((a) => {
        const { note, commentaire } = notes[a.id]
        const etoiles = '★'.repeat(note) + '☆'.repeat(5 - note)
        return commentaire?.trim() ? `${etoiles} ${a.nom} — ${commentaire.trim()}` : `${etoiles} ${a.nom}`
      })
    return lignes.join('\n')
  }, [auxiliaires, notes])

  useEffect(() => { onChange(resume) }, [resume, onChange])

  function noter(id, note) {
    setNotes((prev) => ({ ...prev, [id]: { note, commentaire: prev[id]?.commentaire || '' } }))
  }

  function commenter(id, commentaire) {
    setNotes((prev) => ({ ...prev, [id]: { note: prev[id]?.note || 0, commentaire } }))
  }

  function onScrollPiste() {
    const piste = pisteRef.current
    if (!piste || !piste.firstChild) return
    const largeurCarte = piste.firstChild.offsetWidth + 12 // + gap
    setCarteActive(Math.round(piste.scrollLeft / largeurCarte))
  }

  function allerA(index) {
    const piste = pisteRef.current
    if (!piste || !piste.children[index]) return
    piste.children[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  function position(e) {
    return e.touches ? e.touches[0] : e
  }

  function onGlisseDebut(e) {
    const piste = pisteRef.current
    if (!piste) return
    const p = position(e)
    glisseRef.current = { actif: true, verrouille: false, depart: p.clientX, departY: p.clientY, scrollDepart: piste.scrollLeft }
  }

  function onGlisseDeplace(e) {
    const g = glisseRef.current
    const piste = pisteRef.current
    if (!g.actif || !piste) return
    const p = position(e)
    const dx = p.clientX - g.depart
    const dy = p.clientY - g.departY
    if (!g.verrouille) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      if (Math.abs(dy) > Math.abs(dx)) {
        g.actif = false // geste plutôt vertical : on laisse défiler la page
        return
      }
      g.verrouille = true
    }
    if (e.cancelable) e.preventDefault()
    piste.scrollLeft = g.scrollDepart - dx
  }

  function onGlisseFin() {
    glisseRef.current.actif = false
  }

  if (chargement) {
    return <div className='rounded-3xl border border-border bg-card p-5 shadow-sm text-sm text-muted-foreground'>Chargement de vos auxiliaires...</div>
  }

  if (auxiliaires.length === 0) {
    return (
      <div className='rounded-3xl border border-border bg-card p-5 shadow-sm text-sm text-muted-foreground'>
        Aucun auxiliaire n'est encore associé à votre suivi. Vous pouvez décrire votre remarque directement dans le message ci-dessous.
      </div>
    )
  }

  return (
    <div className='rounded-3xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3'>
      <div className='flex items-center gap-2.5'>
        <span className='w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0'>
          <LuStar size={15} className='fill-primary/20' />
        </span>
        <div>
          <h2 className='text-sm font-semibold'>Notez vos auxiliaires</h2>
          <p className='text-xs text-muted-foreground'>
            {uneSeuleCarte ? 'Touchez les étoiles pour noter.' : 'Faites glisser pour voir chacun, touchez les étoiles pour noter.'}
          </p>
        </div>
      </div>

      <div
        ref={pisteRef}
        onScroll={uneSeuleCarte ? undefined : onScrollPiste}
        onMouseDown={uneSeuleCarte ? undefined : onGlisseDebut}
        onMouseMove={uneSeuleCarte ? undefined : onGlisseDeplace}
        onMouseUp={uneSeuleCarte ? undefined : onGlisseFin}
        onMouseLeave={uneSeuleCarte ? undefined : onGlisseFin}
        onTouchStart={uneSeuleCarte ? undefined : onGlisseDebut}
        onTouchMove={uneSeuleCarte ? undefined : onGlisseDeplace}
        onTouchEnd={uneSeuleCarte ? undefined : onGlisseFin}
        // Le padding latéral (moitié de la largeur d'une carte) centre la
        // première carte au chargement, et chaque carte suivante se recentre
        // au glissement (snap-center). Avec un seul auxiliaire, il n'y a
        // rien à glisser vers — la carte est juste centrée normalement, sans
        // ce padding qui laisserait deviner (à tort) qu'il y a plus à voir.
        style={{ touchAction: 'pan-y' }}
        className={
          uneSeuleCarte
            ? 'flex justify-center'
            : 'flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scroll-smooth px-[11%] sm:px-[calc(50%-7.5rem)] cursor-grab active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        }
      >
        {auxiliaires.map((aux) => {
          const noteActuelle = notes[aux.id]?.note || 0
          return (
            <div
              key={aux.id}
              className={`shrink-0 rounded-2xl border border-border bg-gradient-to-b from-primary/5 to-transparent p-4 shadow-sm flex flex-col items-center gap-2.5 ${
                uneSeuleCarte ? 'w-full max-w-xs' : 'w-[78%] sm:w-60 snap-center'
              }`}
            >
              {aux.photo ? (
                <img src={aux.photo} alt={aux.nom} className='w-24 h-24 rounded-full object-cover border-2 border-black shadow-sm' />
              ) : (
                <div className='w-24 h-24 rounded-full bg-card text-foreground border-2 border-black shadow-sm flex items-center justify-center text-2xl font-semibold'>
                  {getInitials(aux.nom) || <LuUser size={32} />}
                </div>
              )}
              <div className='text-sm font-medium text-foreground text-center truncate w-full'>{aux.nom}</div>

              <div className='flex items-center gap-1'>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type='button'
                    onClick={() => noter(aux.id, n)}
                    className='p-0.5 transition-transform hover:scale-110 active:scale-95'
                    title={`${n} étoile${n > 1 ? 's' : ''}`}
                  >
                    <LuStar size={22} className={`transition-colors ${n <= noteActuelle ? 'fill-accent text-accent' : 'text-border'}`} />
                  </button>
                ))}
              </div>

              {noteActuelle > 0 && (
                <textarea
                  value={notes[aux.id]?.commentaire || ''}
                  onChange={(e) => commenter(aux.id, e.target.value)}
                  rows={2}
                  placeholder='Un commentaire ?'
                  className='w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30'
                />
              )}
            </div>
          )
        })}
      </div>

      {auxiliaires.length > 1 && (
        <div className='flex items-center justify-center gap-1.5'>
          {auxiliaires.map((aux, i) => (
            <button
              key={aux.id}
              type='button'
              onClick={() => allerA(i)}
              aria-label={`Voir ${aux.nom}`}
              className={`h-1.5 rounded-full transition-all ${i === carteActive ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default NotationAuxiliaires
