import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuSearch, LuLoader, LuFileDown, LuFileSpreadsheet, LuArrowUp, LuArrowDown, LuArrowUpDown, LuPhoneIncoming, LuCheck, LuX, LuPencil, LuTrash2, LuInfo } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import FiligraneHIS from '../components/FiligraneHIS';
import AppelForm from '../components/AppelForm';
import { getAppels, marquerAppelTraite, deleteAppel } from '../api/routes/appel';
import { getDisplayName } from '../utils/common';
import { correspondARequete } from '../utils/recherche';
import { colonnesPdf, colonnesExcel, exporterAppelsPdf, exporterAppelsExcel } from '../utils/exportAppels';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import FiltrePeriode from '../components/FiltrePeriode';
import { PERIODE_VIDE, dateDansPeriode } from '../utils/periodes';
import Pagination from '../components/Pagination';

// Beaucoup d'appels reçus au quotidien — sans pagination, la liste s'étire
// et faire défiler jusqu'en bas devient pénible (retour utilisateur). 13 par
// page (au lieu de 25) pour que chaque page tienne sans trop défiler.
const APPELS_PAR_PAGE = 13;

const ACTION_STYLES = {
  'Rappeler': 'text-accent-foreground',
  'Rappeler URGENT': 'text-destructive',
  'Rappellera': 'text-primary',
  'Pour info': 'text-muted-foreground',
};

function construireColonnes(t) {
  return [
    { cle: 'numero_registre', label: t('appelsTelephoniques.colNumero') },
    { cle: 'date_appel', label: t('appelsTelephoniques.colDate'), type: 'date' },
    { cle: 'heure_appel', label: t('appelsTelephoniques.colHeure') },
    { cle: 'agent', label: t('appelsTelephoniques.colAgent') },
    { cle: 'appelant_nom', label: t('appelsTelephoniques.colAppelant') },
    { cle: 'appelant_telephone', label: t('appelsTelephoniques.colTelephone') },
    { cle: 'appelant_organisation', label: t('appelsTelephoniques.colOrganisation') },
    { cle: 'appelant_qualite', label: t('appelsTelephoniques.colQualite') },
    { cle: 'appelant_email', label: t('appelsTelephoniques.colEmail') },
    { cle: 'objet', label: t('appelsTelephoniques.colObjet') },
    { cle: 'message', label: t('appelsTelephoniques.colMessage') },
    { cle: 'personneConcernee', label: t('appelsTelephoniques.colPersonneConcernee') },
    { cle: 'action', label: t('appelsTelephoniques.colAction') },
    { cle: 'traite', label: t('appelsTelephoniques.colTraite') },
  ];
}

function personneConcernee(a) {
  if (a.personnel_concerne) return `${a.personnel_concerne.prenom || ''} ${a.personnel_concerne.nom || ''}`.trim();
  return a.personne_concernee_texte || '';
}

function valeurCellule(a, cle) {
  if (['action', 'traite', 'numero_registre', 'agent', 'personneConcernee'].includes(cle)) return null; // rendu à part
  const v = a[cle];
  if (v === null || v === undefined || v === '') return '—';
  if (cle === 'date_appel') return new Date(v).toLocaleDateString('fr-FR');
  return v;
}

/**
 * Registre des appels téléphoniques — même charpente sobre que Courriers.jsx
 * (quadrillage complet, tri par colonne, export PDF/Excel) ; en plus, le
 * formulaire de saisie rapide (AppelForm) reste ouvert juste au-dessus du
 * tableau pour enchaîner les appels sans changer de page.
 */
function AppelsTelephoniques() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appels, setAppels] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [formOuvert, setFormOuvert] = useState(false);
  const [appelEnEdition, setAppelEnEdition] = useState(null);
  const [appelATraiter, setAppelATraiter] = useState(null);
  const [noteTraitement, setNoteTraitement] = useState('');
  const [traitementEnCours, setTraitementEnCours] = useState(false);
  const [actionFiltre, setActionFiltre] = useState('tous');
  const [traiteFiltre, setTraiteFiltre] = useState('tous');
  const [periode, setPeriode] = useState(PERIODE_VIDE);
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState({ cle: 'numero_registre', sens: 'desc' });
  const [pageActuelle, setPageActuelle] = useState(1);
  const formRef = useRef(null);

  // Revient toujours en page 1 quand un filtre change — sinon on peut se
  // retrouver sur une page devenue vide après avoir filtré la liste.
  useEffect(() => { setPageActuelle(1); }, [actionFiltre, traiteFiltre, periode, recherche]);

  const colonnes = useMemo(() => construireColonnes(t), [t]);

  function fetchAppels() {
    return getAppels()
      .then((res) => (res.status === 200 ? res.json() : []))
      .then((data) => setAppels(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setChargement(false));
  }

  useEffect(() => { fetchAppels(); }, []);

  // Pas de sens à séparer (contrairement aux courriers entrants/sortants) —
  // un seul flux chronologique, le numéro de registre est donc juste l'id
  // complété de zéros.
  const appelsNumerotes = useMemo(
    () => appels.map((a) => ({ ...a, numero_registre: String(a.id).padStart(4, '0'), agent: getDisplayName({ personnel: a.utilisateur?.personnels?.[0] }) || a.utilisateur?.nom || '' })),
    [appels]
  );

  const appelsFiltres = useMemo(() => {
    return appelsNumerotes
      .filter((a) => actionFiltre === 'tous' || a.action === actionFiltre)
      .filter((a) => traiteFiltre === 'tous' || (traiteFiltre === 'traite' ? a.traite_le : !a.traite_le))
      .filter((a) => dateDansPeriode(a.date_appel, periode))
      .filter((a) => !recherche.trim() || correspondARequete(
        [
          a.appelant_nom,
          a.appelant_telephone,
          a.appelant_organisation,
          a.appelant_qualite,
          a.appelant_email,
          a.objet,
          a.message,
          a.oriente_nom,
          a.oriente_service,
          personneConcernee(a),
        ],
        recherche
      ));
  }, [appelsNumerotes, actionFiltre, traiteFiltre, periode, recherche]);

  const appelsAffiches = useMemo(() => {
    const copie = [...appelsFiltres];
    copie.sort((a, b) => {
      let va = tri.cle === 'personneConcernee' ? personneConcernee(a) : a[tri.cle];
      let vb = tri.cle === 'personneConcernee' ? personneConcernee(b) : b[tri.cle];
      if (tri.cle === 'date_appel') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else {
        va = (va || '').toString().toLowerCase();
        vb = (vb || '').toString().toLowerCase();
      }
      if (va < vb) return tri.sens === 'asc' ? -1 : 1;
      if (va > vb) return tri.sens === 'asc' ? 1 : -1;
      return 0;
    });
    return copie;
  }, [appelsFiltres, tri]);

  // Pagination : le compteur/export continuent d'utiliser appelsAffiches (la
  // liste filtrée complète), seul le tableau affiché est découpé par page.
  const totalPages = Math.max(1, Math.ceil(appelsAffiches.length / APPELS_PAR_PAGE));
  const appelsPage = useMemo(() => {
    const debut = (pageActuelle - 1) * APPELS_PAR_PAGE;
    return appelsAffiches.slice(debut, debut + APPELS_PAR_PAGE);
  }, [appelsAffiches, pageActuelle]);

  function trierPar(cle) {
    setTri((prev) => prev.cle === cle ? { cle, sens: prev.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: 'asc' });
  }

  function IconeTri({ cle }) {
    if (tri.cle !== cle) return <LuArrowUpDown size={11} className='text-muted-foreground/40' />;
    return tri.sens === 'asc' ? <LuArrowUp size={11} className='text-foreground' /> : <LuArrowDown size={11} className='text-foreground' />;
  }

  function ouvrirMarquerTraite(a, e) {
    e.stopPropagation();
    setNoteTraitement('');
    setAppelATraiter(a);
  }

  async function confirmerTraitement() {
    if (!appelATraiter) return;
    setTraitementEnCours(true);
    const res = await marquerAppelTraite(appelATraiter.id, noteTraitement.trim()).catch(() => null);
    setTraitementEnCours(false);
    if (res?.status === 200) {
      toast.success(t('appelsTelephoniques.appelMarqueTraite'));
      setAppelATraiter(null);
      fetchAppels();
    } else {
      const data = await res?.json().catch(() => ({})) ?? {};
      toast.error(data?.error || t('commun.erreurGenerique'));
    }
  }

  async function supprimerAppel(a, e) {
    e.stopPropagation();
    if (!await confirm({ message: t('appelsTelephoniques.confirmerSuppression'), danger: true })) return;
    const res = await deleteAppel(a.id).catch(() => null);
    if (res?.status === 200) {
      toast.success(t('appelsTelephoniques.appelSupprime'));
      fetchAppels();
    } else {
      toast.error(t('commun.erreurGenerique'));
    }
  }

  function ouvrirNouvelAppel() {
    setAppelEnEdition(null);
    setFormOuvert((v) => !v);
  }

  function ouvrirModification(a) {
    setFormOuvert(false);
    setAppelEnEdition(a);
    // Sur un registre déjà long, la ligne cliquée peut être loin en dessous
    // du formulaire (affiché tout en haut) : sans ça, "Modifier" semble ne
    // rien faire puisque rien ne bouge dans la zone visible à l'écran.
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // Arrivée depuis une notification ("un appel vous concerne", voir
  // AppelTelephoniqueNotification côté backend) : le lien pointe vers
  // /appels?appel=<id>, on ouvre directement le formulaire de modification
  // de cet appel dès que la liste est chargée, plutôt que de laisser
  // l'utilisateur le rechercher lui-même dans le registre.
  useEffect(() => {
    const appelIdCible = searchParams.get('appel');
    if (!appelIdCible || appels.length === 0) return;
    const cible = appels.find((a) => String(a.id) === appelIdCible);
    if (cible) ouvrirModification(cible);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appels]);

  function appelModifie() {
    setAppelEnEdition(null);
    fetchAppels();
  }

  return (
    <div className='flex flex-col flex-grow py-6 gap-4'>
      <FiligraneHIS fixe opacite={0.12} />
      <Breadcrumbs where={t('sidebar.appels')} />

      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div>
          <h2 className='text-2xl font-semibold text-foreground'>{t('appelsTelephoniques.registreTitre')}</h2>
          <p className='text-sm text-muted-foreground mt-0.5'>{t('appelsTelephoniques.nResultats', { count: appelsAffiches.length })}</p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={ouvrirNouvelAppel}
            className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'
          >
            <LuPhoneIncoming size={15} /> {formOuvert ? t('appelsTelephoniques.fermerFormulaire') : t('appelsTelephoniques.nouvelAppel')}
          </button>
          <button
            onClick={() => exporterAppelsExcel(appelsAffiches, colonnesExcel(t))}
            disabled={appelsAffiches.length === 0}
            className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <LuFileSpreadsheet size={15} /> {t('appelsTelephoniques.exporterExcel')}
          </button>
          <button
            onClick={() => exporterAppelsPdf(appelsAffiches, colonnesPdf(t), t('appelsTelephoniques.registreTitre'))}
            disabled={appelsAffiches.length === 0}
            className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <LuFileDown size={15} /> {t('appelsTelephoniques.exporterPdf')}
          </button>
        </div>
      </div>

      {formOuvert && <AppelForm onEnregistre={fetchAppels} historiqueAppels={appels} />}
      {appelEnEdition && (
        <div ref={formRef}>
          <AppelForm
            appelAModifier={appelEnEdition}
            historiqueAppels={appels}
            onModifie={appelModifie}
            onAnnulerModification={() => setAppelEnEdition(null)}
          />
        </div>
      )}

      <div className='flex items-center gap-2.5 flex-wrap rounded-lg border border-border bg-card px-3.5 py-2.5'>
        <div className='relative flex-grow min-w-[200px] max-w-sm'>
          <LuSearch size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
          <input
            type='text'
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('appelsTelephoniques.rechercher')}
            className='w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
          />
        </div>
        <select value={actionFiltre} onChange={(e) => setActionFiltre(e.target.value)} className='select select-bordered select-sm'>
          <option value='tous'>{t('appelsTelephoniques.toutesActions')}</option>
          <option value='Rappeler'>{t('appelForm.actionRappeler')}</option>
          <option value='Rappeler URGENT'>{t('appelForm.actionRappelerURGENT')}</option>
          <option value='Rappellera'>{t('appelForm.actionRappellera')}</option>
          <option value='Pour info'>{t('appelForm.actionPourinfo')}</option>
        </select>
        <select value={traiteFiltre} onChange={(e) => setTraiteFiltre(e.target.value)} className='select select-bordered select-sm'>
          <option value='tous'>{t('appelsTelephoniques.tousLesEtats')}</option>
          <option value='a_traiter'>{t('appelsTelephoniques.aTraiter')}</option>
          <option value='traite'>{t('appelsTelephoniques.traite')}</option>
        </select>
        <FiltrePeriode valeur={periode} onChange={setPeriode} />
      </div>

      <div className='rounded-lg border border-border bg-card overflow-hidden'>
        {chargement ? (
          <div className='flex items-center justify-center py-16'>
            <LuLoader className='animate-spin text-muted-foreground' size={22} />
          </div>
        ) : appelsAffiches.length === 0 ? (
          <p className='text-sm text-muted-foreground text-center py-16'>{t('appelsTelephoniques.aucunAppel')}</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm whitespace-nowrap border-collapse'>
              <thead>
                <tr className='bg-muted/60 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                  {colonnes.map((col) => (
                    <th key={col.cle} className='px-3 py-2.5 border border-border sticky top-0 bg-muted/60'>
                      <button onClick={() => trierPar(col.cle)} className='inline-flex items-center gap-1 hover:text-foreground transition-colors'>
                        {col.label} <IconeTri cle={col.cle} />
                      </button>
                    </th>
                  ))}
                  <th className='px-3 py-2.5 border border-border sticky top-0 bg-muted/60'></th>
                </tr>
              </thead>
              <tbody>
                {appelsPage.map((a) => (
                  <tr key={a.id} className='odd:bg-background even:bg-muted/10'>
                    <td className='px-3 py-2 border border-border font-mono text-xs text-muted-foreground'>{a.numero_registre}</td>
                    <td className='px-3 py-2 border border-border text-muted-foreground tabular-nums'>{valeurCellule(a, 'date_appel')}</td>
                    <td className='px-3 py-2 border border-border text-muted-foreground tabular-nums'>{valeurCellule(a, 'heure_appel')}</td>
                    <td className='px-3 py-2 border border-border text-muted-foreground'>{a.agent || '—'}</td>
                    <td className='px-3 py-2 border border-border max-w-[160px] truncate font-medium' title={a.appelant_nom}>{valeurCellule(a, 'appelant_nom')}</td>
                    <td className='px-3 py-2 border border-border text-muted-foreground'>{valeurCellule(a, 'appelant_telephone')}</td>
                    <td className='px-3 py-2 border border-border max-w-[160px] truncate text-muted-foreground' title={a.appelant_organisation}>{valeurCellule(a, 'appelant_organisation')}</td>
                    <td className='px-3 py-2 border border-border max-w-[140px] truncate text-muted-foreground' title={a.appelant_qualite}>{valeurCellule(a, 'appelant_qualite')}</td>
                    <td className='px-3 py-2 border border-border max-w-[160px] truncate text-muted-foreground' title={a.appelant_email}>{valeurCellule(a, 'appelant_email')}</td>
                    <td className='px-3 py-2 border border-border max-w-xs truncate' title={a.objet}>{valeurCellule(a, 'objet')}</td>
                    <td className='px-3 py-2 border border-border max-w-xs truncate text-muted-foreground' title={a.message}>{valeurCellule(a, 'message')}</td>
                    <td className='px-3 py-2 border border-border max-w-[160px] truncate text-muted-foreground' title={personneConcernee(a)}>{personneConcernee(a) || '—'}</td>
                    <td className={`px-3 py-2 border border-border font-medium ${ACTION_STYLES[a.action] || 'text-muted-foreground'}`}>
                      {a.action ? t(`appelForm.action${a.action.replace(/\s/g, '')}`) : '—'}
                    </td>
                    <td className='px-3 py-2 border border-border'>
                      {a.traite_le ? (
                        <span className='inline-flex items-center gap-1 text-green-700 text-xs font-medium'>
                          <LuCheck size={13} /> {t('appelsTelephoniques.traite')}
                          {a.note_traitement && <LuInfo size={12} className='text-green-700/70' title={a.note_traitement} />}
                        </span>
                      ) : (
                        <button
                          onClick={(e) => ouvrirMarquerTraite(a, e)}
                          className='inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors'
                        >
                          <LuX size={13} /> {t('appelsTelephoniques.marquerTraite')}
                        </button>
                      )}
                    </td>
                    <td className='px-3 py-2 border border-border'>
                      <div className='flex items-center gap-1'>
                        <button
                          onClick={() => ouvrirModification(a)}
                          title={t('appelsTelephoniques.modifier')}
                          className='flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
                        >
                          <LuPencil size={13} />
                        </button>
                        <button
                          onClick={(e) => supprimerAppel(a, e)}
                          title={t('appelsTelephoniques.supprimer')}
                          className='flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors'
                        >
                          <LuTrash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination currentPage={pageActuelle} totalPages={totalPages} onPageChange={setPageActuelle} />

      {appelATraiter && (
        <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-black/50' onClick={() => setAppelATraiter(null)} />
          <div className='relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl flex flex-col gap-3'>
            <div>
              <h3 className='text-base font-semibold text-foreground'>{t('appelsTelephoniques.traiterTitre')}</h3>
              <p className='text-sm text-muted-foreground mt-1'>{t('appelsTelephoniques.traiterDescription', { nom: appelATraiter.appelant_nom })}</p>
            </div>
            <textarea
              value={noteTraitement}
              onChange={(e) => setNoteTraitement(e.target.value)}
              placeholder={t('appelsTelephoniques.traiterNotePlaceholder')}
              rows={3}
              autoFocus
              className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none'
            />
            <div className='flex justify-end gap-2 mt-1'>
              <button onClick={() => setAppelATraiter(null)} className='btn btn-sm btn-ghost'>
                {t('appelsTelephoniques.annuler')}
              </button>
              <button
                onClick={confirmerTraitement}
                disabled={traitementEnCours}
                className='btn btn-sm bg-primary text-white border-0 hover:opacity-90 disabled:opacity-60'
              >
                {traitementEnCours ? t('appelForm.enregistrementEnCours') : t('appelsTelephoniques.marquerTraite')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppelsTelephoniques;
