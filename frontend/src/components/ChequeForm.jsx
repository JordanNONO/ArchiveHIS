import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuLandmark, LuSearch, LuX } from 'react-icons/lu';
import { createCheque, updateCheque } from '../api/routes/cheque';
import { getDisplayName } from '../utils/common';
import { correspondARequete } from '../utils/recherche';

function dateActuelle() {
  return new Date().toISOString().slice(0, 10);
}

function formVide(currentUserName) {
  return {
    agentLabel: currentUserName || '',
    numero_bordereau_remise: '',
    date_depot: '',
    banque_depot: '',
    date_emission: dateActuelle(),
    numero_cheque: '',
    banque_emettrice: '',
    nom_emetteur: '',
    nom_beneficiaire: '',
    montant: '',
    facture_reglee: '',
  };
}

/** Reconstruit le formulaire à partir d'un chèque déjà enregistré (mode modification). */
function formDepuisCheque(cheque) {
  return {
    agentLabel: getDisplayName({ personnel: cheque.utilisateur?.personnels?.[0] }) || cheque.utilisateur?.nom || '',
    numero_bordereau_remise: cheque.numero_bordereau_remise || '',
    date_depot: cheque.date_depot ? String(cheque.date_depot).slice(0, 10) : '',
    banque_depot: cheque.banque_depot || '',
    date_emission: cheque.date_emission ? String(cheque.date_emission).slice(0, 10) : dateActuelle(),
    numero_cheque: cheque.numero_cheque || '',
    banque_emettrice: cheque.banque_emettrice || '',
    nom_emetteur: cheque.nom_emetteur || '',
    nom_beneficiaire: cheque.nom_beneficiaire || '',
    montant: cheque.montant != null ? String(cheque.montant) : '',
    facture_reglee: cheque.facture_reglee || '',
  };
}

/**
 * Petit champ texte avec suggestions déroulantes — même composant que
 * AppelForm.jsx (ChampAvecSuggestions), dupliqué ici volontairement (pas
 * assez générique pour valoir une extraction partagée pour l'instant, voir
 * le commentaire équivalent côté AppelForm.jsx).
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Valeurs déjà vues (banque, émetteur...) — mêmes suggestions "un exemplaire par valeur" que AppelForm.jsx. */
function suggestionsDepuis(historique, champ) {
  const vues = new Set();
  const resultat = [];
  for (const c of historique || []) {
    const v = c[champ];
    if (v && !vues.has(v)) {
      vues.add(v);
      resultat.push({ value: v, label: v });
    }
  }
  return resultat;
}

/**
 * Saisie d'un chèque reçu — même esprit que AppelForm.jsx (reste ouvert et
 * se vide après chaque enregistrement pour enchaîner sur le chèque
 * suivant), calqué sur les colonnes du tableur "État des chèques" utilisé
 * jusqu'ici : n° de bordereau, dates de dépôt/émission, banque de dépôt/
 * émettrice, émetteur/bénéficiaire, montant, facture réglée.
 */
function ChequeForm({ onEnregistre, historiqueCheques, chequeAModifier, onModifie, onAnnulerModification }) {
  const { t } = useTranslation();
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const currentUserName = getDisplayName(currentUser);
  const enModification = !!chequeAModifier;

  const [form, setForm] = useState(() => (chequeAModifier ? formDepuisCheque(chequeAModifier) : formVide(currentUserName)));
  const [enCours, setEnCours] = useState(false);
  const premierChampRef = useRef(null);

  useEffect(() => {
    setForm(chequeAModifier ? formDepuisCheque(chequeAModifier) : formVide(currentUserName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chequeAModifier]);

  function champ(nom) {
    return {
      value: form[nom],
      onChange: (e) => setForm((f) => ({ ...f, [nom]: e.target.value })),
    };
  }

  const suggestionsBanqueDepot = useMemo(() => suggestionsDepuis(historiqueCheques, 'banque_depot'), [historiqueCheques]);
  const suggestionsBanqueEmettrice = useMemo(() => suggestionsDepuis(historiqueCheques, 'banque_emettrice'), [historiqueCheques]);
  const suggestionsEmetteur = useMemo(() => suggestionsDepuis(historiqueCheques, 'nom_emetteur'), [historiqueCheques]);

  async function enregistrer(e) {
    e.preventDefault();
    if (!form.date_emission || !form.numero_cheque.trim() || !form.nom_emetteur.trim() || !form.montant) {
      toast.error(t('chequeForm.champsObligatoires'));
      return;
    }
    setEnCours(true);
    try {
      const donnees = {
        numero_bordereau_remise: form.numero_bordereau_remise || null,
        date_depot: form.date_depot || null,
        banque_depot: form.banque_depot || null,
        date_emission: form.date_emission,
        numero_cheque: form.numero_cheque,
        banque_emettrice: form.banque_emettrice || null,
        nom_emetteur: form.nom_emetteur,
        nom_beneficiaire: form.nom_beneficiaire || null,
        montant: form.montant,
        facture_reglee: form.facture_reglee || null,
      };
      const res = enModification
        ? await updateCheque(chequeAModifier.id, donnees)
        : await createCheque(donnees);
      const codeSucces = enModification ? 200 : 201;
      if (res.status === codeSucces) {
        if (enModification) {
          toast.success(t('chequeForm.chequeModifie'));
          onModifie && onModifie();
        } else {
          toast.success(t('chequeForm.chequeEnregistre'));
          // Bordereau/date de dépôt/banque de dépôt restent pré-remplis : en
          // pratique, plusieurs chèques sont déposés ensemble sous le même
          // bordereau (voir le tableur d'origine, jusqu'à 5 chèques par
          // lot) — retaper ces 3 champs à chaque chèque du même lot serait
          // fastidieux. Repart à vide uniquement si on change explicitement
          // l'un des trois pour un nouveau lot.
          setForm((f) => ({
            ...formVide(currentUserName),
            numero_bordereau_remise: f.numero_bordereau_remise,
            date_depot: f.date_depot,
            banque_depot: f.banque_depot,
          }));
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
          <LuLandmark size={16} className='text-primary' />
          {enModification ? t('chequeForm.titreModification') : t('chequeForm.titre')}
        </h3>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <span className='px-2 py-1 rounded-md bg-muted'>{form.agentLabel}</span>
          {enModification && (
            <button type='button' onClick={onAnnulerModification} className='flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-muted transition-colors' title={t('chequeForm.annuler')}>
              <LuX size={13} />
            </button>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('chequeForm.numeroBordereau')}</label>
          <input ref={premierChampRef} type='text' {...champ('numero_bordereau_remise')} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('chequeForm.dateDepot')}</label>
          <input type='date' {...champ('date_depot')} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('chequeForm.banqueDepot')}</label>
          <ChampAvecSuggestions
            valeur={form.banque_depot}
            onChange={(v) => setForm((f) => ({ ...f, banque_depot: v }))}
            suggestions={suggestionsBanqueDepot}
            onChoisir={(s) => setForm((f) => ({ ...f, banque_depot: s.label }))}
            placeholder={t('chequeForm.banqueDepotPlaceholder')}
            icon={LuSearch}
          />
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('chequeForm.dateEmission')} *</label>
          <input type='date' {...champ('date_emission')} required className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('chequeForm.numeroCheque')} *</label>
          <input type='text' {...champ('numero_cheque')} required className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('chequeForm.banqueEmettrice')}</label>
          <ChampAvecSuggestions
            valeur={form.banque_emettrice}
            onChange={(v) => setForm((f) => ({ ...f, banque_emettrice: v }))}
            suggestions={suggestionsBanqueEmettrice}
            onChoisir={(s) => setForm((f) => ({ ...f, banque_emettrice: s.label }))}
            placeholder={t('chequeForm.banqueEmettricePlaceholder')}
            icon={LuSearch}
          />
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
        <div className='lg:col-span-2'>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('chequeForm.nomEmetteur')} *</label>
          <ChampAvecSuggestions
            valeur={form.nom_emetteur}
            onChange={(v) => setForm((f) => ({ ...f, nom_emetteur: v }))}
            suggestions={suggestionsEmetteur}
            onChoisir={(s) => setForm((f) => ({ ...f, nom_emetteur: s.label }))}
            placeholder={t('chequeForm.nomEmetteurPlaceholder')}
          />
        </div>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('chequeForm.nomBeneficiaire')}</label>
          <input type='text' {...champ('nom_beneficiaire')} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
        <div>
          <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('chequeForm.montant')} *</label>
          <input type='number' step='0.01' min='0' {...champ('montant')} required className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
        </div>
      </div>

      <div>
        <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('chequeForm.factureReglee')}</label>
        <input type='text' {...champ('facture_reglee')} placeholder={t('chequeForm.factureRegleePlaceholder')} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
      </div>

      <div className='flex justify-end'>
        <button
          type='submit'
          disabled={enCours}
          className='inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60 transition-colors'
        >
          {enCours
            ? t('chequeForm.enregistrementEnCours')
            : (enModification ? t('chequeForm.enregistrerModifications') : t('chequeForm.enregistrer'))}
        </button>
      </div>
    </form>
  );
}

export default ChequeForm;
