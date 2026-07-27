import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { LuTrash2, LuRotateCcw, LuX } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import Loading from '../components/Loading';
import { getTrash, restoreDocument, forceDeleteDocument } from '../api/routes/document';
import { getFileTypeVisual, timeAgo } from '../utils/fileTypeIcons';
import { useConfirm } from '../contexts/ConfirmDialogContext';

function nomConcerne(doc) {
  if (doc.personnel_concerne) {
    return `${doc.personnel_concerne.prenom || ''} ${doc.personnel_concerne.nom || ''}`.trim();
  }
  return doc.nom_personne_concernee || null;
}

function Corbeille() {
  const confirm = useConfirm();
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
        toast.success('Document restauré');
        fetchTrash();
      } else {
        toast.error("Une erreur s'est produite");
      }
    }).catch(() => toast.error("Une erreur s'est produite"));
  }

  async function purge(doc) {
    if (!await confirm({ message: 'Suppression définitive et irréversible du fichier. Continuer ?', danger: true, confirmLabel: 'Supprimer définitivement' })) return;
    forceDeleteDocument(doc.id).then((res) => {
      if (res.status === 200) {
        toast.success('Document supprimé définitivement');
        fetchTrash();
      } else {
        toast.error("Une erreur s'est produite");
      }
    }).catch(() => toast.error("Une erreur s'est produite"));
  }

  return (
    <div className='flex flex-col flex-grow py-6 gap-1 w-full'>
      <Breadcrumbs where="Corbeille" />
      <div className='mb-4 mt-1'>
        <h2 className='text-2xl font-semibold text-foreground'>Corbeille</h2>
        <p className='text-sm text-muted-foreground mt-1'>
          Les documents supprimés restent ici avant d'être définitivement effacés.
        </p>
      </div>

      {loading ? <Loading /> : (
        <div className='rounded-2xl border border-border bg-card overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='table'>
              <thead>
                <tr className='border-b border-border'>
                  <th></th>
                  <th>Nom du fichier</th>
                  <th>Concerné</th>
                  <th>Supprimé</th>
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
                            <LuRotateCcw size={14} /> Restaurer
                          </button>
                          <button
                            onClick={() => purge(doc)}
                            className='inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 text-destructive px-3 py-1.5 text-sm font-medium hover:bg-destructive/10 transition-colors'
                          >
                            <LuX size={14} /> Supprimer définitivement
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
                        <span>La corbeille est vide</span>
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
