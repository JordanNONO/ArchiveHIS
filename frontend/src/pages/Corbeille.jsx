import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuTrash2, LuRotateCcw, LuX, LuArrowLeft } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import Breadcrumbs from '../components/Breadcrumbs';
import Loading from '../components/Loading';
import { getTrash, restoreDocument, forceDeleteDocument } from '../api/routes/document';
import { getFileTypeVisual, timeAgo } from '../utils/fileTypeIcons';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import { usePermissions } from '../hooks/usePermissions';

const ROLES_DEPOT = ['Intervenant', 'Beneficiaire'];

function nomConcerne(doc) {
  if (doc.personnel_concerne) {
    return `${doc.personnel_concerne.prenom || ''} ${doc.personnel_concerne.nom || ''}`.trim();
  }
  return doc.nom_personne_concernee || null;
}

function Corbeille() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { role } = usePermissions();
  const estCompteDepot = ROLES_DEPOT.includes(role);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

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

  async function purge(doc) {
    if (!await confirm({ message: t('corbeille.confirmerSuppressionDefinitive'), danger: true, confirmLabel: t('corbeille.supprimerDefinitivement') })) return;
    forceDeleteDocument(doc.id).then((res) => {
      if (res.status === 200) {
        toast.success(t('corbeille.documentSupprimeDefinitivement'));
        fetchTrash();
      } else {
        toast.error(t('corbeille.erreurProduite'));
      }
    }).catch(() => toast.error(t('corbeille.erreurProduite')));
  }

  if (estCompteDepot) {
    return (
      <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
        <div>
          <Link to='/' className='inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2'>
            <LuArrowLeft size={13} /> {t('espaceDossier.retourTableauDeBord')}
          </Link>
          <h1 className='text-xl font-bold flex items-center gap-2'>
            <LuTrash2 size={20} className='text-primary' />
            {t('sidebar.corbeille')}
          </h1>
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
                      onClick={() => purge(doc)}
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
      </div>
    );
  }

  return (
    <div className='flex flex-col flex-grow py-6 gap-1 w-full'>
      <Breadcrumbs where={t('sidebar.corbeille')} />
      <div className='mb-4 mt-1'>
        <h2 className='text-2xl font-semibold text-foreground'>{t('sidebar.corbeille')}</h2>
        <p className='text-sm text-muted-foreground mt-1'>
          {t('corbeille.documentsSupprimesRestent')}
        </p>
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
                            className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors'
                          >
                            <LuRotateCcw size={14} /> {t('corbeille.restaurer')}
                          </button>
                          <button
                            onClick={() => purge(doc)}
                            className='inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 text-destructive px-3 py-1.5 text-sm font-medium hover:bg-destructive/10 transition-colors'
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
    </div>
  );
}

export default Corbeille;
