import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  LuMegaphone, LuBanknote, LuMapPin, LuUsers, LuHeartPulse, LuInfo, LuPaperclip,
  LuAlertTriangle, LuSend, LuCheckCheck, LuChevronDown, LuArrowRight, LuEye,
  LuPlus, LuX, LuTrash2, LuPencil, LuSearch, LuChevronLeft, LuChevronRight, LuLoader, LuClock,
} from 'react-icons/lu';
import {
  getAnnoncesPaie, createAnnoncePaie, updateAnnoncePaie,
  changerStatutAnnoncePaie, deleteAnnoncePaie, urlPieceAnnoncePaie,
} from '../api/routes/annoncePaie';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import MenuDeroulant from './MenuDeroulant';
import SelectRecherchable from './SelectRecherchable';
import { getInitials } from '../utils/common';

/**
 * Annonces à la paie du mois — ce qui change dans le dossier d'un salarié
 * (RIB, adresse, situation familiale, mutuelle) et doit être répercuté par le
 * cabinet de paie, avec son justificatif. Remplace l'ancienne section « Mise
 * à jour des dossiers » de la fluctuation, qui disait la même chose sans
 * porter ni l'ancienne valeur, ni la preuve, ni le suivi de transmission.
 *
 * Ce fichier expose une TUILE (comme les sections de la fluctuation) qui
 * ouvre une fenêtre : liste, fiche d'une annonce, et formulaire en 4 étapes.
 *
 * La liste est pensée pour ne jamais devenir fastidieuse : une ligne par
 * SALARIÉ (dépliable) et non par annonce, onglets par statut avec « À
 * traiter » par défaut, filtre par type, recherche, et pagination.
 */

const TYPES = [
  { cle: 'rib', icone: LuBanknote, ton: 'bg-primary/10 text-primary' },
  { cle: 'adresse', icone: LuMapPin, ton: 'bg-accent/15 text-accent-foreground' },
  { cle: 'situation_familiale', icone: LuUsers, ton: 'bg-secondary/15 text-secondary' },
  { cle: 'mutuelle', icone: LuHeartPulse, ton: 'bg-green-500/15 text-green-700' },
  { cle: 'temps_travail', icone: LuClock, ton: 'bg-secondary/15 text-secondary' },
  // Fourre-tout : bordure en tirets pour le distinguer des types précis.
  { cle: 'info', icone: LuInfo, ton: 'bg-muted text-muted-foreground', pointille: true },
];
const TYPE_PAR_CLE = Object.fromEntries(TYPES.map((t) => [t.cle, t]));

/**
 * Champs structurés par type — miroir de AnnoncePaie::CHAMPS. Seul le RIB en
 * a : le cabinet doit pouvoir le recopier sans interpréter une phrase. Les
 * annonces enregistrées avant ce découpage portaient un couple
 * ancienne/nouvelle valeur, que la fiche continue d'afficher.
 */
const CHAMPS_PAR_TYPE = {
  rib: ['iban', 'bic', 'titulaire'],
  adresse: [],
  situation_familiale: [],
  mutuelle: [],
  temps_travail: [],
  info: [],
};
const TYPES_JUSTIFICATIF_ATTENDU = ['rib', 'adresse', 'situation_familiale', 'mutuelle', 'temps_travail'];

const STATUTS = {
  brouillon: { ton: 'bg-muted text-muted-foreground' },
  a_transmettre: { ton: 'bg-accent/20 text-accent-foreground' },
  transmis: { ton: 'bg-primary/15 text-primary' },
  lu: { ton: 'bg-green-500/15 text-green-700' },
};

// Onglet par défaut : ce qui reste à faire, pour que le déjà-traité ne gêne pas.
const ONGLETS = [
  { cle: 'todo', statuts: ['brouillon', 'a_transmettre'] },
  { cle: 'sent', statuts: ['transmis'] },
  { cle: 'read', statuts: ['lu'] },
  { cle: 'all', statuts: null },
];

const SALARIES_PAR_PAGE = 4;

/** Un IBAN ne s'affiche jamais en entier : seuls les 4 derniers caractères. */
function masquerIban(valeur) {
  const net = String(valeur || '').replace(/\s+/g, '');
  if (net.length < 5) return valeur || '';
  return `•••• ${net.slice(-4)}`;
}

function valeurAffichee(type, champ, valeur) {
  if (!valeur) return '—';
  return type === 'rib' && (champ === 'ancienne' || champ === 'nouvelle') ? masquerIban(valeur) : valeur;
}

function Pastille({ statut, t }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUTS[statut]?.ton || STATUTS.brouillon.ton}`}>
      {t(`annoncesPaie.statut_${statut}`)}
    </span>
  );
}

/** Fiche d'une annonce : ancienne → nouvelle valeur, justificatif, historique. */
function FicheAnnonce({ annonce, verrouille, onFermer, onModifier, onStatut, onSupprimer, t, formatDate }) {
  const type = TYPE_PAR_CLE[annonce.type] || TYPE_PAR_CLE.info;
  const Icone = type.icone;
  const champs = CHAMPS_PAR_TYPE[annonce.type] || [];
  const donnees = annonce.donnees || {};

  const etapes = [
    { cle: 'creee', date: annonce.created_at, faite: true },
    { cle: 'transmise', date: annonce.transmis_le, faite: !!annonce.transmis_le },
    { cle: 'lue', date: annonce.lu_le, faite: !!annonce.lu_le },
  ];

  const suivant = annonce.statut === 'brouillon' ? 'a_transmettre'
    : annonce.statut === 'a_transmettre' ? 'transmis'
      : annonce.statut === 'transmis' ? 'lu' : null;

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-start gap-3'>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${type.ton}`}>
          <Icone size={18} />
        </span>
        <div className='flex-1 min-w-0'>
          <h3 className='text-base font-semibold text-foreground'>{t(`annoncesPaie.type_${annonce.type}`)}</h3>
          <p className='text-sm text-muted-foreground'>
            {annonce.salarie || t('annoncesPaie.tousLesSalaries')}
            {annonce.date_effet ? ` · ${t('annoncesPaie.dateEffet')} ${formatDate(annonce.date_effet)}` : ''}
          </p>
        </div>
        <Pastille statut={annonce.statut} t={t} />
      </div>

      {champs.length > 0 && (
        <div className='rounded-xl border border-border divide-y divide-border'>
          {champs.map((champ) => (
            <div key={champ} className='flex items-center gap-3 px-3.5 py-2.5'>
              <span className='text-xs font-semibold uppercase tracking-wide text-muted-foreground w-28 shrink-0'>
                {t(`annoncesPaie.champ_${champ}`)}
              </span>
              {champ === 'banque' ? (
                <span className='text-sm text-foreground'>{donnees.banque || '—'}</span>
              ) : (
                <span className='text-sm text-foreground'>{valeurAffichee(annonce.type, champ, donnees[champ])}</span>
              )}
            </div>
          ))}
          {donnees.ancienne && donnees.nouvelle && (
            <div className='flex items-center gap-2 px-3.5 py-2.5 text-sm'>
              <span className='text-muted-foreground'>{valeurAffichee(annonce.type, 'ancienne', donnees.ancienne)}</span>
              <LuArrowRight size={14} className='text-muted-foreground shrink-0' />
              <span className='font-semibold text-foreground'>{valeurAffichee(annonce.type, 'nouvelle', donnees.nouvelle)}</span>
            </div>
          )}
        </div>
      )}

      {annonce.message && (
        <p className='text-sm text-foreground whitespace-pre-wrap rounded-xl bg-muted/40 px-3.5 py-2.5'>{annonce.message}</p>
      )}

      {annonce.piece_jointe ? (
        <a
          href={urlPieceAnnoncePaie(annonce.id)}
          target='_blank'
          rel='noreferrer'
          className='inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors'
        >
          <LuPaperclip size={15} /> {annonce.piece_jointe_nom || t('annoncesPaie.justificatif')}
          <LuEye size={14} className='ml-auto text-muted-foreground' />
        </a>
      ) : (
        <p className='inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3.5 py-2.5 text-sm text-foreground'>
          <LuAlertTriangle size={15} className='text-destructive shrink-0' /> {t('annoncesPaie.justificatifManquant')}
        </p>
      )}

      <div>
        <p className='text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2'>{t('annoncesPaie.historique')}</p>
        <ol className='flex flex-col gap-1.5'>
          {etapes.map((e) => (
            <li key={e.cle} className='flex items-center gap-2 text-sm'>
              <span className={`w-2 h-2 rounded-full shrink-0 ${e.faite ? 'bg-primary' : 'bg-border'}`} />
              <span className={e.faite ? 'text-foreground' : 'text-muted-foreground'}>{t(`annoncesPaie.etape_${e.cle}`)}</span>
              <span className='text-xs text-muted-foreground ml-auto tabular-nums'>{e.date ? formatDate(e.date) : '—'}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className='flex flex-wrap items-center gap-2 pt-1'>
        {!verrouille && suivant && (
          <button onClick={() => onStatut(annonce, suivant)} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>
            {suivant === 'transmis' ? <LuSend size={14} /> : suivant === 'lu' ? <LuCheckCheck size={14} /> : <LuArrowRight size={14} />}
            {t(`annoncesPaie.action_${suivant}`)}
          </button>
        )}
        {!verrouille && (
          <>
            <button onClick={() => onModifier(annonce)} className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted transition-colors'>
              <LuPencil size={14} /> {t('annoncesPaie.modifier')}
            </button>
            <button onClick={() => onSupprimer(annonce)} className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors'>
              <LuTrash2 size={14} /> {t('annoncesPaie.supprimer')}
            </button>
          </>
        )}
        <button onClick={onFermer} className='ml-auto text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'>
          {t('annoncesPaie.retourListe')}
        </button>
      </div>
    </div>
  );
}

const CHAMP_CLASSES = 'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
const LABEL_CLASSES = 'block text-sm font-semibold text-foreground mb-1.5';

/** Jour du mois où le cabinet arrête la paie — au-delà, l'annonce bascule sur le mois suivant. */
const JOUR_CLOTURE_PAIE = 20;

// Exemples affichés en filigrane : la forme attendue doit être évidente sans
// explication. L'IBAN est l'exemple de documentation de la norme — il passe
// le contrôle de clé ci-dessous, contrairement à un numéro inventé, qui
// afficherait une erreur à qui le recopierait pour essayer.
const PLACEHOLDERS_RIB = {
  iban: 'FR14 2004 1010 0505 0001 3M02 606',
  bic: 'BNPAFRPPXXX',
};

/**
 * Contrôle de clé IBAN (ISO 13616, modulo 97). Un IBAN mal recopié ne se
 * découvre que le jour du virement, salaire non versé à la clé : autant le
 * dire à la saisie. On signale sans bloquer — mieux vaut une annonce
 * transmise avec un avertissement qu'une saisie impossible à enregistrer.
 */
function ibanValide(valeur) {
  const net = String(valeur || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(net)) return false;

  const reordonne = net.slice(4) + net.slice(0, 4);
  const numerique = reordonne.replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55);
  // Modulo progressif : le nombre entier dépasse la précision d'un Number.
  let reste = 0;
  for (const chiffre of numerique) reste = (reste * 10 + Number(chiffre)) % 97;
  return reste === 1;
}

/** BIC/SWIFT : 4 lettres banque + 2 pays + 2 localité, plus 3 optionnels d'agence. */
function bicValide(valeur) {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(valeur || '').replace(/\s+/g, '').toUpperCase());
}

/** IBAN en groupes de 4 (lisible pour relire un RIB papier), BIC collé en majuscules. */
function normaliserChamp(champ, valeur) {
  if (champ === 'iban') {
    return String(valeur).replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
  }
  if (champ === 'bic') {
    return String(valeur).replace(/\s+/g, '').toUpperCase();
  }
  return valeur;
}

/**
 * Formulaire d'annonce, en modale à deux volets : à gauche un rail marine
 * qui garde les 4 étapes sous les yeux AVEC la valeur déjà choisie (on sait
 * toujours où on en est et on peut revenir en arrière d'un clic), à droite
 * l'étape en cours. Le rail rappelle aussi la date de clôture de la paie,
 * qui décide du mois sur lequel l'annonce sera prise en compte.
 */
function FormulaireAnnonce({ annonce, mois, salaries, enCours, onEnregistrer, onAnnuler, t, i18n }) {
  const [etape, setEtape] = useState(1);
  const [type, setType] = useState(annonce?.type || 'rib');
  const [general, setGeneral] = useState(annonce ? !annonce.salarie : false);
  const [salarie, setSalarie] = useState(annonce?.salarie || '');
  const [dateEffet, setDateEffet] = useState(annonce?.date_effet || '');
  const [donnees, setDonnees] = useState(annonce?.donnees || {});
  const [message, setMessage] = useState(annonce?.message || '');
  const [fichier, setFichier] = useState(null);
  const [inclureExport, setInclureExport] = useState(annonce ? !!annonce.inclure_export : true);

  const champs = CHAMPS_PAR_TYPE[type] || [];
  const typeCourant = TYPE_PAR_CLE[type] || TYPE_PAR_CLE.info;

  const dateCloture = useMemo(() => {
    if (!mois) return null;
    const [annee, m] = mois.split('-').map(Number);
    return new Date(annee, m - 1, JOUR_CLOTURE_PAIE);
  }, [mois]);

  const moisLibelle = useMemo(() => {
    if (!mois) return '';
    const [annee, m] = mois.split('-').map(Number);
    const libelle = new Date(annee, m - 1, 1).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
    return libelle.charAt(0).toUpperCase() + libelle.slice(1);
  }, [mois, i18n.language]);

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString(i18n.language) : '');
  const nomAffiche = general ? t('annoncesPaie.tousLesSalaries') : salarie;

  const peutAvancer = etape === 1 ? !!type
    : etape === 2 ? (general || !!salarie)
      : etape === 3 ? (type === 'rib' ? !!donnees.iban : !!message.trim())
        : true;

  function enregistrer(statut) {
    onEnregistrer({
      type,
      salarie: general ? '' : salarie,
      date_effet: dateEffet || '',
      donnees,
      message,
      inclure_export: inclureExport,
      statut,
    }, fichier);
  }

  return (
    <div
      role='dialog'
      aria-label={t('annoncesPaie.titreForm')}
      className='w-full max-w-3xl my-8 rounded-2xl border border-border bg-card shadow-xl overflow-hidden flex flex-col'
      onClick={(e) => e.stopPropagation()}
    >
      <section className='flex flex-col min-w-0'>
        {/* En-tête : le mois et l'étape tiennent sur une ligne, la
            progression se lit d'un coup d'œil juste en dessous. */}
        <div className='flex items-start justify-between gap-3 px-7 pt-6'>
          <div className='min-w-0'>
            <h2 className='text-[17px] font-bold text-foreground'>{t('annoncesPaie.titreForm')}</h2>
            <span className='block text-xs text-muted-foreground mt-0.5'>
              {moisLibelle ? `${moisLibelle} · ` : ''}{t('annoncesPaie.etapeSur', { n: etape, titre: t(`annoncesPaie.etapeForm_${etape}`) })}
            </span>
          </div>
          <button type='button' onClick={onAnnuler} aria-label={t('annoncesPaie.fermer')} className='w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors'>
            <LuX size={17} />
          </button>
        </div>

        <ol className='grid grid-cols-4 gap-1.5 px-7 pt-4'>
          {[1, 2, 3, 4].map((n) => (
            <li key={n}>
              <button
                type='button'
                onClick={() => n < etape && setEtape(n)}
                disabled={n >= etape}
                aria-current={n === etape ? 'step' : undefined}
                aria-label={t(`annoncesPaie.etapeForm_${n}`)}
                className={`block w-full h-1 rounded-sm transition-colors ${n <= etape ? 'bg-primary' : 'bg-border'} ${n < etape ? 'cursor-pointer hover:bg-primary/80' : ''}`}
              />
            </li>
          ))}
        </ol>

        <div className='flex-1 px-7 pt-2 pb-6'>
          <h2 className='text-2xl font-semibold text-foreground mb-1'>{t(`annoncesPaie.titreEtape_${etape}`)}</h2>
          <p className='text-sm text-muted-foreground mb-5 max-w-[60ch]'>{t(`annoncesPaie.leadEtape_${etape}`)}</p>

          {etape === 1 && (
            <div role='radiogroup' aria-label={t('annoncesPaie.etapeForm_1')} className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5'>
              {TYPES.map((ty) => {
                const choisi = type === ty.cle;
                // Sur trois colonnes, une icône à côté du texte laisse trop
                // peu de largeur au libellé : les cartes s'empilent en
                // titre / description / pièce attendue.
                return (
                  <button
                    key={ty.cle}
                    type='button'
                    role='radio'
                    aria-checked={choisi}
                    onClick={() => { setType(ty.cle); setDonnees({}); }}
                    className={`flex flex-col gap-1.5 rounded-lg border-[1.5px] p-3.5 text-left min-h-[120px] transition-colors ${choisi ? 'border-primary bg-primary/5' : `${ty.pointille ? 'border-dashed' : ''} border-border hover:border-primary/40`}`}
                  >
                    <b className='text-sm font-semibold text-foreground'>{t(`annoncesPaie.type_${ty.cle}`)}</b>
                    <small className='flex-1 text-xs text-muted-foreground leading-snug'>{t(`annoncesPaie.sousTitre_${ty.cle}`)}</small>
                    <span className='self-start rounded px-1.5 py-0.5 text-[11px] bg-muted text-muted-foreground'>
                      {t(`annoncesPaie.piece_${ty.cle}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {etape === 2 && (
            <div className='flex flex-col gap-4'>
              <div>
                <span className={LABEL_CLASSES}>{t('annoncesPaie.etapeForm_2')}</span>
                <SelectRecherchable
                  options={[
                    { value: '', label: t('annoncesPaie.tousLesSalaries') },
                    ...salaries.map((nom) => ({ value: nom, label: nom })),
                  ]}
                  value={general ? '' : salarie}
                  onChange={(valeur) => { setGeneral(!valeur); setSalarie(valeur); }}
                  placeholder={t('annoncesPaie.rechercherSalarie')}
                />
              </div>

              {nomAffiche && (
                <div className='flex items-center gap-3 rounded-xl border-[1.5px] border-border bg-muted/40 p-3'>
                  <span className='w-9 h-9 shrink-0 rounded-full bg-primary text-white grid place-items-center text-[11px] font-bold'>
                    {general ? '★' : getInitials(nomAffiche)}
                  </span>
                  <span className='min-w-0'>
                    <b className='block text-sm font-semibold text-foreground truncate'>{nomAffiche}</b>
                    <span className='block text-[12.5px] text-muted-foreground'>
                      {general ? t('annoncesPaie.porteeGenerale') : t('annoncesPaie.personnelInterne')}
                    </span>
                  </span>
                </div>
              )}

              <label className='block sm:max-w-[50%]'>
                <span className={LABEL_CLASSES}>{t('annoncesPaie.dateEffet')}</span>
                <input type='date' value={dateEffet} onChange={(e) => setDateEffet(e.target.value)} className={CHAMP_CLASSES} />
                {dateCloture && (
                  <span className='block text-xs text-muted-foreground mt-1.5'>
                    {t('annoncesPaie.indiceCloture', { jour: JOUR_CLOTURE_PAIE })}
                  </span>
                )}
              </label>
            </div>
          )}

          {etape === 3 && (
            <div className='grid sm:grid-cols-2 gap-4'>
              {champs.map((champ) => {
                const saisi = donnees[champ] || '';
                const anomalie = champ === 'iban' ? (saisi && !ibanValide(saisi))
                  : champ === 'bic' ? (saisi && !bicValide(saisi))
                    : false;
                return (
                  <label key={champ} className={champ === 'iban' ? 'block sm:col-span-2' : 'block'}>
                    <span className={LABEL_CLASSES}>{t(`annoncesPaie.champ_${champ}`)}</span>
                    <input
                      type='text'
                      value={saisi}
                      onChange={(e) => setDonnees((d) => ({ ...d, [champ]: normaliserChamp(champ, e.target.value) }))}
                      placeholder={champ === 'titulaire' ? (nomAffiche || '') : PLACEHOLDERS_RIB[champ]}
                      autoComplete='off'
                      spellCheck={false}
                      className={`${CHAMP_CLASSES} ${champ === 'iban' ? 'font-mono tracking-wide' : ''} ${anomalie ? 'border-destructive focus:ring-destructive/30' : ''}`}
                      aria-invalid={anomalie || undefined}
                    />
                    {anomalie && (
                      <span className='flex items-center gap-1.5 text-xs text-destructive mt-1.5'>
                        <LuAlertTriangle size={12} className='shrink-0' /> {t(`annoncesPaie.erreur_${champ}`)}
                      </span>
                    )}
                    {champ === 'iban' && saisi && !anomalie && (
                      <span className='flex items-center gap-1.5 text-xs text-green-700 mt-1.5'>
                        <LuCheckCheck size={12} className='shrink-0' /> {t('annoncesPaie.ibanValide')}
                      </span>
                    )}
                    {champ === 'titulaire' && (
                      <span className='block text-xs text-muted-foreground mt-1.5'>{t('annoncesPaie.indiceTitulaire')}</span>
                    )}
                  </label>
                );
              })}
              <label className='block sm:col-span-2'>
                <span className={LABEL_CLASSES}>
                  {type === 'rib' ? t('annoncesPaie.commentaireCabinet') : t('annoncesPaie.details')}
                </span>
                <textarea
                  rows={type === 'rib' ? 3 : 5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={type === 'rib' ? t('annoncesPaie.commentairePlaceholder') : ''}
                  className={CHAMP_CLASSES}
                />
              </label>
            </div>
          )}

          {etape === 4 && (
            <div className='flex flex-col gap-3'>
              {/* La pièce attendue dépend du type : la rappeler ici évite
                  d'avoir à remonter à l'étape 1 pour s'en souvenir. */}
              <p className='text-sm text-foreground'>
                {t('annoncesPaie.pieceAttendue', { piece: t(`annoncesPaie.piece_${typeCourant.cle}`).toLowerCase() })}
              </p>
              {!fichier && !annonce?.piece_jointe && TYPES_JUSTIFICATIF_ATTENDU.includes(type) && (
                <p className='inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-foreground'>
                  <LuAlertTriangle size={14} className='text-destructive shrink-0' /> {t('annoncesPaie.justificatifConseille')}
                </p>
              )}
              <label className='flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-border bg-muted/40 px-4 py-6 text-center cursor-pointer hover:bg-muted/60 transition-colors'>
                <LuPaperclip size={20} className='text-muted-foreground' />
                <b className='text-sm font-semibold text-foreground'>{t('annoncesPaie.deposerJustificatif')}</b>
                <span className='text-xs text-muted-foreground'>{t('annoncesPaie.formatsAcceptes')}</span>
                <input
                  type='file'
                  accept='application/pdf,image/jpeg,image/png'
                  className='hidden'
                  onChange={(e) => setFichier(e.target.files?.[0] || null)}
                />
              </label>

              {(fichier || annonce?.piece_jointe_nom) && (
                <div className='flex items-center gap-3 rounded-xl border-[1.5px] border-border px-3.5 py-3'>
                  <LuPaperclip size={15} className='text-muted-foreground shrink-0' />
                  <span className='min-w-0 flex-1'>
                    <b className='block text-sm font-semibold text-foreground truncate'>{fichier?.name || annonce.piece_jointe_nom}</b>
                    {fichier && <span className='block text-xs text-muted-foreground'>{Math.round(fichier.size / 1024)} Ko</span>}
                  </span>
                  <span className='text-[13px] font-semibold text-green-700 shrink-0'>{t('annoncesPaie.fichierAjoute')}</span>
                </div>
              )}

              <div className='rounded-xl border-[1.5px] border-border overflow-hidden'>
                <h3 className='px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b border-border'>
                  {t('annoncesPaie.recapitulatif')}
                </h3>
                <dl className='grid grid-cols-[minmax(110px,160px)_minmax(0,1fr)]'>
                  {[
                    [t('annoncesPaie.etapeForm_1'), t(`annoncesPaie.type_${type}`)],
                    [t('annoncesPaie.etapeForm_2'), nomAffiche || '—'],
                    [t('annoncesPaie.dateEffet'), dateEffet ? formatDate(dateEffet) : '—'],
                    ...(type === 'rib' ? [
                      [t('annoncesPaie.champ_iban'), donnees.iban || '—'],
                      [t('annoncesPaie.champ_titulaire'), donnees.titulaire || '—'],
                    ] : []),
                  ].map(([cle, valeur], i, tableau) => (
                    <React.Fragment key={cle}>
                      <dt className={`px-3.5 py-2.5 text-sm text-muted-foreground ${i < tableau.length - 1 ? 'border-b border-border' : ''}`}>{cle}</dt>
                      <dd className={`px-3.5 py-2.5 text-sm font-medium text-foreground break-words ${i < tableau.length - 1 ? 'border-b border-border' : ''}`}>{valeur}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>

              <label className='flex items-center gap-2.5 text-sm text-foreground'>
                <input type='checkbox' checked={inclureExport} onChange={(e) => setInclureExport(e.target.checked)} className='w-4 h-4 accent-primary' />
                {t('annoncesPaie.inclureExport')}
              </label>
            </div>
          )}
        </div>

        <div className='flex items-center gap-2.5 border-t border-border px-7 py-4'>
          <span className='mr-auto text-[12px] text-amber-700 dark:text-amber-500'>
            {dateCloture ? t('annoncesPaie.cloture', { date: dateCloture.toLocaleDateString(i18n.language) }) : (annonce?.reference || '')}
          </span>
          {etape > 1 && (
            <button type='button' onClick={() => setEtape((n) => n - 1)} className='rounded-lg px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors'>
              {t('annoncesPaie.precedent')}
            </button>
          )}
          {etape < 4 ? (
            <button
              type='button'
              onClick={() => setEtape((n) => n + 1)}
              disabled={!peutAvancer}
              className='rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
            >
              {t('annoncesPaie.suivant')}
            </button>
          ) : (
            <>
              <button type='button' disabled={enCours} onClick={() => enregistrer('brouillon')} className='rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50 transition-colors'>
                {t('annoncesPaie.enregistrerBrouillon')}
              </button>
              <button type='button' disabled={enCours} onClick={() => enregistrer('a_transmettre')} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors'>
                {enCours ? <LuLoader size={14} className='animate-spin' /> : <LuSend size={14} />} {t('annoncesPaie.envoyerAuCabinet')}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * `onCompteurs` remonte au parent de quoi afficher l'alerte « pièce
 * manquante » avant de valider le mois.
 */
function AnnoncesPaie({ mois, verrouille, salaries = [], onCompteurs }) {
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
  const [annonces, setAnnonces] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [vue, setVue] = useState('liste');
  const [selection, setSelection] = useState(null);
  const [onglet, setOnglet] = useState('todo');
  const [filtreType, setFiltreType] = useState('');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const [deplies, setDeplies] = useState([]);
  const [enCours, setEnCours] = useState(false);

  const formatDate = useCallback((d) => (d ? new Date(d).toLocaleDateString(i18n.language) : ''), [i18n.language]);

  const charger = useCallback(() => {
    if (!mois) return;
    getAnnoncesPaie(mois)
      .then(async (res) => { if (res.status === 200) setAnnonces(await res.json()); })
      .catch(() => {});
  }, [mois]);

  useEffect(() => { charger(); }, [charger]);

  const piecesManquantes = useMemo(() => annonces.filter((a) => a.piece_manquante).length, [annonces]);
  // Remonté au parent pour l'alerte avant validation du mois et pour que les
  // exports Excel/PDF puissent reprendre les annonces cochées.
  useEffect(() => {
    onCompteurs?.({ total: annonces.length, piecesManquantes, annonces });
  }, [annonces, piecesManquantes, onCompteurs]);

  const filtrees = useMemo(() => {
    const statuts = ONGLETS.find((o) => o.cle === onglet)?.statuts;
    const q = recherche.trim().toLowerCase();
    return annonces.filter((a) => {
      if (statuts && !statuts.includes(a.statut)) return false;
      if (filtreType && a.type !== filtreType) return false;
      if (q && !String(a.salarie || t('annoncesPaie.tousLesSalaries')).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [annonces, onglet, filtreType, recherche, t]);

  // Une ligne par salarié, pas par annonce : avec plusieurs annonces par
  // personne, la liste à plat devient vite illisible.
  const groupes = useMemo(() => {
    const parSalarie = new Map();
    filtrees.forEach((a) => {
      const cle = a.salarie || t('annoncesPaie.tousLesSalaries');
      if (!parSalarie.has(cle)) parSalarie.set(cle, []);
      parSalarie.get(cle).push(a);
    });
    return [...parSalarie.entries()].map(([nom, items]) => ({ nom, items }));
  }, [filtrees, t]);

  const nbPages = Math.max(1, Math.ceil(groupes.length / SALARIES_PAR_PAGE));
  const pageSure = Math.min(page, nbPages);
  const groupesPage = groupes.slice((pageSure - 1) * SALARIES_PAR_PAGE, pageSure * SALARIES_PAR_PAGE);

  useEffect(() => { setPage(1); }, [onglet, filtreType, recherche]);

  async function enregistrer(donnees, fichier) {
    setEnCours(true);
    const charge = { ...donnees, ...(selection ? {} : { mois }) };
    const res = selection
      ? await updateAnnoncePaie(selection.id, charge, fichier).catch(() => null)
      : await createAnnoncePaie(charge, fichier).catch(() => null);
    setEnCours(false);

    if (!res || (res.status !== 200 && res.status !== 201)) {
      toast.error(t('annoncesPaie.enregistrementEchoue'));
      return;
    }
    toast.success(t('annoncesPaie.enregistree'));
    setVue('liste');
    setSelection(null);
    charger();
  }

  async function changerStatut(annonce, statut) {
    const res = await changerStatutAnnoncePaie(annonce.id, statut).catch(() => null);
    if (!res || res.status !== 200) {
      toast.error(t('annoncesPaie.enregistrementEchoue'));
      return;
    }
    const maj = await res.json();
    setSelection(maj);
    charger();
  }

  async function supprimer(annonce) {
    const ok = await confirm({
      title: t('annoncesPaie.supprimerTitre'),
      message: t('annoncesPaie.supprimerTexte'),
      confirmLabel: t('annoncesPaie.supprimer'),
      danger: true,
    });
    if (!ok) return;

    const res = await deleteAnnoncePaie(annonce.id).catch(() => null);
    if (!res || res.status !== 200) {
      toast.error(t('annoncesPaie.suppressionEchouee'));
      return;
    }
    toast.success(t('annoncesPaie.supprimee'));
    setVue('liste');
    setSelection(null);
    charger();
  }

  const salariesApercu = [...new Set(annonces.map((a) => a.salarie).filter(Boolean))];

  return (
    <>
      <button
        onClick={() => { setOuvert(true); setVue('liste'); setSelection(null); }}
        className='animate-tuile-apparait relative text-left border border-primary/25 rounded-xl p-4 bg-card hover:bg-muted/40 hover:border-primary/45 hover:-translate-y-0.5 transition-all'
      >
        <span className={`absolute top-3.5 right-3.5 min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold tabular-nums flex items-center justify-center ${annonces.length ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
          {annonces.length}
        </span>
        <span className='w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-accent/15 text-accent-foreground'>
          <LuMegaphone size={17} />
        </span>
        <h4 className='text-sm font-semibold text-foreground mb-0.5'>{t('annoncesPaie.titre')}</h4>
        <p className='text-xs text-muted-foreground leading-snug'>{t('annoncesPaie.description')}</p>
        {salariesApercu.length > 0 && (
          <div className='flex items-center mt-3'>
            {salariesApercu.slice(0, 3).map((nom, idx) => (
              <span key={nom} style={{ marginLeft: idx === 0 ? 0 : -6 }} className='w-[22px] h-[22px] rounded-full bg-primary text-white text-[8.5px] font-bold flex items-center justify-center border-2 border-card'>
                {getInitials(nom)}
              </span>
            ))}
            {salariesApercu.length > 3 && <span className='text-[10.5px] text-muted-foreground ml-1.5'>+{salariesApercu.length - 3}</span>}
          </div>
        )}
        {piecesManquantes > 0 && (
          <p className='mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-destructive'>
            <LuAlertTriangle size={12} /> {t('annoncesPaie.piecesManquantes', { count: piecesManquantes })}
          </p>
        )}
      </button>

      {ouvert && (
        <div className='fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto' onClick={() => setOuvert(false)}>
          {vue === 'formulaire' ? (
            <FormulaireAnnonce
              annonce={selection}
              mois={mois}
              salaries={salaries}
              enCours={enCours}
              onEnregistrer={enregistrer}
              onAnnuler={() => { setVue('liste'); setSelection(null); }}
              t={t}
              i18n={i18n}
            />
          ) : (
          <div
            role='dialog'
            aria-label={t('annoncesPaie.titre')}
            className='w-full max-w-2xl rounded-2xl bg-card border border-border shadow-xl my-8'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center gap-3 border-b border-border px-5 py-4'>
              <span className='w-9 h-9 rounded-lg flex items-center justify-center bg-accent/15 text-accent-foreground shrink-0'>
                <LuMegaphone size={17} />
              </span>
              <div className='flex-1 min-w-0'>
                <h3 className='text-base font-semibold text-foreground'>{t('annoncesPaie.titre')}</h3>
                <p className='text-xs text-muted-foreground'>{t('annoncesPaie.description')}</p>
              </div>
              {vue === 'liste' && !verrouille && (
                <button
                  onClick={() => { setSelection(null); setVue('formulaire'); }}
                  className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'
                >
                  <LuPlus size={15} /> {t('annoncesPaie.nouvelle')}
                </button>
              )}
              <button onClick={() => setOuvert(false)} aria-label={t('annoncesPaie.fermer')} className='w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors'>
                <LuX size={17} />
              </button>
            </div>

            <div className='p-5'>
              {vue === 'fiche' && selection && (
                <FicheAnnonce
                  annonce={selection}
                  verrouille={verrouille}
                  onFermer={() => { setVue('liste'); setSelection(null); }}
                  onModifier={(a) => { setSelection(a); setVue('formulaire'); }}
                  onStatut={changerStatut}
                  onSupprimer={supprimer}
                  t={t}
                  formatDate={formatDate}
                />
              )}

              {vue === 'liste' && (
                <div className='flex flex-col gap-3'>
                  <div className='flex gap-1 p-1 rounded-lg bg-muted'>
                    {ONGLETS.map((o) => (
                      <button
                        key={o.cle}
                        onClick={() => setOnglet(o.cle)}
                        aria-pressed={onglet === o.cle}
                        className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${onglet === o.cle ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {t(`annoncesPaie.onglet_${o.cle}`)}
                      </button>
                    ))}
                  </div>

                  <div className='flex flex-wrap items-center gap-2'>
                    <MenuDeroulant
                      value={filtreType}
                      onChange={setFiltreType}
                      options={[
                        { value: '', label: t('annoncesPaie.tousLesTypes') },
                        ...TYPES.map((ty) => ({ value: ty.cle, label: t(`annoncesPaie.type_${ty.cle}`) })),
                      ]}
                      boutonClassName='h-9'
                    />
                    <div className='relative flex-1 min-w-[160px]'>
                      <LuSearch size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none' />
                      <input
                        type='search'
                        value={recherche}
                        onChange={(e) => setRecherche(e.target.value)}
                        placeholder={t('annoncesPaie.rechercherSalarie')}
                        className='w-full h-9 rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                      />
                    </div>
                  </div>

                  {groupesPage.length === 0 && (
                    <p className='py-10 text-center text-sm text-muted-foreground'>{t('annoncesPaie.aucuneAnnonce')}</p>
                  )}

                  <div className='flex flex-col gap-2'>
                    {groupesPage.map(({ nom, items }) => {
                      const deplie = deplies.includes(nom);
                      const alerte = items.some((a) => a.piece_manquante);
                      return (
                        <div key={nom} className='rounded-xl border border-border overflow-hidden'>
                          <button
                            onClick={() => setDeplies((d) => (d.includes(nom) ? d.filter((x) => x !== nom) : [...d, nom]))}
                            aria-expanded={deplie}
                            className='flex w-full items-center gap-2.5 px-3.5 py-3 text-left hover:bg-muted/40 transition-colors'
                          >
                            <span className='w-8 h-8 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center shrink-0'>{getInitials(nom)}</span>
                            <span className='flex-1 min-w-0'>
                              <span className='block text-sm font-semibold text-foreground truncate'>{nom}</span>
                              <span className='block text-xs text-muted-foreground'>
                                {items.length > 1 ? t('annoncesPaie.nAnnonces', { count: items.length }) : t(`annoncesPaie.type_${items[0].type}`)}
                              </span>
                            </span>
                            <span className='flex items-center gap-1 shrink-0'>
                              {[...new Set(items.map((a) => a.type))].map((ty) => {
                                const Icone = (TYPE_PAR_CLE[ty] || TYPE_PAR_CLE.info).icone;
                                return <span key={ty} className={`w-6 h-6 rounded-md flex items-center justify-center ${(TYPE_PAR_CLE[ty] || TYPE_PAR_CLE.info).ton}`}><Icone size={12} /></span>;
                              })}
                            </span>
                            {alerte && <LuAlertTriangle size={14} className='text-destructive shrink-0' />}
                            <LuChevronDown size={15} className={`text-muted-foreground shrink-0 transition-transform ${deplie ? 'rotate-180' : ''}`} />
                          </button>
                          {deplie && (
                            <ul className='border-t border-border divide-y divide-border'>
                              {items.map((a) => (
                                <li key={a.id}>
                                  <button
                                    onClick={() => { setSelection(a); setVue('fiche'); }}
                                    className='flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-muted/40 transition-colors'
                                  >
                                    <span className='flex-1 min-w-0'>
                                      <span className='block text-sm text-foreground truncate'>{t(`annoncesPaie.type_${a.type}`)}</span>
                                      <span className='block text-xs text-muted-foreground'>
                                        {a.date_effet ? formatDate(a.date_effet) : formatDate(a.created_at)}
                                        {a.piece_manquante ? ` · ${t('annoncesPaie.justificatifManquantCourt')}` : ''}
                                      </span>
                                    </span>
                                    <Pastille statut={a.statut} t={t} />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {groupes.length > SALARIES_PAR_PAGE && (
                    <div className='flex items-center justify-between gap-2 pt-1'>
                      <span className='text-xs text-muted-foreground tabular-nums'>
                        {t('annoncesPaie.repere', {
                          debut: (pageSure - 1) * SALARIES_PAR_PAGE + 1,
                          fin: Math.min(pageSure * SALARIES_PAR_PAGE, groupes.length),
                          total: groupes.length,
                          annonces: filtrees.length,
                        })}
                      </span>
                      <span className='flex items-center gap-1'>
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSure <= 1} aria-label={t('annoncesPaie.precedent')} className='w-8 h-8 rounded-lg border border-border flex items-center justify-center disabled:opacity-40 hover:bg-muted transition-colors'>
                          <LuChevronLeft size={15} />
                        </button>
                        <button onClick={() => setPage((p) => Math.min(nbPages, p + 1))} disabled={pageSure >= nbPages} aria-label={t('annoncesPaie.suivant')} className='w-8 h-8 rounded-lg border border-border flex items-center justify-center disabled:opacity-40 hover:bg-muted transition-colors'>
                          <LuChevronRight size={15} />
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}
    </>
  );
}

export default AnnoncesPaie;
