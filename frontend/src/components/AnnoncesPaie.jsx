import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  LuMegaphone, LuBanknote, LuMapPin, LuUsers, LuHeartPulse, LuInfo, LuPaperclip,
  LuAlertTriangle, LuSend, LuCheckCheck, LuChevronDown, LuArrowRight, LuEye,
  LuPlus, LuX, LuTrash2, LuPencil, LuSearch, LuChevronLeft, LuChevronRight, LuLoader,
} from 'react-icons/lu';
import {
  getAnnoncesPaie, createAnnoncePaie, updateAnnoncePaie,
  changerStatutAnnoncePaie, deleteAnnoncePaie, urlPieceAnnoncePaie,
} from '../api/routes/annoncePaie';
import { useConfirm } from '../contexts/ConfirmDialogContext';
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
  { cle: 'info', icone: LuInfo, ton: 'bg-muted text-muted-foreground' },
];
const TYPE_PAR_CLE = Object.fromEntries(TYPES.map((t) => [t.cle, t]));

/** Champs « ancienne / nouvelle valeur » par type — miroir de AnnoncePaie::CHAMPS. */
const CHAMPS_PAR_TYPE = {
  rib: ['ancienne', 'nouvelle', 'banque'],
  adresse: ['ancienne', 'nouvelle'],
  situation_familiale: ['ancienne', 'nouvelle'],
  mutuelle: ['ancienne', 'nouvelle'],
  info: [],
};
const TYPES_JUSTIFICATIF_ATTENDU = ['rib', 'adresse', 'situation_familiale', 'mutuelle'];

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

/** Formulaire en 4 étapes : type, salarié, valeurs, justificatif. */
function FormulaireAnnonce({ annonce, salaries, enCours, onEnregistrer, onAnnuler, t }) {
  const [etape, setEtape] = useState(1);
  const [type, setType] = useState(annonce?.type || '');
  const [general, setGeneral] = useState(annonce ? !annonce.salarie : false);
  const [salarie, setSalarie] = useState(annonce?.salarie || '');
  const [rechercheSalarie, setRechercheSalarie] = useState('');
  const [dateEffet, setDateEffet] = useState(annonce?.date_effet || '');
  const [donnees, setDonnees] = useState(annonce?.donnees || {});
  const [message, setMessage] = useState(annonce?.message || '');
  const [fichier, setFichier] = useState(null);
  const [inclureExport, setInclureExport] = useState(annonce ? !!annonce.inclure_export : true);

  const champs = CHAMPS_PAR_TYPE[type] || [];
  const salariesFiltres = useMemo(() => {
    const q = rechercheSalarie.trim().toLowerCase();
    return q ? salaries.filter((s) => s.toLowerCase().includes(q)) : salaries;
  }, [salaries, rechercheSalarie]);

  const peutAvancer = etape === 1 ? !!type
    : etape === 2 ? (general || !!salarie)
      : etape === 3 ? (type === 'info' ? !!message.trim() : !!donnees.nouvelle)
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
    <div className='flex flex-col gap-4'>
      <ol className='flex items-center gap-1.5'>
        {[1, 2, 3, 4].map((n) => (
          <li key={n} className='flex-1'>
            <button
              type='button'
              onClick={() => n < etape && setEtape(n)}
              disabled={n > etape}
              className={`w-full h-1.5 rounded-full transition-colors ${n <= etape ? 'bg-primary' : 'bg-border'} ${n < etape ? 'cursor-pointer' : ''}`}
              aria-label={t(`annoncesPaie.etapeForm_${n}`)}
            />
          </li>
        ))}
      </ol>
      <p className='text-sm font-semibold text-foreground'>{etape}. {t(`annoncesPaie.etapeForm_${etape}`)}</p>

      {etape === 1 && (
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5'>
          {TYPES.map((ty) => {
            const Icone = ty.icone;
            return (
              <button
                key={ty.cle}
                type='button'
                onClick={() => { setType(ty.cle); setDonnees({}); }}
                aria-pressed={type === ty.cle}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${type === ty.cle ? 'border-primary bg-primary/5 text-foreground' : 'border-border hover:bg-muted text-muted-foreground'}`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ty.ton}`}><Icone size={15} /></span>
                {t(`annoncesPaie.type_${ty.cle}`)}
              </button>
            );
          })}
        </div>
      )}

      {etape === 2 && (
        <div className='flex flex-col gap-2.5'>
          <button
            type='button'
            onClick={() => { setGeneral(true); setSalarie(''); }}
            aria-pressed={general}
            className={`rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${general ? 'border-primary bg-primary/5 text-foreground' : 'border-border hover:bg-muted text-muted-foreground'}`}
          >
            {t('annoncesPaie.tousLesSalaries')}
          </button>
          <div className='relative'>
            <LuSearch size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none' />
            <input
              type='search'
              value={rechercheSalarie}
              onChange={(e) => setRechercheSalarie(e.target.value)}
              placeholder={t('annoncesPaie.rechercherSalarie')}
              className={`${CHAMP_CLASSES} pl-9`}
            />
          </div>
          <div className='max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border'>
            {salariesFiltres.length === 0 && (
              <p className='px-3.5 py-3 text-sm text-muted-foreground'>{t('annoncesPaie.aucunSalarie')}</p>
            )}
            {salariesFiltres.map((nom) => (
              <button
                key={nom}
                type='button'
                onClick={() => { setSalarie(nom); setGeneral(false); }}
                aria-pressed={!general && salarie === nom}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors ${!general && salarie === nom ? 'bg-primary/5 font-semibold text-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              >
                <span className='w-7 h-7 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center shrink-0'>{getInitials(nom)}</span>
                {nom}
              </button>
            ))}
          </div>
        </div>
      )}

      {etape === 3 && (
        <div className='flex flex-col gap-3'>
          <label className='block'>
            <span className='block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5'>{t('annoncesPaie.dateEffet')}</span>
            <input type='date' value={dateEffet} onChange={(e) => setDateEffet(e.target.value)} className={CHAMP_CLASSES} />
          </label>
          {champs.map((champ) => (
            <label key={champ} className='block'>
              <span className='block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5'>
                {t(`annoncesPaie.champ_${champ}`)}
              </span>
              <input
                type='text'
                value={donnees[champ] || ''}
                onChange={(e) => setDonnees((d) => ({ ...d, [champ]: e.target.value }))}
                className={CHAMP_CLASSES}
              />
            </label>
          ))}
          <label className='block'>
            <span className='block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5'>{t('annoncesPaie.messagePaie')}</span>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={CHAMP_CLASSES} />
          </label>
        </div>
      )}

      {etape === 4 && (
        <div className='flex flex-col gap-3'>
          <label className='flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center cursor-pointer hover:bg-muted/40 transition-colors'>
            <LuPaperclip size={20} className='text-muted-foreground' />
            <span className='text-sm font-medium text-foreground'>
              {fichier ? fichier.name : annonce?.piece_jointe_nom || t('annoncesPaie.deposerJustificatif')}
            </span>
            <span className='text-xs text-muted-foreground'>{t('annoncesPaie.formatsAcceptes')}</span>
            <input
              type='file'
              accept='application/pdf,image/jpeg,image/png'
              className='hidden'
              onChange={(e) => setFichier(e.target.files?.[0] || null)}
            />
          </label>
          {!fichier && !annonce?.piece_jointe && TYPES_JUSTIFICATIF_ATTENDU.includes(type) && (
            <p className='inline-flex items-center gap-2 text-sm text-muted-foreground'>
              <LuAlertTriangle size={14} className='text-destructive shrink-0' /> {t('annoncesPaie.justificatifConseille')}
            </p>
          )}
          <label className='flex items-center gap-2.5 text-sm text-foreground'>
            <input type='checkbox' checked={inclureExport} onChange={(e) => setInclureExport(e.target.checked)} className='w-4 h-4 accent-primary' />
            {t('annoncesPaie.inclureExport')}
          </label>
        </div>
      )}

      <div className='flex flex-wrap items-center gap-2 pt-1'>
        {etape > 1 && (
          <button type='button' onClick={() => setEtape((n) => n - 1)} className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted transition-colors'>
            <LuChevronLeft size={14} /> {t('annoncesPaie.precedent')}
          </button>
        )}
        <button type='button' onClick={onAnnuler} className='inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'>
          {t('annoncesPaie.annuler')}
        </button>
        {etape < 4 ? (
          <button
            type='button'
            onClick={() => setEtape((n) => n + 1)}
            disabled={!peutAvancer}
            className='ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          >
            {t('annoncesPaie.suivant')} <LuChevronRight size={14} />
          </button>
        ) : (
          <div className='ml-auto flex items-center gap-2'>
            <button type='button' disabled={enCours} onClick={() => enregistrer('brouillon')} className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors'>
              {t('annoncesPaie.enregistrerBrouillon')}
            </button>
            <button type='button' disabled={enCours} onClick={() => enregistrer('a_transmettre')} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors'>
              {enCours ? <LuLoader size={14} className='animate-spin' /> : <LuCheckCheck size={14} />} {t('annoncesPaie.enregistrer')}
            </button>
          </div>
        )}
      </div>
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
              {vue === 'formulaire' && (
                <FormulaireAnnonce
                  annonce={selection}
                  salaries={salaries}
                  enCours={enCours}
                  onEnregistrer={enregistrer}
                  onAnnuler={() => { setVue('liste'); setSelection(null); }}
                  t={t}
                />
              )}

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
                    <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} className='h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'>
                      <option value=''>{t('annoncesPaie.tousLesTypes')}</option>
                      {TYPES.map((ty) => <option key={ty.cle} value={ty.cle}>{t(`annoncesPaie.type_${ty.cle}`)}</option>)}
                    </select>
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
        </div>
      )}
    </>
  );
}

export default AnnoncesPaie;
