import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuX, LuLoader } from 'react-icons/lu';
import MenuDeroulant from './MenuDeroulant';
import { createAppareil, updateAppareil, createLigne, updateLigne } from '../api/routes/telephonie';

/**
 * Fenêtres d'ajout et de modification du parc téléphonique : un appareil, une
 * ligne SIM. Les deux servent aussi à compléter une fiche créée par la reprise
 * de l'existant (marquée « à compléter » tant que l'IMEI ou le forfait manque).
 */

export const ETATS_APPAREIL = ['en_stock', 'en_service', 'hors_service', 'reforme', 'perdu', 'vole'];
export const STATUTS_LIGNE = ['active', 'suspendue', 'resiliee'];
export const OPERATEURS = ['Orange', 'SFR', 'Bouygues Telecom', 'Free', 'B&You', 'Sosh', 'RED by SFR'];

export const classeChamp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';
export const classeLabel = 'text-xs font-semibold text-muted-foreground';

export function versChaine(v, estDate) {
    if (v === null || v === undefined) return '';
    return estDate ? String(v).slice(0, 10) : String(v);
}

/** '' → null, '289,90' → 289.9 : ce que le serveur attend. */
export function versNombre(v) {
    const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
    return s === '' ? null : Number(s);
}

export function versTexte(v) {
    const s = String(v ?? '').trim();
    return s === '' ? null : s;
}

/** Premier message d'erreur lisible d'une réponse Laravel (422, 409…). */
export async function messageErreur(res, t) {
    const corps = await res?.json().catch(() => null);
    const premiere = corps?.errors ? Object.values(corps.errors)[0]?.[0] : null;
    return corps?.error || premiere || corps?.message || t('commun.erreurGenerique');
}

export function Fenetre({ titre, sousTitre, envoi, onFerme, onEnregistre, children, largeur = 'max-w-xl' }) {
    const { t } = useTranslation();

    useEffect(() => {
        function echap(e) { if (e.key === 'Escape' && !envoi) onFerme(); }
        document.addEventListener('keydown', echap);
        return () => document.removeEventListener('keydown', echap);
    }, [envoi, onFerme]);

    return (
        <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
            <div className='absolute inset-0 bg-black/50' onClick={() => !envoi && onFerme()} />
            <form
                role='dialog'
                aria-modal='true'
                aria-label={titre}
                onSubmit={(e) => { e.preventDefault(); onEnregistre(); }}
                className={`relative w-full ${largeur} max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl`}
            >
                <div className='mb-4 flex items-start justify-between gap-3'>
                    <div>
                        <h3 className='text-base font-semibold text-foreground'>{titre}</h3>
                        {sousTitre && <p className='mt-0.5 text-xs text-muted-foreground'>{sousTitre}</p>}
                    </div>
                    <button type='button' onClick={onFerme} disabled={envoi} aria-label={t('commun.fermer')} className='flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted'>
                        <LuX size={16} />
                    </button>
                </div>

                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>{children}</div>

                <div className='mt-5 flex flex-wrap justify-end gap-2'>
                    <button type='button' onClick={onFerme} disabled={envoi} className='rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted'>{t('telephonie.annuler')}</button>
                    <button type='submit' disabled={envoi} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60'>
                        {envoi && <LuLoader size={14} className='animate-spin' />}
                        {t('telephonie.enregistrer')}
                    </button>
                </div>
            </form>
        </div>
    );
}

// --------------------------------------------------------------- Appareil

const APPAREIL_VIDE = { modele: '', imei: '', numero_serie: '', date_achat: '', prix_achat: '', etat: 'en_stock', observations: '' };

export function AppareilForm({ appareil, modelesConnus = [], onFerme, onEnregistre }) {
    const { t } = useTranslation();
    const [form, setForm] = useState(() => {
        if (!appareil) return APPAREIL_VIDE;
        const f = {};
        for (const cle of Object.keys(APPAREIL_VIDE)) f[cle] = versChaine(appareil[cle], cle === 'date_achat');
        return f;
    });
    const [erreurModele, setErreurModele] = useState(false);
    const [envoi, setEnvoi] = useState(false);
    const premierRef = useRef(null);

    useEffect(() => { premierRef.current?.focus(); }, []);

    const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

    async function enregistrer() {
        if (!form.modele.trim()) { setErreurModele(true); premierRef.current?.focus(); return; }

        const donnees = {
            modele: form.modele.trim(),
            imei: versTexte(form.imei.replace(/\s/g, '')),
            numero_serie: versTexte(form.numero_serie),
            date_achat: versTexte(form.date_achat),
            prix_achat: versNombre(form.prix_achat),
            etat: form.etat,
            observations: versTexte(form.observations),
        };

        setEnvoi(true);
        const res = await (appareil ? updateAppareil(appareil.id, donnees) : createAppareil(donnees)).catch(() => null);
        setEnvoi(false);

        if (res?.ok) {
            toast.success(appareil ? t('telephonie.appareilModifie') : t('telephonie.appareilAjoute'));
            onEnregistre();
            onFerme();
            return;
        }
        toast.error(await messageErreur(res, t));
    }

    return (
        <Fenetre
            titre={appareil ? t('telephonie.modifierAppareil') : t('telephonie.ajouterAppareil')}
            sousTitre={appareil?.fiche_a_completer ? t('telephonie.aideFicheACompleter') : null}
            envoi={envoi}
            onFerme={onFerme}
            onEnregistre={enregistrer}
        >
            <label className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.colModele')} *</span>
                <input
                    ref={premierRef}
                    list='telephonie-modeles'
                    value={form.modele}
                    onChange={(e) => { maj('modele', e.target.value); setErreurModele(false); }}
                    placeholder={t('telephonie.placeholderModele')}
                    className={`${classeChamp} ${erreurModele ? 'border-destructive' : ''}`}
                />
                <datalist id='telephonie-modeles'>
                    {modelesConnus.map((m) => <option key={m} value={m} />)}
                </datalist>
                {erreurModele && <span className='text-xs text-destructive'>{t('telephonie.erreurModele')}</span>}
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colImei')}</span>
                <input inputMode='numeric' value={form.imei} onChange={(e) => maj('imei', e.target.value)} className={`${classeChamp} tabular-nums`} placeholder={t('telephonie.placeholderImei')} />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.numeroSerie')}</span>
                <input value={form.numero_serie} onChange={(e) => maj('numero_serie', e.target.value)} className={classeChamp} />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colAchete')}</span>
                <input type='date' value={form.date_achat} onChange={(e) => maj('date_achat', e.target.value)} className={classeChamp} />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.prixAchat')}</span>
                <div className='relative'>
                    <input inputMode='decimal' value={form.prix_achat} onChange={(e) => maj('prix_achat', e.target.value.replace(/[^\d.,]/g, ''))} className={`${classeChamp} pr-8 tabular-nums`} placeholder='0,00' />
                    <span className='absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>€</span>
                </div>
            </label>

            <div className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.colEtat')}</span>
                <MenuDeroulant
                    value={form.etat}
                    onChange={(v) => maj('etat', v)}
                    options={ETATS_APPAREIL.map((e) => ({ value: e, label: t(`telephonie.etat_${e}`) }))}
                    boutonClassName='w-full'
                />
                {appareil?.detention_en_cours && (
                    <span className='text-xs text-muted-foreground'>{t('telephonie.aideEtatDetenu')}</span>
                )}
            </div>

            <label className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.observations')}</span>
                <textarea rows={2} value={form.observations} onChange={(e) => maj('observations', e.target.value)} className={`${classeChamp} resize-none`} />
            </label>
        </Fenetre>
    );
}

// ------------------------------------------------------------------ Ligne

const LIGNE_VIDE = {
    numero: '', operateur: '', forfait: '', cout_mensuel: '', iccid: '', code_pin: '', code_puk: '',
    date_souscription: '', engagement_jusquau: '', statut: 'active', observations: '',
};

export function LigneForm({ ligne, onFerme, onEnregistre }) {
    const { t } = useTranslation();
    const [form, setForm] = useState(() => {
        if (!ligne) return LIGNE_VIDE;
        const f = {};
        // Les codes ne sont jamais renvoyés dans la liste (voir codesLigne) :
        // en modification ils partent vides, et un champ laissé vide ne les
        // écrase pas.
        for (const cle of Object.keys(LIGNE_VIDE)) {
            f[cle] = cle.startsWith('code_') ? '' : versChaine(ligne[cle], cle === 'date_souscription' || cle === 'engagement_jusquau');
        }
        return f;
    });
    const [erreurs, setErreurs] = useState({});
    const [envoi, setEnvoi] = useState(false);
    const premierRef = useRef(null);

    useEffect(() => { premierRef.current?.focus(); }, []);

    function maj(champ, valeur) {
        setForm((f) => ({ ...f, [champ]: valeur }));
        if (erreurs[champ]) setErreurs((e) => ({ ...e, [champ]: false }));
    }

    async function enregistrer() {
        const manquants = {};
        if (!form.numero.trim()) manquants.numero = true;
        if (!form.operateur.trim()) manquants.operateur = true;
        if (Object.keys(manquants).length) { setErreurs(manquants); return; }

        const donnees = {
            numero: form.numero.trim(),
            operateur: form.operateur.trim(),
            forfait: versTexte(form.forfait),
            cout_mensuel: versNombre(form.cout_mensuel),
            iccid: versTexte(form.iccid.replace(/\s/g, '')),
            date_souscription: versTexte(form.date_souscription),
            engagement_jusquau: versTexte(form.engagement_jusquau),
            statut: form.statut,
            observations: versTexte(form.observations),
        };
        // En ajout les codes partent toujours (null s'ils sont vides) ; en
        // modification seulement s'ils ont été retapés.
        for (const code of ['code_pin', 'code_puk']) {
            const v = versTexte(form[code]);
            if (!ligne || v !== null) donnees[code] = v;
        }

        setEnvoi(true);
        const res = await (ligne ? updateLigne(ligne.id, donnees) : createLigne(donnees)).catch(() => null);
        setEnvoi(false);

        if (res?.ok) {
            toast.success(ligne ? t('telephonie.ligneModifiee') : t('telephonie.ligneAjoutee'));
            onEnregistre();
            onFerme();
            return;
        }
        toast.error(await messageErreur(res, t));
    }

    return (
        <Fenetre
            titre={ligne ? t('telephonie.modifierLigne') : t('telephonie.ajouterLigne')}
            sousTitre={ligne?.fiche_a_completer ? t('telephonie.aideFicheACompleter') : null}
            envoi={envoi}
            onFerme={onFerme}
            onEnregistre={enregistrer}
        >
            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colNumero')} *</span>
                <input ref={premierRef} type='tel' value={form.numero} onChange={(e) => maj('numero', e.target.value)} placeholder='06 12 34 56 78' className={`${classeChamp} tabular-nums ${erreurs.numero ? 'border-destructive' : ''}`} />
                {erreurs.numero && <span className='text-xs text-destructive'>{t('telephonie.erreurNumero')}</span>}
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colOperateur')} *</span>
                <input list='telephonie-operateurs' value={form.operateur} onChange={(e) => maj('operateur', e.target.value)} placeholder={t('telephonie.placeholderChoisirOuSaisir')} className={`${classeChamp} ${erreurs.operateur ? 'border-destructive' : ''}`} />
                <datalist id='telephonie-operateurs'>
                    {OPERATEURS.map((o) => <option key={o} value={o} />)}
                </datalist>
                {erreurs.operateur && <span className='text-xs text-destructive'>{t('telephonie.erreurOperateur')}</span>}
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colForfait')}</span>
                <input value={form.forfait} onChange={(e) => maj('forfait', e.target.value)} placeholder={t('telephonie.placeholderForfait')} className={classeChamp} />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.coutMensuel')}</span>
                <div className='relative'>
                    <input inputMode='decimal' value={form.cout_mensuel} onChange={(e) => maj('cout_mensuel', e.target.value.replace(/[^\d.,]/g, ''))} className={`${classeChamp} pr-8 tabular-nums`} placeholder='0,00' />
                    <span className='absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>€</span>
                </div>
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.dateSouscription')}</span>
                <input type='date' value={form.date_souscription} onChange={(e) => maj('date_souscription', e.target.value)} className={classeChamp} />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.engagementJusquau')}</span>
                <input type='date' value={form.engagement_jusquau} onChange={(e) => maj('engagement_jusquau', e.target.value)} className={classeChamp} />
            </label>

            <label className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.iccid')}</span>
                <input inputMode='numeric' value={form.iccid} onChange={(e) => maj('iccid', e.target.value)} className={`${classeChamp} tabular-nums`} />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.codePin')}</span>
                <input inputMode='numeric' autoComplete='off' value={form.code_pin} onChange={(e) => maj('code_pin', e.target.value)} placeholder={ligne?.a_des_codes ? t('telephonie.placeholderCodeInchange') : ''} className={`${classeChamp} tabular-nums`} />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.codePuk')}</span>
                <input inputMode='numeric' autoComplete='off' value={form.code_puk} onChange={(e) => maj('code_puk', e.target.value)} placeholder={ligne?.a_des_codes ? t('telephonie.placeholderCodeInchange') : ''} className={`${classeChamp} tabular-nums`} />
            </label>
            <p className='-mt-1 text-xs text-muted-foreground sm:col-span-2'>{t('telephonie.aideCodes')}</p>

            <div className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.statut')}</span>
                <MenuDeroulant
                    value={form.statut}
                    onChange={(v) => maj('statut', v)}
                    options={STATUTS_LIGNE.map((s) => ({ value: s, label: t(`telephonie.statut_${s}`) }))}
                    boutonClassName='w-full'
                />
            </div>

            <label className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.observations')}</span>
                <textarea rows={2} value={form.observations} onChange={(e) => maj('observations', e.target.value)} className={`${classeChamp} resize-none`} />
            </label>
        </Fenetre>
    );
}
