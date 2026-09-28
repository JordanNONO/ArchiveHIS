import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuPhoneIncoming, LuSearch, LuPhoneCall, LuAlertTriangle, LuClock, LuInfo, LuX, LuUser, LuUsers2, LuBuilding2 } from 'react-icons/lu';
import { createAppel, updateAppel } from '../api/routes/appel';
import { getPersonnels } from '../api/routes/personnel';
import { getServicesMetier } from '../api/routes/serviceMetier';
import { getDisplayName } from '../utils/common';
import { correspondARequete } from '../utils/recherche';

const MODES_CONCERNE = [
  { valeur: 'une', icon: LuUser },
  { valeur: 'plusieurs', icon: LuUsers2 },
  { valeur: 'service', icon: LuBuilding2 },
];

const ACTIONS = [
  { valeur: 'Rappeler', icon: LuPhoneCall, classe: 'border-accent bg-accent/10 text-accent-foreground' },
  { valeur: 'Rappeler URGENT', icon: LuAlertTriangle, classe: 'border-destructive bg-destructive/10 text-destructive' },
  { valeur: 'Rappellera', icon: LuClock, classe: 'border-primary bg-primary/10 text-primary' },
  { valeur: 'Pour info', icon: LuInfo, classe: 'border-border bg-muted text-muted-foreground' },
];

function heureActuelle() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dateActuelle() {
  return new Date().toISOString().slice(0, 10);
}

function formVide(currentUserName) {
  return {
    date_appel: dateActuelle(),
    heure_appel: heureActuelle(),
    agentLabel: currentUserName || '',
    appelant_nom: '',
    appelant_telephone: '',
    appelant_organisation: '',
    appelant_qualite: '',
    appelant_email: '',
    objet: '',
    message: '',
    oriente_nom: '',
    oriente_service: '',
    concerne_mode: 'une',
    personnel_concerne_id: null,
    personne_concernee_texte: '',
    personnels_concernes_ids: [],
    service_metier_concerne_id: null,
    action: '',
  };
}

/** Reconstruit le formulaire à partir d'un appel déjà enregistré (mode modification). */
function formDepuisAppel(appel) {
  const concerneMode = appel.service_metier_concerne_id
    ? 'service'
    : (appel.personnels_concernes_ids?.length ? 'plusieurs' : 'une');

  return {
    date_appel: appel.date_appel ? String(appel.date_appel).slice(0, 10) : dateActuelle(),
    heure_appel: appel.heure_appel ? String(appel.heure_appel).slice(0, 5) : heureActuelle(),
    agentLabel: getDisplayName({ personnel: appel.utilisateur?.personnels?.[0] }) || appel.utilisateur?.nom || '',
    appelant_nom: appel.appelant_nom || '',
    appelant_telephone: appel.appelant_telephone || '',
    appelant_organisation: appel.appelant_organisation || '',
    appelant_qualite: appel.appelant_qualite || '',
    appelant_email: appel.appelant_email || '',
    objet: appel.objet || '',
    message: appel.message || '',
    oriente_nom: appel.oriente_nom || '',
    oriente_service: appel.oriente_service || '',
    concerne_mode: concerneMode,
    personnel_concerne_id: appel.personnel_concerne_id || null,
    personne_concernee_texte: appel.personnel_concerne
      ? `${appel.personnel_concerne.prenom || ''} ${appel.personnel_concerne.nom || ''}`.trim()
      : (appel.personne_concernee_texte || ''),
    personnels_concernes_ids: (appel.personnels_concernes_ids || []),
    service_metier_concerne_id: appel.service_metier_concerne_id || null,
    action: appel.action || '',
  };
}

/**
 * Petit champ texte avec suggestions déroulantes — 100% côté client (voir
 * plan : ni débounce ni appel réseau par frappe, pour rester instantané
 * pendant que l'appel est en cours), même esprit que
 * DestinatairesNotificationField.jsx mais en sélection unique + callback de
 * pré-remplissage.
 */
function ChampAvecSuggestions({ valeur, onChange, suggestions, onChoisir, placeholder, icon: Icon }) {
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef(null);

  useEffect(() => {
    function onClicExterieur(e) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target)) setOuvert(false);
    }
    document.addEventListener('mousedown', onClicExterieur);
    return () => document.removeEventListener('mousedown', onClicExterieur);
  }, []);

  const filtrees = useMemo(() => {
    if (!valeur.trim()) return [];
    return suggestions.filter((s) => correspondARequete([s.label], valeur)).slice(0, 6);
  }, [valeur, suggestions]);

  return (
    <div className='relative' ref={conteneurRef}>
      <div className='relative'>
        {Icon && <Icon size={14} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none' />}
        <input
          type='text'
          value={valeur}
          onChange={(e) => { onChange(e.target.value); setOuvert(true); }}
          onFocus={() => setOuvert(true)}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-border bg-background py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${Icon ? 'pl-8 pr-3' : 'px-3'}`}
        />
      </div>
      {ouvert && filtrees.length > 0 && (
        <div className='absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg'>
          {filtrees.map((s) => (
            <button
              key={s.value}
              type='button'
              onClick={() => { onChoisir(s); setOuvert(false); }}
              className='flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors'
            >
              <span className='font-medium text-foreground'>{s.label}</span>
              {s.sousLabel && <span className='text-xs text-muted-foreground'>{s.sousLabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Saisie rapide d'un appel téléphonique reçu — pensée pour être remplie
 * PENDANT l'appel : date/heure/agent pré-remplis à l'ouverture, reste
 * ouverte et se vide après chaque enregistrement pour enchaîner
 * immédiatement sur l'appel suivant (voir le plan : c'est le point clé).
 *
 * `appelAModifier` bascule ce même formulaire en mode correction (une
 * ligne déjà enregistrée, ex: faute de frappe pendant la saisie rapide) —
 * pré-rempli à partir de l'appel existant, et n'enchaîne pas sur un
 * nouveau formulaire vide après l'enregistrement : corriger une ligne
 * passée n'a pas la même logique "un appel après l'autre" que la saisie
 * en direct.
 */
function AppelForm({ onEnregistre, historiqueAppels, appelAModifier, onModifie, onAnnulerModification }) {
  const { t } = useTranslation();
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const currentUserName = getDisplayName(currentUser);
  const enModification = !!appelAModifier;

  const [form, setForm] = useState(() => (appelAModifier ? formDepuisAppel(appelAModifier) : formVide(currentUserName)));
  const [personnels, setPersonnels] = useState([]);
  const [services, setServices] = useState([]);
  const [rechercheConcernes, setRechercheConcernes] = useState('');
  const [enCours, setEnCours] = useState(false);
  const premierChampRef = useRef(null);

  useEffect(() => {
    setForm(appelAModifier ? formDepuisAppel(appelAModifier) : formVide(currentUserName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appelAModifier]);

  useEffect(() => {
    getPersonnels().then(async (res) => res.ok && setPersonnels(await res.json())).catch(() => {});
    getServicesMetier().then(async (res) => res.ok && setServices(await res.json())).catch(() => {});
  }, []);

  // Effectif par service (pour l'afficher à côté de son nom) — dérivé de la
  // liste des personnels déjà chargée pour les suggestions, plutôt qu'un
  // appel réseau de plus.
  const effectifParService = useMemo(() => {
    const compteurs = new Map();
    for (const p of personnels) {
      for (const role of p.user?.roles || []) {
        if (!role.service_metier_id) continue;
        compteurs.set(role.service_metier_id, (compteurs.get(role.service_metier_id) || 0) + 1);
      }
    }
    return compteurs;
  }, [personnels]);

  function choisirModeConcerne(mode) {
    setForm((f) => ({ ...f, concerne_mode: mode }));
  }

  // personnels_concernes_ids référence Personnels.id — même espace d'id que
  // personnel_concerne_id (mode "une personne"), pas Utilisateurs.id.
  function togglePersonnelConcerne(personnelId) {
    setForm((f) => ({
      ...f,
      personnels_concernes_ids: f.personnels_concernes_ids.includes(personnelId)
        ? f.personnels_concernes_ids.filter((id) => id !== personnelId)
        : [...f.personnels_concernes_ids, personnelId],
    }));
  }

  function champ(nom) {
    return {
      value: form[nom],
      onChange: (e) => setForm((f) => ({ ...f, [nom]: e.target.value })),
    };
  }

  // Un même appelant, dernière fiche connue seulement — pas la peine de
  // proposer 5 fois la même personne pour 5 appels passés le mois dernier.
  const suggestionsAppelants = useMemo(() => {
    const parNom = new Map();
    for (const a of historiqueAppels || []) {
      parNom.set(a.appelant_nom, a);
    }
    return Array.from(parNom.values()).map((a) => ({
      value: a.id,
      label: a.appelant_nom,
      sousLabel: [a.appelant_telephone, a.appelant_organisation].filter(Boolean).join(' — '),
      appel: a,
    }));
  }, [historiqueAppels]);

  const suggestionsPersonnels = useMemo(() => personnels.map((p) => ({
    value: p.id,
    label: `${p.prenom || ''} ${p.nom || ''}`.trim(),
    sousLabel: p.bureau?.name,
    personnel: p,
  })), [personnels]);

  function choisirAppelant(suggestion) {
    const a = suggestion.appel;
    setForm((f) => ({
      ...f,
      appelant_nom: a.appelant_nom,
      appelant_telephone: a.appelant_telephone || f.appelant_telephone,
      appelant_organisation: a.appelant_organisation || f.appelant_organisation,
      appelant_qualite: a.appelant_qualite || f.appelant_qualite,
      appelant_email: a.appelant_email || f.appelant_email,
    }));
  }

  function choisirPersonneConcernee(suggestion) {
    setForm((f) => ({
      ...f,
      personne_concernee_texte: suggestion.label,
      personnel_concerne_id: suggestion.value,
    }));
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (!form.appelant_telephone.trim() || !form.action) {
      toast.error(t('appelForm.champsObligatoires'));
      return;
    }
    setEnCours(true);
    try {
      const donnees = {
        date_appel: form.date_appel,
        heure_appel: form.heure_appel,
        appelant_nom: form.appelant_nom,
        appelant_telephone: form.appelant_telephone,
        appelant_organisation: form.appelant_organisation || null,
        appelant_qualite: form.appelant_qualite || null,
        appelant_email: form.appelant_email || null,
        objet: form.objet || null,
        message: form.message || null,
        oriente_nom: form.oriente_nom || null,
        oriente_service: form.oriente_service || null,
        personnel_concerne_id: form.concerne_mode === 'une' ? form.personnel_concerne_id : null,
        personne_concernee_texte: form.concerne_mode === 'une' && !form.personnel_concerne_id
          ? (form.personne_concernee_texte || null)
          : null,
        personnels_concernes_ids: form.concerne_mode === 'plusieurs' ? form.personnels_concernes_ids : [],
        service_metier_concerne_id: form.concerne_mode === 'service' ? form.service_metier_concerne_id : null,
        action: form.action,
      };
      const res = enModification
        ? await updateAppel(appelAModifier.id, donnees)
        : await createAppel(donnees);
      const codeSucces = enModification ? 200 : 201;
      if (res.status === codeSucces) {
        if (enModification) {
          toast.success(t('appelForm.appelModifie'));
          onModifie && onModifie();
        } else {
          toast.success(t('appelForm.appelEnregistre'));
          setForm(formVide(currentUserName));
          onEnregistre && onEnregistre();
          premierChampRef.current?.focus();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || t('commun.erreurGenerique'));
      }
    } catch (error) {
      console.log(error);
      toast.error(t('commun.erreurGenerique'));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={enregistrer} className='rounded-2xl border border-border bg-card p-5 flex flex-col gap-4'>
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
          <LuPhoneIncoming size={16} className='text-primary' />
          {enModification ? t('appelForm.titreModification') : t('appelForm.titre')}
        </h3>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <input type='date' {...champ('date_appel')} className='rounded-md border border-border bg-background px-2 py-1' />
          <input type='time' {...champ('heure_appel')} className='rounded-md border border-border bg-background px-2 py-1' />
          <span className='px-2 py-1 rounded-md bg-muted'>{form.agentLabel}</span>
          {enModification && (
            <button type='button' onClick={onAnnulerModification} className='flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-muted transition-colors' title={t('appelForm.annuler')}>
              <LuX size={13} />
            </button>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
        <div className='lg:col-span-2'>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('appelForm.appelantNom')}</label>
          <ChampAvecSuggestions
            valeur={form.appelant_nom}
            onChange={(v) => setForm((f) => ({ ...f, appelant_nom: v }))}
            suggestions={suggestionsAppelants}
            onChoisir={choisirAppelant}
            placeholder={t('appelForm.appelantNomPlaceholder')}
            icon={LuSearch}
          />
        </div>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('appelForm.appelantTelephone')} *</label>
          <input type='tel' {...champ('appelant_telephone')} required className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('appelForm.appelantOrganisation')}</label>
          <input type='text' {...champ('appelant_organisation')} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('appelForm.appelantQualite')}</label>
          <input type='text' {...champ('appelant_qualite')} placeholder={t('appelForm.appelantQualitePlaceholder')} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('appelForm.appelantEmail')}</label>
          <input type='email' {...champ('appelant_email')} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('appelForm.objet')}</label>
          <input type='text' {...champ('objet')} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
      </div>

      <div>
        <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('appelForm.message')}</label>
        <textarea {...champ('message')} rows={2} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none' />
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-dashed border-border p-3'>
        <div className='sm:col-span-2 text-xs font-medium text-muted-foreground'>{t('appelForm.appelOriente')}</div>
        <div>
          <label className='block text-xs text-muted-foreground mb-1'>{t('appelForm.orienteNom')}</label>
          <input type='text' {...champ('oriente_nom')} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
        <div>
          <label className='block text-xs text-muted-foreground mb-1'>{t('appelForm.orienteService')}</label>
          <input type='text' {...champ('oriente_service')} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
        <div className='sm:col-span-2'>
          <label className='block text-xs text-muted-foreground mb-1.5'>{t('appelForm.concerne')}</label>
          <div className='grid grid-cols-3 gap-1.5 mb-2'>
            {MODES_CONCERNE.map(({ valeur, icon: Icon }) => (
              <button
                key={valeur}
                type='button'
                onClick={() => choisirModeConcerne(valeur)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors ${form.concerne_mode === valeur ? 'border-primary bg-primary/5 text-foreground font-medium' : 'border-border text-muted-foreground hover:border-primary/40'}`}
              >
                <Icon size={14} />
                {t(`appelForm.concerneMode_${valeur}`)}
              </button>
            ))}
          </div>

          {form.concerne_mode === 'une' && (
            <ChampAvecSuggestions
              valeur={form.personne_concernee_texte}
              onChange={(v) => setForm((f) => ({ ...f, personne_concernee_texte: v, personnel_concerne_id: null }))}
              suggestions={suggestionsPersonnels}
              onChoisir={choisirPersonneConcernee}
              placeholder={t('appelForm.personneConcerneePlaceholder')}
            />
          )}

          {form.concerne_mode === 'plusieurs' && (
            <div className='rounded-lg border border-border overflow-hidden'>
              <div className='flex items-center gap-2 px-2.5 py-1.5 border-b border-border bg-muted/30'>
                <LuSearch size={13} className='text-muted-foreground shrink-0' />
                <input
                  type='text'
                  value={rechercheConcernes}
                  onChange={(e) => setRechercheConcernes(e.target.value)}
                  placeholder={t('appelForm.rechercherPersonne')}
                  className='w-full bg-transparent text-sm focus:outline-none'
                />
              </div>
              <div className='max-h-36 overflow-y-auto'>
                {personnels
                  .filter((p) => correspondARequete([`${p.prenom} ${p.nom}`], rechercheConcernes))
                  .map((p) => {
                    const coche = form.personnels_concernes_ids.includes(p.id);
                    return (
                      <label key={p.id} className='flex items-center gap-2.5 px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors'>
                        <input type='checkbox' checked={coche} onChange={() => togglePersonnelConcerne(p.id)} className='shrink-0' />
                        <span className='truncate'>{p.prenom} {p.nom}</span>
                      </label>
                    );
                  })}
              </div>
              {form.personnels_concernes_ids.length > 0 && (
                <p className='text-[11px] text-muted-foreground px-2.5 py-1.5 border-t border-border bg-muted/20'>
                  {t('appelForm.nPersonnesSelectionnees', { count: form.personnels_concernes_ids.length })}
                </p>
              )}
            </div>
          )}

          {form.concerne_mode === 'service' && (
            <div className='rounded-lg border border-border overflow-hidden max-h-40 overflow-y-auto'>
              {services.map((s) => (
                <button
                  key={s.id}
                  type='button'
                  onClick={() => setForm((f) => ({ ...f, service_metier_concerne_id: s.id }))}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-left border-b border-border last:border-b-0 transition-colors ${form.service_metier_concerne_id === s.id ? 'bg-primary/5 text-foreground font-medium' : 'hover:bg-muted/50 text-muted-foreground'}`}
                >
                  <span className='truncate'>{s.nom_service}</span>
                  <span className='text-[11px] shrink-0'>{t('appelForm.nPersonnes', { count: effectifParService.get(s.id) || 0 })}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className='block text-xs font-medium text-muted-foreground mb-1.5'>{t('appelForm.action')} *</label>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
          {ACTIONS.map(({ valeur, icon: Icon, classe }) => (
            <button
              key={valeur}
              type='button'
              onClick={() => setForm((f) => ({ ...f, action: valeur }))}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${form.action === valeur ? classe : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              <Icon size={14} />
              {t(`appelForm.action${valeur.replace(/\s/g, '')}`)}
            </button>
          ))}
        </div>
      </div>

      <div className='flex justify-end'>
        <button
          type='submit'
          disabled={enCours}
          className='inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60 transition-colors'
        >
          {enCours
            ? t('appelForm.enregistrementEnCours')
            : (enModification ? t('appelForm.enregistrerModifications') : t('appelForm.enregistrer'))}
        </button>
      </div>
    </form>
  );
}

export default AppelForm;
