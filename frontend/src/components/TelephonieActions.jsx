import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import SelectRecherchable from './SelectRecherchable';
import MenuDeroulant from './MenuDeroulant';
import { Fenetre, classeChamp, classeLabel, versTexte, versNombre, messageErreur } from './TelephonieForms';
import { createRemise, cloturerDetention, createIncident, updateIncident } from '../api/routes/telephonie';
import { getPersonnels } from '../api/routes/personnel';

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

function nomPersonnel(p) {
    return `${p.nom} ${p.prenom}`.trim();
}

/** Charge la liste du personnel une seule fois, partagée par les trois formulaires. */
function usePersonnelOptions() {
    const [personnels, setPersonnels] = useState([]);
    useEffect(() => {
        getPersonnels()
            .then((res) => (res.status === 200 ? res.json() : []))
            .then((liste) => setPersonnels(Array.isArray(liste) ? liste : []))
            .catch(() => {});
    }, []);
    return useMemo(
        () => personnels.map((p) => ({ value: p.id, label: nomPersonnel(p) })).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
        [personnels],
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
    const optionsPersonnel = usePersonnelOptions();
    const [personnelId, setPersonnelId] = useState('');
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
        if (!personnelId) { setErreur(t('telephonie.erreurSalarieRequis')); return; }
        if (!appareilId && !ligneId) { setErreur(t('telephonie.erreurAuMoinsUnObjet')); return; }
        setErreur('');

        const donnees = {
            personnel_id: Number(personnelId),
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
                <SelectRecherchable options={optionsPersonnel} value={personnelId} onChange={setPersonnelId} placeholder={t('telephonie.placeholderChoisirSalarie')} required />
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
    const optionsPersonnel = usePersonnelOptions();
    const objet = detention.appareil ? detention.appareil.modele : detention.ligne?.numero;
    const estAppareil = !!detention.appareil;

    const [motif, setMotif] = useState('restitution');
    const [dateFin, setDateFin] = useState(() => new Date().toISOString().slice(0, 10));
    const [etatFin, setEtatFin] = useState(estAppareil ? 'usage' : '');
    const [versPersonnelId, setVersPersonnelId] = useState('');
    const [observations, setObservations] = useState('');
    const [erreur, setErreur] = useState('');
    const [envoi, setEnvoi] = useState(false);

    const optionsPersonnelSansActuel = useMemo(
        () => optionsPersonnel.filter((o) => String(o.value) !== String(detention.personnel_id)),
        [optionsPersonnel, detention.personnel_id],
    );

    async function enregistrer() {
        if (motif === 'transfert' && !versPersonnelId) { setErreur(t('telephonie.erreurDestinataireRequis')); return; }
        setErreur('');

        const donnees = {
            date_fin: dateFin,
            motif_fin: motif,
            etat_fin: estAppareil ? etatFin : null,
            observations: versTexte(observations),
            vers_personnel_id: motif === 'transfert' ? Number(versPersonnelId) : null,
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
            sousTitre={t('telephonie.cloturerSousTitre', { nom: detention.personnel ? nomPersonnel(detention.personnel) : detention.salarie_nom })}
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
                    <SelectRecherchable options={optionsPersonnelSansActuel} value={versPersonnelId} onChange={setVersPersonnelId} placeholder={t('telephonie.placeholderChoisirSalarie')} required />
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
    const optionsPersonnel = usePersonnelOptions();
    const premierRef = useRef(null);

    const [personnelId, setPersonnelId] = useState(incident?.personnel_id ? String(incident.personnel_id) : '');
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
        if (!personnelId && !appareilId && !ligneId) { setErreur(t('telephonie.erreurIncidentSansCible')); return; }
        setErreur('');

        const donnees = {
            personnel_id: personnelId ? Number(personnelId) : null,
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
                <SelectRecherchable options={optionsPersonnel} value={personnelId} onChange={setPersonnelId} placeholder={t('telephonie.placeholderChoisirSalarie')} />
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
