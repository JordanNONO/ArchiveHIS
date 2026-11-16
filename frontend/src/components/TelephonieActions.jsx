import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import SelectRecherchable from './SelectRecherchable';
import MenuDeroulant from './MenuDeroulant';
import { Fenetre, classeChamp, classeLabel, versTexte, versNombre, messageErreur } from './TelephonieForms';
import { createRemise, cloturerDetention, createIncident, updateIncident, getSalariesTelephonie } from '../api/routes/telephonie';

/**
 * Les trois actions qui manquaient à l'ouverture du module (16/11/2026) :
 * confier du matériel à quelqu'un, le lui reprendre (restitution ou
 * transfert à un autre salarié), et déclarer un incident. AppareilForm et
 * LigneForm (voir TelephonieForms.jsx) ne couvrent que l'inventaire lui-même,
 * pas qui détient quoi.
 */

const ETATS_MATERIEL = ['neuf', 'bon', 'usage'];
const MOTIFS_FIN = ['restitution', 'transfert', 'incident', 'fin_contrat'];
const NATURES_INCIDENT = ['perte', 'casse', 'vol', 'depassement_forfait', 'autre'];
const SUITES_INCIDENT = ['a_decider', 'prise_en_charge', 'retenue_salaire', 'assurance', 'sans_suite'];

/**
 * La valeur d'un salarié dans les menus ci-dessous encode les deux cas que
 * l'API distingue (voir TelephonieController::universSalaries()) :
 *   - 'p:12'       → une vraie fiche, personnel_id = 12
 *   - 'n:KAMENI…'  → un nom connu seulement de la Fluctuation RH, aucune
 *                    fiche (intervenant qui ne s'est jamais connecté)
 * Nécessaire parce qu'un intervenant à domicile n'a souvent AUCUN compte
 * applicatif — exiger un personnel_id l'aurait rendu impossible à choisir
 * ici, alors qu'il apparaît déjà dans les absences/entrées de la Fluctuation
 * RH (demande explicite 2026-11-16).
 */
function encoderSalarie(s) {
    return s.personnel_id ? `p:${s.personnel_id}` : `n:${s.nom}`;
}

/** Décode une valeur de menu en { personnel_id, salarie_nom } pour l'API. */
function decoderSalarie(valeur) {
    if (!valeur) return { personnel_id: null, salarie_nom: null };
    if (valeur.startsWith('p:')) return { personnel_id: Number(valeur.slice(2)), salarie_nom: null };
    return { personnel_id: null, salarie_nom: valeur.slice(2) };
}

/** Charge l'univers des salariés une seule fois, partagé par les trois formulaires. */
function useSalarieOptions() {
    const [salaries, setSalaries] = useState([]);
    useEffect(() => {
        getSalariesTelephonie()
            .then((res) => (res.status === 200 ? res.json() : []))
            .then((liste) => setSalaries(Array.isArray(liste) ? liste : []))
            .catch(() => {});
    }, []);
    return useMemo(
        () => salaries.map((s) => ({ value: encoderSalarie(s), label: s.nom })),
        [salaries],
    );
}

// ------------------------------------------------------------------ Remise

/**
 * Confier un appareil et/ou une ligne à un salarié — « Remettre un
 * téléphone » de la vue d'ensemble. Au moins un des deux est requis (voir
 * TelephonieController::storeRemise), mais jamais les deux imposés : une
 * ligne peut être remise seule (SIM dans un appareil personnel), un appareil
 * seul (téléphone sans abonnement dédié).
 */
export function RemiseForm({ appareilsDisponibles = [], lignesDisponibles = [], appareilPresele, lignePreselectionnee, onFerme, onEnregistre }) {
    const { t } = useTranslation();
    const optionsSalarie = useSalarieOptions();
    const [salarieValue, setSalarieValue] = useState('');
    const [appareilId, setAppareilId] = useState(appareilPresele?.id ? String(appareilPresele.id) : '');
    const [ligneId, setLigneId] = useState(lignePreselectionnee?.id ? String(lignePreselectionnee.id) : '');
    const [dateRemise, setDateRemise] = useState(() => new Date().toISOString().slice(0, 10));
    const [etatRemise, setEtatRemise] = useState('bon');
    const [avecChargeur, setAvecChargeur] = useState(true);
    const [avecCoque, setAvecCoque] = useState(false);
    const [observations, setObservations] = useState('');
    const [decharge, setDecharge] = useState(true);
    const [erreur, setErreur] = useState('');
    const [envoi, setEnvoi] = useState(false);

    const optionsAppareil = useMemo(
        () => [{ value: '', label: t('telephonie.aucunAppareilChoix') }, ...appareilsDisponibles.map((a) => ({
            value: String(a.id), label: `${a.modele}${a.imei ? ` — ${a.imei}` : ''}`,
        }))],
        [appareilsDisponibles, t],
    );
    const optionsLigne = useMemo(
        () => [{ value: '', label: t('telephonie.aucuneLigneChoix') }, ...lignesDisponibles.map((l) => ({
            value: String(l.id), label: `${l.numero} — ${l.operateur}`,
        }))],
        [lignesDisponibles, t],
    );

    async function enregistrer() {
        if (!salarieValue) { setErreur(t('telephonie.erreurSalarieRequis')); return; }
        if (!appareilId && !ligneId) { setErreur(t('telephonie.erreurAuMoinsUnObjet')); return; }
        setErreur('');

        const donnees = {
            ...decoderSalarie(salarieValue),
            appareil_id: appareilId ? Number(appareilId) : null,
            ligne_id: ligneId ? Number(ligneId) : null,
            date_remise: dateRemise,
            etat_remise: etatRemise,
            avec_chargeur: avecChargeur,
            avec_coque: avecCoque,
            observations: versTexte(observations),
            decharge,
        };

        setEnvoi(true);
        const res = await createRemise(donnees).catch(() => null);
        setEnvoi(false);

        if (res?.ok) {
            toast.success(decharge ? t('telephonie.remiseEnregistreeADecharger') : t('telephonie.remiseEnregistree'));
            onEnregistre();
            onFerme();
            return;
        }
        toast.error(await messageErreur(res, t));
    }

    return (
        <Fenetre titre={t('telephonie.remettreTitre')} sousTitre={t('telephonie.remettreSousTitre')} envoi={envoi} onFerme={onFerme} onEnregistre={enregistrer}>
            <label className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.colSalarie')} *</span>
                <SelectRecherchable options={optionsSalarie} value={salarieValue} onChange={setSalarieValue} placeholder={t('telephonie.placeholderChoisirSalarie')} required />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.appareilAConfier')}</span>
                <SelectRecherchable options={optionsAppareil} value={appareilId} onChange={setAppareilId} disabled={!!appareilPresele} />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.ligneAConfier')}</span>
                <SelectRecherchable options={optionsLigne} value={ligneId} onChange={setLigneId} disabled={!!lignePreselectionnee} />
            </label>

            {erreur && <p className='text-xs text-destructive sm:col-span-2'>{erreur}</p>}

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colDepuis')} *</span>
                <input type='date' value={dateRemise} onChange={(e) => setDateRemise(e.target.value)} className={classeChamp} />
            </label>

            <div className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.etatConstate')}</span>
                <MenuDeroulant value={etatRemise} onChange={setEtatRemise} options={ETATS_MATERIEL.map((e) => ({ value: e, label: t(`telephonie.etatMateriel_${e}`) }))} boutonClassName='w-full' />
            </div>

            <fieldset className='flex flex-col gap-2 sm:col-span-2'>
                <legend className={classeLabel}>{t('telephonie.remisAvec')}</legend>
                <div className='flex flex-wrap gap-x-6 gap-y-2'>
                    <label className='inline-flex min-h-[36px] items-center gap-2 text-sm text-foreground'>
                        <input type='checkbox' checked={avecChargeur} onChange={(e) => setAvecChargeur(e.target.checked)} className='h-[17px] w-[17px] accent-primary' />
                        {t('telephonie.chargeur')}
                    </label>
                    <label className='inline-flex min-h-[36px] items-center gap-2 text-sm text-foreground'>
                        <input type='checkbox' checked={avecCoque} onChange={(e) => setAvecCoque(e.target.checked)} className='h-[17px] w-[17px] accent-primary' />
                        {t('telephonie.coque')}
                    </label>
                </div>
            </fieldset>

            <label className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.observations')}</span>
                <textarea rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} className={`${classeChamp} resize-none`} placeholder={t('telephonie.placeholderObservationsRemise')} />
            </label>

            <div className='rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2'>
                <label className='flex items-start gap-2.5 text-sm text-foreground'>
                    <input type='checkbox' checked={decharge} onChange={(e) => setDecharge(e.target.checked)} className='mt-0.5 h-[17px] w-[17px] accent-primary' />
                    <span>
                        <span className='font-medium'>{t('telephonie.genererDecharge')}</span>
                        <span className='mt-0.5 block text-xs text-muted-foreground'>{t('telephonie.aideDecharge')}</span>
                    </span>
                </label>
            </div>
        </Fenetre>
    );
}

// ------------------------------------------------------------- Clôture

/**
 * Reprendre un appareil ou une ligne : restitution (retour au stock),
 * transfert direct à un autre salarié, ou conséquence d'un incident/départ.
 * Un transfert enchaîne sur une nouvelle détention côté serveur, sans que le
 * matériel ne repasse par le stock (voir TelephonieController::cloturerDetention).
 */
export function ClotureDetentionForm({ detention, onFerme, onEnregistre }) {
    const { t } = useTranslation();
    const optionsSalarie = useSalarieOptions();
    const objet = detention.appareil ? detention.appareil.modele : detention.ligne?.numero;
    const estAppareil = !!detention.appareil;
    const detenteurActuel = detention.personnel ? `${detention.personnel.nom} ${detention.personnel.prenom}`.trim() : detention.salarie_nom;

    const [motif, setMotif] = useState('restitution');
    const [dateFin, setDateFin] = useState(() => new Date().toISOString().slice(0, 10));
    const [etatFin, setEtatFin] = useState(estAppareil ? 'usage' : '');
    const [versSalarieValue, setVersSalarieValue] = useState('');
    const [observations, setObservations] = useState('');
    const [erreur, setErreur] = useState('');
    const [envoi, setEnvoi] = useState(false);

    // Le détenteur actuel ne doit pas pouvoir se transférer le matériel à
    // lui-même — par personnel_id quand il a une fiche, par nom sinon (voir
    // encoderSalarie()).
    const optionsSalarieSansActuel = useMemo(
        () => optionsSalarie.filter((o) => o.value !== encoderSalarie({ personnel_id: detention.personnel_id, nom: detenteurActuel })),
        [optionsSalarie, detention.personnel_id, detenteurActuel],
    );

    async function enregistrer() {
        if (motif === 'transfert' && !versSalarieValue) { setErreur(t('telephonie.erreurDestinataireRequis')); return; }
        setErreur('');

        const { personnel_id: versPersonnelId, salarie_nom: versSalarieNom } = decoderSalarie(versSalarieValue);
        const donnees = {
            date_fin: dateFin,
            motif_fin: motif,
            etat_fin: estAppareil ? etatFin : null,
            observations: versTexte(observations),
            vers_personnel_id: motif === 'transfert' ? versPersonnelId : null,
            vers_salarie_nom: motif === 'transfert' ? versSalarieNom : null,
        };

        setEnvoi(true);
        const res = await cloturerDetention(detention.id, donnees).catch(() => null);
        setEnvoi(false);

        if (res?.ok) {
            toast.success(motif === 'transfert' ? t('telephonie.detentionTransferee') : t('telephonie.detentionCloturee'));
            onEnregistre();
            onFerme();
            return;
        }
        toast.error(await messageErreur(res, t));
    }

    return (
        <Fenetre
            titre={t('telephonie.cloturerTitre', { objet })}
            sousTitre={t('telephonie.cloturerSousTitre', { nom: detenteurActuel })}
            envoi={envoi}
            onFerme={onFerme}
            onEnregistre={enregistrer}
            largeur='max-w-lg'
        >
            <div className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.motifFin')}</span>
                <MenuDeroulant value={motif} onChange={setMotif} options={MOTIFS_FIN.map((m) => ({ value: m, label: t(`telephonie.motifFin_${m}`) }))} boutonClassName='w-full' />
            </div>

            {motif === 'transfert' && (
                <label className='flex flex-col gap-1 sm:col-span-2'>
                    <span className={classeLabel}>{t('telephonie.transfererVers')} *</span>
                    <SelectRecherchable options={optionsSalarieSansActuel} value={versSalarieValue} onChange={setVersSalarieValue} placeholder={t('telephonie.placeholderChoisirSalarie')} required />
                </label>
            )}

            {erreur && <p className='text-xs text-destructive sm:col-span-2'>{erreur}</p>}

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colDate')} *</span>
                <input type='date' value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={classeChamp} />
            </label>

            {estAppareil && (
                <div className='flex flex-col gap-1'>
                    <span className={classeLabel}>{t('telephonie.etatConstate')}</span>
                    <MenuDeroulant value={etatFin} onChange={setEtatFin} options={ETATS_MATERIEL.map((e) => ({ value: e, label: t(`telephonie.etatMateriel_${e}`) })).concat([{ value: 'casse', label: t('telephonie.etatMateriel_casse') }])} boutonClassName='w-full' />
                    {etatFin === 'casse' && <span className='mt-0.5 text-xs text-muted-foreground'>{t('telephonie.aideEtatCasse')}</span>}
                </div>
            )}

            <label className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.observations')}</span>
                <textarea rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} className={`${classeChamp} resize-none`} />
            </label>
        </Fenetre>
    );
}

// ------------------------------------------------------------------- Incident

const INCIDENT_VIDE = { date_incident: '', nature: 'perte', montant: '', suite_donnee: 'a_decider', observations: '' };

/** Déclarer un incident : perte, casse, vol, dépassement de forfait. */
export function IncidentForm({ incident, appareilsEnService = [], lignesAttribuees = [], onFerme, onEnregistre }) {
    const { t } = useTranslation();
    const optionsSalarie = useSalarieOptions();
    const premierRef = useRef(null);

    const [salarieValue, setSalarieValue] = useState(() => {
        if (incident?.personnel_id) return `p:${incident.personnel_id}`;
        if (incident?.salarie_nom) return `n:${incident.salarie_nom}`;
        return '';
    });
    const [appareilId, setAppareilId] = useState(incident?.appareil_id ? String(incident.appareil_id) : '');
    const [ligneId, setLigneId] = useState(incident?.ligne_id ? String(incident.ligne_id) : '');
    const [form, setForm] = useState(() => {
        if (!incident) return { ...INCIDENT_VIDE, date_incident: new Date().toISOString().slice(0, 10) };
        return {
            date_incident: String(incident.date_incident || '').slice(0, 10),
            nature: incident.nature,
            montant: incident.montant ?? '',
            suite_donnee: incident.suite_donnee,
            observations: incident.observations || '',
        };
    });
    const [erreur, setErreur] = useState('');
    const [envoi, setEnvoi] = useState(false);

    useEffect(() => { premierRef.current?.focus(); }, []);

    const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

    const optionsAppareil = useMemo(
        () => [{ value: '', label: t('telephonie.aucunAppareilChoix') }, ...appareilsEnService.map((a) => ({ value: String(a.id), label: a.modele }))],
        [appareilsEnService, t],
    );
    const optionsLigne = useMemo(
        () => [{ value: '', label: t('telephonie.aucuneLigneChoix') }, ...lignesAttribuees.map((l) => ({ value: String(l.id), label: l.numero }))],
        [lignesAttribuees, t],
    );

    async function enregistrer() {
        if (!form.date_incident) { setErreur(t('telephonie.erreurDateRequise')); return; }
        if (!salarieValue && !appareilId && !ligneId) { setErreur(t('telephonie.erreurIncidentSansCible')); return; }
        setErreur('');

        const donnees = {
            ...decoderSalarie(salarieValue),
            appareil_id: appareilId ? Number(appareilId) : null,
            ligne_id: ligneId ? Number(ligneId) : null,
            date_incident: form.date_incident,
            nature: form.nature,
            montant: versNombre(form.montant),
            suite_donnee: form.suite_donnee,
            observations: versTexte(form.observations),
        };

        setEnvoi(true);
        const res = await (incident ? updateIncident(incident.id, donnees) : createIncident(donnees)).catch(() => null);
        setEnvoi(false);

        if (res?.ok) {
            toast.success(incident ? t('telephonie.incidentModifie') : t('telephonie.incidentDeclare'));
            onEnregistre();
            onFerme();
            return;
        }
        toast.error(await messageErreur(res, t));
    }

    return (
        <Fenetre titre={incident ? t('telephonie.modifierIncident') : t('telephonie.declarerIncident')} envoi={envoi} onFerme={onFerme} onEnregistre={enregistrer}>
            <label className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.colSalarie')}</span>
                <SelectRecherchable options={optionsSalarie} value={salarieValue} onChange={setSalarieValue} placeholder={t('telephonie.placeholderChoisirSalarie')} />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.appareilConcerne')}</span>
                <SelectRecherchable options={optionsAppareil} value={appareilId} onChange={setAppareilId} />
            </label>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.ligneConcernee')}</span>
                <SelectRecherchable options={optionsLigne} value={ligneId} onChange={setLigneId} />
            </label>

            {erreur && <p className='text-xs text-destructive sm:col-span-2'>{erreur}</p>}

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colDate')} *</span>
                <input ref={premierRef} type='date' value={form.date_incident} onChange={(e) => maj('date_incident', e.target.value)} className={classeChamp} />
            </label>

            <div className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colNature')}</span>
                <MenuDeroulant value={form.nature} onChange={(v) => maj('nature', v)} options={NATURES_INCIDENT.map((n) => ({ value: n, label: t(`telephonie.nature_${n}`) }))} boutonClassName='w-full' />
            </div>

            <label className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colMontant')}</span>
                <div className='relative'>
                    <input inputMode='decimal' value={form.montant} onChange={(e) => maj('montant', e.target.value.replace(/[^\d.,]/g, ''))} className={`${classeChamp} pr-8 tabular-nums`} placeholder='0,00' />
                    <span className='absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>€</span>
                </div>
            </label>

            <div className='flex flex-col gap-1'>
                <span className={classeLabel}>{t('telephonie.colSuite')}</span>
                <MenuDeroulant value={form.suite_donnee} onChange={(v) => maj('suite_donnee', v)} options={SUITES_INCIDENT.map((s) => ({ value: s, label: t(`telephonie.suite_${s}`) }))} boutonClassName='w-full' />
                {form.suite_donnee === 'retenue_salaire' && <span className='mt-1 text-xs text-muted-foreground'>{t('telephonie.aideRetenue')}</span>}
            </div>

            <label className='flex flex-col gap-1 sm:col-span-2'>
                <span className={classeLabel}>{t('telephonie.observations')}</span>
                <textarea rows={2} value={form.observations} onChange={(e) => maj('observations', e.target.value)} className={`${classeChamp} resize-none`} />
            </label>
        </Fenetre>
    );
}
