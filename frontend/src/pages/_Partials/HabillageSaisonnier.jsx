import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { LuLoader, LuRotateCcw } from 'react-icons/lu'
import { getHabillageSaisonnier, majHabillageSaisonnier } from '../../api/routes/parametre'
import { oublierHabillageEnCache } from '../../components/LogoSaisonnier'
import BadgeSaisonnier from '../../components/saison/BadgeSaisonnier'
import { DECORS } from '../../components/saison/decors'
import { ORDRE_SAISONS, etatSaison, saisonActive } from '../../utils/saisons'

/**
 * Réglage de l'habillage saisonnier du logo — onglet réservé au Super
 * Administrateur (voir Settings.jsx et ParametreApplicationController, qui
 * refuse l'écriture à tout autre rôle : masquer l'onglet ne suffirait pas).
 *
 * La page montre le décor en grand, puis tel qu'il apparaîtra dans le menu :
 * un décor se juge à 80 px dans une barre latérale, pas en vignette.
 */

/** Fond de scène teinté par fête — voir DECORS[cle].teinte. */
function styleNuit(cle) {
    const [t1, t2] = DECORS[cle]?.teinte || ['#1a3a66', '#0a1530']
    return { '--t1': t1, '--t2': t2 }
}

function HabillageSaisonnier() {
    const { t, i18n } = useTranslation()
    const [reglage, setReglage] = useState(null)
    const [envoi, setEnvoi] = useState(false)
    const [choisie, setChoisie] = useState(null)
    // Remonter ce compteur remonte la clé du badge : React le démonte et le
    // remonte, donc les animations d'entrée rejouent depuis le début.
    const [rejeu, setRejeu] = useState(0)

    useEffect(() => {
        getHabillageSaisonnier()
            .then(async (res) => (res.status === 200 ? res.json() : null))
            .then((valeur) => setReglage(valeur || { actif: false, forcer: null }))
            .catch(() => setReglage({ actif: false, forcer: null }))
    }, [])

    // Les fêtes dans l'ordre de leur PROCHAINE occurrence, pas de l'année
    // civile : ce qui arrive bientôt doit se lire en haut.
    const parDate = useMemo(() => {
        const etats = Object.fromEntries(ORDRE_SAISONS.map((cle) => [cle, etatSaison(cle)]))
        const tri = [...ORDRE_SAISONS].sort((a, b) => etats[a].debut - etats[b].debut)
        return { etats, tri }
    }, [])

    useEffect(() => {
        if (choisie) return
        setChoisie(parDate.tri.find((cle) => parDate.etats[cle].enCours) || parDate.tri[0])
    }, [choisie, parDate])

    async function enregistrer(modif) {
        const suite = { ...reglage, ...modif }
        setReglage(suite)
        setEnvoi(true)
        const res = await majHabillageSaisonnier(suite).catch(() => null)
        setEnvoi(false)

        if (!res || res.status !== 200) {
            const corps = await res?.json().catch(() => ({})) ?? {}
            toast.error(corps.error || t('habillage.echec'))
            return
        }
        oublierHabillageEnCache()
        toast.success(t('habillage.enregistre'))
    }

    if (!reglage || !choisie) {
        return <div className='flex justify-center py-16'><LuLoader size={22} className='animate-spin text-muted-foreground' /></div>
    }

    const formatJour = (d) => d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
    const plage = (e) => (+e.debut === +e.fin ? formatJour(e.debut) : `${formatJour(e.debut)} – ${formatJour(e.fin)}`)
    const etatChoisi = parDate.etats[choisie]
    const affichee = reglage.actif ? saisonActive(new Date(), reglage.forcer) : null

    return (
        <div className='flex flex-col gap-6'>
            <div>
                <h3 className='text-lg font-semibold text-foreground'>{t('habillage.titre')}</h3>
                <p className='text-sm text-muted-foreground mt-1 max-w-3xl'>{t('habillage.description')}</p>
            </div>

            {/* ---- réglages ---- */}
            <div className='flex flex-col sm:flex-row sm:items-stretch gap-3'>
                <label className='flex items-center gap-3 rounded-xl border border-border bg-card p-4 flex-1'>
                    <input
                        type='checkbox'
                        checked={!!reglage.actif}
                        disabled={envoi}
                        onChange={(e) => enregistrer({ actif: e.target.checked })}
                        className='w-4 h-4 accent-primary'
                    />
                    <span className='flex-1 min-w-0'>
                        <span className='block text-sm font-semibold text-foreground'>{t('habillage.actifTitre')}</span>
                        <span className='block text-xs text-muted-foreground'>
                            {affichee ? t('habillage.enCours', { fete: t(`habillage.fete_${affichee}`) }) : t('habillage.horsPeriode')}
                        </span>
                    </span>
                </label>

                <div className='rounded-xl border border-border bg-card p-4 flex-1'>
                    <span className='block text-sm font-semibold text-foreground mb-1'>{t('habillage.forcer')}</span>
                    <div className='flex items-center gap-2'>
                        <button
                            type='button'
                            disabled={envoi || !reglage.actif || !reglage.forcer}
                            onClick={() => enregistrer({ forcer: null })}
                            className='rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 transition-colors'
                        >
                            {t('habillage.suivreCalendrier')}
                        </button>
                        <button
                            type='button'
                            disabled={envoi || !reglage.actif}
                            onClick={() => enregistrer({ forcer: choisie })}
                            className='rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-40 transition-colors'
                        >
                            {t('habillage.forcerCelle', { fete: t(`habillage.fete_${choisie}`) })}
                        </button>
                    </div>
                    <span className='block text-xs text-muted-foreground mt-1.5'>{t('habillage.forcerAide')}</span>
                </div>
            </div>

            {/* ---- la scène + le menu en situation ---- */}
            <div className='grid lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start'>
                <div className='hs-nuit relative rounded-2xl p-6 text-white overflow-hidden min-h-[420px] flex flex-col gap-3' style={styleNuit(choisie)}>
                    <div>
                        <span className='block text-[11px] font-semibold uppercase tracking-wider text-white/70 tabular-nums'>
                            {etatChoisi.enCours
                                ? t('habillage.sceneEnCours', { plage: plage(etatChoisi) })
                                : t('habillage.sceneDans', { plage: plage(etatChoisi), jours: etatChoisi.jours })}
                        </span>
                        <h4 className='text-2xl font-semibold mt-0.5'>{t(`habillage.fete_${choisie}`)}</h4>
                        <p className='text-sm text-white/75 mt-0.5'>{t(`habillage.sous_${choisie}`)}</p>
                    </div>

                    <div className='flex-1 grid place-items-center py-2'>
                        <div className='relative w-[300px] max-w-full aspect-square'>
                            <BadgeSaisonnier key={`${choisie}-${rejeu}`} cle={choisie} />
                        </div>
                    </div>

                    <button
                        type='button'
                        onClick={() => setRejeu((n) => n + 1)}
                        className='self-start inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition-colors'
                    >
                        <LuRotateCcw size={14} /> {t('habillage.rejouer')}
                    </button>
                </div>

                <div className='flex flex-col gap-4'>
                    <div className='hs-nuit rounded-2xl p-4 text-white text-center' style={styleNuit(choisie)}>
                        <span className='block text-[10px] font-semibold uppercase tracking-wider text-white/55 mb-1'>{t('habillage.enSituation')}</span>
                        <div className='relative w-[150px] aspect-square mx-auto'>
                            <BadgeSaisonnier key={`mini-${choisie}-${rejeu}`} cle={choisie} />
                        </div>
                        <strong className='block text-sm font-semibold mt-1'>{t('commun.entreprise')}</strong>
                        <em className='block text-[11px] text-white/60 not-italic'>{t('commun.slogan', { defaultValue: "L'unité sur le chemin de la sérénité" })}</em>
                        <ul className='mt-3 pt-3 border-t border-white/10 text-left text-[13px] flex flex-col gap-0.5'>
                            <li className='rounded-md bg-white/10 px-2.5 py-1.5'>{t('sidebar.tableauDeBord')}</li>
                            <li className='rounded-md px-2.5 py-1.5 text-white/60'>{t('sidebar.documents')}</li>
                            <li className='rounded-md px-2.5 py-1.5 text-white/60'>{t('sidebar.fluctuationRh')}</li>
                        </ul>
                    </div>

                    <div className='rounded-2xl border border-border bg-card p-4'>
                        <h5 className='text-sm font-semibold text-foreground mb-2'>{t('habillage.calendrier')}</h5>
                        <ol className='flex flex-col max-h-[300px] overflow-y-auto pr-1'>
                            {parDate.tri.map((cle) => {
                                const e = parDate.etats[cle]
                                return (
                                    <li key={cle} className='flex items-center gap-2 border-t border-border first:border-t-0 py-2 text-[13px]'>
                                        <span className='flex-1 min-w-0 truncate'>{t(`habillage.fete_${cle}`)}</span>
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${e.enCours ? 'bg-green-600 text-white' : 'bg-primary/10 text-primary'}`}>
                                            {e.enCours ? t('habillage.badgeEnCours') : t('habillage.badgeDans', { jours: e.jours })}
                                        </span>
                                        <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>{plage(e)}</span>
                                    </li>
                                )
                            })}
                        </ol>
                    </div>
                </div>
            </div>

            {/* ---- la galerie des douze ---- */}
            <div>
                <h4 className='text-base font-semibold text-foreground'>{t('habillage.lesDouze')}</h4>
                <p className='text-sm text-muted-foreground mt-0.5 mb-3'>{t('habillage.lesDouzeAide')}</p>
                <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3'>
                    {ORDRE_SAISONS.map((cle) => {
                        const e = parDate.etats[cle]
                        const actif = cle === choisie
                        return (
                            <button
                                key={cle}
                                type='button'
                                onClick={() => setChoisie(cle)}
                                aria-pressed={actif}
                                className={`rounded-xl border bg-card p-2 text-left transition-transform hover:-translate-y-0.5 ${actif ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
                            >
                                <div className='hs-nuit relative rounded-lg aspect-square grid place-items-center overflow-hidden mb-2' style={styleNuit(cle)}>
                                    <div className='relative w-[78%] aspect-square'>
                                        <BadgeSaisonnier cle={cle} />
                                    </div>
                                </div>
                                <span className='block text-sm font-semibold text-foreground px-1 truncate'>{t(`habillage.fete_${cle}`)}</span>
                                <span className='block text-xs text-muted-foreground px-1 tabular-nums'>{plage(e)}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            <p className='text-xs text-muted-foreground max-w-3xl'>{t('habillage.notePdf')}</p>
        </div>
    )
}

export default HabillageSaisonnier
