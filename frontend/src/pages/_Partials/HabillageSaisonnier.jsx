import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { LuLoader } from 'react-icons/lu'
import { getHabillageSaisonnier, majHabillageSaisonnier } from '../../api/routes/parametre'
import { oublierHabillageEnCache } from '../../components/LogoSaisonnier'
import { SAISONS, saisonActive, dimanchePaques } from '../../utils/saisons'
import { HABILLAGES } from '../../components/HabillagesSaisonniers'
import MenuDeroulant from '../../components/MenuDeroulant'
import hisLogo from '../../assets/his-badge.png'

/**
 * Réglage de l'habillage saisonnier du logo — onglet réservé au Super
 * Administrateur (voir Settings.jsx et ParametreApplicationController, qui
 * refuse l'écriture à tout autre rôle : masquer l'onglet ne suffirait pas).
 *
 * L'aperçu de chaque fête est affiché ici : c'est le seul endroit où on peut
 * voir un habillage hors de sa période sans attendre un an.
 */
function HabillageSaisonnier() {
    const { t, i18n } = useTranslation()
    const [reglage, setReglage] = useState(null)
    const [envoi, setEnvoi] = useState(false)

    useEffect(() => {
        getHabillageSaisonnier()
            .then(async (res) => (res.status === 200 ? res.json() : null))
            .then((valeur) => setReglage(valeur || { actif: false, forcer: null }))
            .catch(() => setReglage({ actif: false, forcer: null }))
    }, [])

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
        // Le menu relit le réglage au prochain rendu de page.
        oublierHabillageEnCache()
        toast.success(t('habillage.enregistre'))
    }

    if (!reglage) {
        return <div className='flex justify-center py-16'><LuLoader size={22} className='animate-spin text-muted-foreground' /></div>
    }

    const courante = reglage.actif ? saisonActive(new Date(), reglage.forcer) : null

    return (
        <div className='flex flex-col gap-5'>
            <div>
                <h3 className='text-lg font-semibold text-foreground'>{t('habillage.titre')}</h3>
                <p className='text-sm text-muted-foreground mt-1 max-w-2xl'>{t('habillage.description')}</p>
            </div>

            <label className='flex items-center gap-3 rounded-xl border border-border bg-card p-4'>
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
                        {courante ? t('habillage.enCours', { fete: t(`habillage.fete_${courante.cle}`) }) : t('habillage.horsPeriode')}
                    </span>
                </span>
            </label>

            <label className='flex flex-col gap-1.5 sm:max-w-sm'>
                <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>{t('habillage.forcer')}</span>
                <MenuDeroulant
                    value={reglage.forcer || ''}
                    disabled={envoi || !reglage.actif}
                    onChange={(valeur) => enregistrer({ forcer: valeur || null })}
                    options={[
                        { value: '', label: t('habillage.suivreCalendrier') },
                        ...SAISONS.map((s) => ({ value: s.cle, label: t(`habillage.fete_${s.cle}`) })),
                    ]}
                />
                <span className='text-xs text-muted-foreground'>{t('habillage.forcerAide')}</span>
            </label>

            <div>
                <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5'>{t('habillage.apercus')}</p>
                <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
                    {SAISONS.map((saison) => {
                        const Habillage = HABILLAGES[saison.cle]
                        return (
                            <div key={saison.cle} className='flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3'>
                                <div className='relative w-16 h-16 rounded-full bg-white shadow-sm'>
                                    <img src={hisLogo} alt='' className='w-full h-full object-cover rounded-full' />
                                    {Habillage && <Habillage />}
                                </div>
                                <span className='text-xs font-semibold text-foreground text-center'>{t(`habillage.fete_${saison.cle}`)}</span>
                                <span className='text-[11px] text-muted-foreground text-center'>
                                    {saison.mobile === 'paques'
                                        ? dimanchePaques(new Date().getFullYear()).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' })
                                        : t('habillage.periode', { debut: saison.debut.replace('-', '/'), fin: saison.fin.replace('-', '/') })}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <p className='text-xs text-muted-foreground max-w-2xl'>{t('habillage.notePdf')}</p>
        </div>
    )
}

export default HabillageSaisonnier
