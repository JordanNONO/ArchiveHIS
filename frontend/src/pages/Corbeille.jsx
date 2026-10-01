import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuTrash2, LuRotateCcw, LuX, LuArrowLeft, LuShieldAlert, LuAlertTriangle } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import Breadcrumbs from '../components/Breadcrumbs';
import Loading from '../components/Loading';
import { getTrash, restoreDocument, forceDeleteDocument } from '../api/routes/document';
import { getFileTypeVisual, timeAgo } from '../utils/fileTypeIcons';
import { usePermissions } from '../hooks/usePermissions';
import echo from '../utils/echo';

const ROLES_DEPOT = ['Intervenant', 'Beneficiaire'];

function nomConcerne(doc) {
  if (doc.personnel_concerne) {
    return `${doc.personnel_concerne.prenom || ''} ${doc.personnel_concerne.nom || ''}`.trim();
  }
  return doc.nom_personne_concernee || null;
}

/**
 * Repères indicatifs (pas une base légale exhaustive) pour aider à juger si
 * un document peut être supprimé, affichés à la fois dans le rappel RGPD
 * consultable à tout moment et dans la confirmation de suppression.
 */
function useReperesConservation() {
  const { t } = useTranslation();
  return [
    { libelle: t('corbeille.repereComptaLibelle'), duree: t('corbeille.repereComptaDuree') },
    { libelle: t('corbeille.repereContratLibelle'), duree: t('corbeille.repereContratDuree') },
    { libelle: t('corbeille.repereBeneficiaireLibelle'), duree: t('corbeille.repereBeneficiaireDuree') },
  ];
}

function TableauReperes() {
  const { t } = useTranslation();
  const reperes = useReperesConservation();
  return (
    <div className='rounded-xl border border-border bg-muted/50 p-3'>
      <p className='flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground mb-2'>
        <LuShieldAlert size={13} /> {t('corbeille.reperesTitre')}
      </p>
      <table className='w-full text-xs'>
        <tbody>
          {reperes.map((r) => (
            <tr key={r.libelle} className='border-t border-dashed border-border first:border-t-0'>
              <td className='py-1.5 pr-2 font-medium'>{r.libelle}</td>
              <td className='py-1.5 text-muted-foreground text-right'>{r.duree}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className='text-[11px] text-muted-foreground mt-2'>{t('corbeille.reperesDisclaimer')}</p>
    </div>
  );
}

function Corbeille() {
  const { t } = useTranslation();
  const { role } = usePermissions();
  const estCompteDepot = ROLES_DEPOT.includes(role);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  // Document en attente de suppression définitive : affiche la boîte de
  // confirmation (repères de conservation + case à cocher obligatoire) au
  // lieu du confirm() générique — voir docAPurger plus bas.
  const [docAPurger, setDocAPurger] = useState(null);
  const [caseRgpdCochee, setCaseRgpdCochee] = useState(false);
  const [purgeEnCours, setPurgeEnCours] = useState(false);
  const [reperesOuverts, setReperesOuverts] = useState(false);

  const fetchTrash = () => {
    setLoading(true);
    getTrash()
      .then(async (res) => {
        if (res.status === 200) setDocuments(await res.json());
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  // Quelqu'un d'autre envoie un document à la corbeille pendant qu'on a
  // cette page ouverte : on le voit apparaître sans avoir à recharger (voir
  // le canal global "documents", diffusé par DocumentController::destroy()).
  useEffect(() => {
    const channel = echo.channel('documents');
    channel.listen('.document.supprime', () => fetchTrash());
    return () => echo.leave('documents');
  }, []);

  function restore(doc) {
    restoreDocument(doc.id).then((res) => {
      if (res.status === 200) {
        toast.success(t('corbeille.documentRestaure'));
        fetchTrash();
      } else {
        toast.error(t('corbeille.erreurProduite'));
      }
    }).catch(() => toast.error(t('corbeille.erreurProduite')));
  }

  function ouvrirPurge(doc) {
    setCaseRgpdCochee(false);
    setDocAPurger(doc);
  }

  async function confirmerPurge() {
    if (!docAPurger) return;
    setPurgeEnCours(true);
    const res = await forceDeleteDocument(docAPurger.id).catch(() => null);
    setPurgeEnCours(false);
    if (res?.status === 200) {
      toast.success(t('corbeille.documentSupprimeDefinitivement'));
      setDocAPurger(null);
      fetchTrash();
    } else {
      toast.error(t('corbeille.erreurProduite'));
    }
  }

  if (estCompteDepot) {
    return (
      <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
        <div>
          <Link to='/' className='inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2'>
            <LuArrowLeft size={13} /> {t('espaceDossier.retourTableauDeBord')}
          </Link>
          <div className='flex items-center justify-between gap-3 flex-wrap'>
            <h1 className='text-xl font-bold flex items-center gap-2'>
              <LuTrash2 size={20} className='text-primary' />
              {t('sidebar.corbeille')}
            </h1>
            <button
              onClick={() => setReperesOuverts(true)}
              className='inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors shrink-0'
            >
              <LuShieldAlert size={13} /> {t('corbeille.rappelRgpd')}
            </button>
          </div>
          <p className='text-sm text-muted-foreground mt-1'>
            {t('corbeille.piecesSupprimeesRestent')}
          </p>
        </div>

        {loading ? <Loading /> : (
          <ul className='flex flex-col gap-2.5'>
            {documents.map((doc) => {
              const { icon: Icon, tint } = getFileTypeVisual(doc.chemin_stockage_serveur);
              return (
                <li key={doc.id} className='flex items-center gap-3 text-sm rounded-2xl border border-border bg-card px-3.5 py-3 hover:shadow-md transition-all duration-200'>
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
                    <Icon size={16} />
                  </span>
                  <div className='min-w-0 flex-1'>
                    <div className='font-medium truncate'>{doc.titre_document}</div>
                    <div className='text-xs text-muted-foreground mt-0.5'>{t('corbeille.supprime')} {timeAgo(doc.deleted_at)}</div>
                  </div>
                  <div className='flex items-center gap-1.5 shrink-0'>
                    <button
                      onClick={() => restore(doc)}
                      title={t('corbeille.restaurer')}
                      className='flex items-center justify-center w-9 h-9 rounded-xl text-primary bg-primary/5 hover:bg-primary/10 transition-colors'
                    >
                      <LuRotateCcw size={15} />
                    </button>
                    <button
                      onClick={() => ouvrirPurge(doc)}
                      title={t('corbeille.supprimerDefinitivement')}
                      className='flex items-center justify-center w-9 h-9 rounded-xl text-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors'
                    >
                      <LuX size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
            {documents.length === 0 && (
              <li className='flex flex-col items-center gap-2 py-14 text-muted-foreground rounded-2xl border border-dashed border-border'>
                <LuTrash2 size={28} strokeWidth={1.5} />
                <span className='text-sm font-medium'>{t('corbeille.corbeilleVide')}</span>
              </li>
            )}
          </ul>
        )}
        <ModaleReperesRgpd ouverte={reperesOuverts} onFermer={() => setReperesOuverts(false)} />
        <ModalePurge
          doc={docAPurger}
          caseRgpdCochee={caseRgpdCochee}
          setCaseRgpdCochee={setCaseRgpdCochee}
          purgeEnCours={purgeEnCours}
          onAnnuler={() => setDocAPurger(null)}
          onConfirmer={confirmerPurge}
        />
      </div>
    );
  }

  return (
    <div className='flex flex-col flex-grow py-6 gap-1 w-full'>
      <Breadcrumbs where={t('sidebar.corbeille')} />
      <div className='mb-4 mt-1 flex items-center justify-between gap-3 flex-wrap'>
        <div>
          <h2 className='text-2xl font-semibold text-foreground'>{t('sidebar.corbeille')}</h2>
          <p className='text-sm text-muted-foreground mt-1'>
            {t('corbeille.documentsSupprimesRestent')}
          </p>
        </div>
        <button
          onClick={() => setReperesOuverts(true)}
          className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors shrink-0'
        >
          <LuShieldAlert size={14} /> {t('corbeille.rappelRgpd')}
        </button>
      </div>

      {loading ? <Loading /> : (
        <div className='rounded-2xl border border-border bg-card overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='table'>
              <thead>
                <tr className='border-b border-border'>
                  <th></th>
                  <th>{t('corbeille.nomDuFichier')}</th>
                  <th>{t('corbeille.concerne')}</th>
                  <th>{t('corbeille.supprime')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const { icon: Icon, tint } = getFileTypeVisual(doc.chemin_stockage_serveur);
                  return (
                    <tr key={doc.id} className='hover:bg-muted/60 transition-colors'>
                      <th>
                        <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${tint}`}>
                          <Icon size={16} />
                        </div>
                      </th>
                      <td>{doc.titre_document}</td>
                      <td className='text-muted-foreground'>{nomConcerne(doc) || '—'}</td>
                      <td className='text-muted-foreground'>{timeAgo(doc.deleted_at)}</td>
                      <td>
                        <div className='flex items-center gap-2 justify-end'>
                          <button
                            onClick={() => restore(doc)}
                            className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium whitespace-nowrap min-w-[150px] hover:bg-muted transition-colors'
                          >
                            <LuRotateCcw size={14} /> {t('corbeille.restaurer')}
                          </button>
                          <button
                            onClick={() => ouvrirPurge(doc)}
                            className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 text-destructive px-3 py-1.5 text-sm font-medium whitespace-nowrap min-w-[150px] hover:bg-destructive/10 transition-colors'
                          >
                            <LuX size={14} /> {t('corbeille.supprimerDefinitivement')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={5} className='text-center py-10 text-muted-foreground'>
                      <div className='flex flex-col items-center gap-2'>
                        <LuTrash2 size={28} />
                        <span>{t('corbeille.corbeilleVide')}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ModaleReperesRgpd ouverte={reperesOuverts} onFermer={() => setReperesOuverts(false)} />
      <ModalePurge
        doc={docAPurger}
        caseRgpdCochee={caseRgpdCochee}
        setCaseRgpdCochee={setCaseRgpdCochee}
        purgeEnCours={purgeEnCours}
        onAnnuler={() => setDocAPurger(null)}
        onConfirmer={confirmerPurge}
      />
    </div>
  );
}

/** Rappel RGPD consultable à tout moment, sans action de suppression — ouvert depuis le bouton dans l'en-tête de la Corbeille. */
function ModaleReperesRgpd({ ouverte, onFermer }) {
  const { t } = useTranslation();
  if (!ouverte) return null;
  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/50' onClick={onFermer} />
      <div className='relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl'>
        <div className='flex items-start gap-3 mb-1'>
          <span className='flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary'>
            <LuShieldAlert size={20} />
          </span>
          <div className='min-w-0 pt-1'>
            <h3 className='text-base font-semibold text-foreground'>{t('corbeille.rappelRgpd')}</h3>
            <p className='text-sm text-muted-foreground mt-1'>{t('corbeille.rappelRgpdIntro')}</p>
          </div>
        </div>
        <div className='mt-3'>
          <TableauReperes />
        </div>
        <div className='flex justify-end mt-5'>
          <button onClick={onFermer} className='btn btn-sm btn-ghost'>{t('corbeille.fermer')}</button>
        </div>
      </div>
    </div>
  );
}

/** Confirmation de suppression définitive — repères de conservation + case à cocher obligatoire avant d'activer le bouton. */
function ModalePurge({ doc, caseRgpdCochee, setCaseRgpdCochee, purgeEnCours, onAnnuler, onConfirmer }) {
  const { t } = useTranslation();
  if (!doc) return null;
  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/50' onClick={onAnnuler} />
      <div className='relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl'>
        <div className='flex items-start gap-3'>
          <span className='flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-destructive/10 text-destructive'>
            <LuAlertTriangle size={20} />
          </span>
          <div className='min-w-0 pt-1'>
            <h3 className='text-base font-semibold text-foreground'>{t('corbeille.confirmerSuppressionTitre')}</h3>
            <p className='text-sm text-muted-foreground mt-1'>{t('corbeille.confirmerSuppressionDefinitive')}</p>
          </div>
        </div>

        <div className='mt-3'>
          <TableauReperes />
        </div>

        <label className={`flex items-start gap-2.5 mt-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${caseRgpdCochee ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
          <input
            type='checkbox'
            className='checkbox checkbox-sm checkbox-primary mt-0.5'
            checked={caseRgpdCochee}
            onChange={(e) => setCaseRgpdCochee(e.target.checked)}
          />
          <span className='text-xs leading-relaxed'>{t('corbeille.confirmationCheckbox')}</span>
        </label>

        <div className='flex justify-end gap-2 mt-5'>
          <button onClick={onAnnuler} className='btn btn-sm btn-ghost'>{t('corbeille.annuler')}</button>
          <button
            onClick={onConfirmer}
            disabled={!caseRgpdCochee || purgeEnCours}
            className='btn btn-sm text-white border-0 bg-destructive hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed'
          >
            {purgeEnCours ? t('corbeille.suppressionEnCours') : t('corbeille.supprimerDefinitivement')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Corbeille;
