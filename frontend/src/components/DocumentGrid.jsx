import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import DocumentContextMenu from './DocumentContextMenu';
import ShareDocumentModal from './ShareDocumentModal';
import StatutBadge from './StatutBadge';
import PersonnelConcerneField from './PersonnelConcerneField';
import BulkActionBar from './BulkActionBar';
import BarreDelai from './BarreDelai';
import CompteARebours from './CompteARebours';
import { updateDocument, deleteDocument } from '../api/routes/document';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import { alerteDelaiLabel, bordureDocumentClass } from '../utils/common';

/**
 * Nom de la personne concernée par le document (ex: le titulaire d'un CV),
 * via la fiche Personnel liée si elle existe, sinon le nom libre saisi.
 */
function nomConcerne(doc) {
  if (doc.personnel_concerne) {
    return `${doc.personnel_concerne.prenom || ''} ${doc.personnel_concerne.nom || ''}`.trim();
  }
  return doc.nom_personne_concernee || null;
}

const DocumentGrid = ({ documents, getFileIcon, onChanged, onApercu }) => {
  const confirm = useConfirm();
  const [shareDoc, setShareDoc] = useState(null);
  const [renameDoc, setRenameDoc] = useState(null);
  const [renameForm, setRenameForm] = useState({ titre: '', auteur: '', reference: '', resume: '', personnel_concerne_id: '', nom_personne_concernee: '' });
  const [saving, setSaving] = useState(false);
  const renameDialogRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (renameDoc) {
      renameDialogRef.current?.showModal();
    } else {
      renameDialogRef.current?.close();
    }
  }, [renameDoc]);

  function openRename(doc) {
    setRenameDoc(doc);
    setRenameForm({
      titre: doc.titre_document || '',
      auteur: doc.auteur || '',
      reference: doc.code_reference || '',
      resume: doc.resume || '',
      personnel_concerne_id: doc.personnel_concerne_id || '',
      nom_personne_concernee: doc.nom_personne_concernee || '',
    });
  }

  async function saveRename(e) {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await updateDocument(renameDoc.id, {
        category_id: renameDoc.categorie_id,
        type_document_id: renameDoc.type_document_id,
        titre: renameForm.titre,
        auteur: renameForm.auteur,
        reference: renameForm.reference,
        resume: renameForm.resume,
        personnel_concerne_id: renameForm.personnel_concerne_id,
        nom_personne_concernee: renameForm.nom_personne_concernee,
      });
      setSaving(false);
      if (res.status === 200) {
        toast.success('Document mis à jour avec succès');
        setRenameDoc(null);
        onChanged && onChanged();
      } else {
        toast.error("Une erreur s'est produite");
      }
    } catch (error) {
      setSaving(false);
      console.log(error);
      toast.error("Une erreur s'est produite");
    }
  }

  async function removeDoc(doc) {
    if (!await confirm({ message: 'Le document sera envoyé à la corbeille. Continuer ?', danger: true, confirmLabel: 'Envoyer à la corbeille' })) return;
    deleteDocument(doc.id).then((res) => {
      if (res.status === 200) {
        toast.success('Document supprimé avec succès');
        onChanged && onChanged();
      } else {
        toast.error("Une erreur s'est produite");
      }
    }).catch((err) => {
      console.log(err);
      toast.error("Une erreur s'est produite");
    });
  }

  return (
    <div>
      <BulkActionBar documents={documents} selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} onChanged={onChanged} />
      <div className="grid sm:grid-cols-4 max-md:grid-cols-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 py-2">
      {documents.map((doc, k) => (
        <div key={k} className='relative group'>
          <DocumentContextMenu doc={doc} onRename={() => openRename(doc)} onDelete={() => removeDoc(doc)} onApercu={onApercu}>
            <Link to={"/view/"+doc.id+"/"+String(doc.chemin_stockage_serveur).split(".").at(1)}>
            <div
              className={`flex flex-col items-center justify-center gap-2 h-[150px] rounded-2xl border border-border bg-card p-5 relative hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden ${bordureDocumentClass(doc)}`}
              title={alerteDelaiLabel(doc.suivi_delai_actif) || `${doc.titre_document}.${doc.chemin_stockage_serveur.split('.').pop()}`}
            >
              <BarreDelai suiviDelaiActif={doc.suivi_delai_actif} />
              <StatutBadge statut={doc.status_doc} className="absolute top-2 right-2 !px-1.5 !py-0.5 !text-[10px]" />
              <div className="text-4xl mt-1">
                {getFileIcon(doc.chemin_stockage_serveur)}
              </div>
              <div className="text-center text-sm font-medium text-foreground px-2 truncate w-full" title={`${doc.titre_document}.${doc.chemin_stockage_serveur.split('.').pop()}`}>
                {`${doc.titre_document.substring(0, 8)}[...].${doc.chemin_stockage_serveur.split('.').pop()}`}
              </div>
              {nomConcerne(doc) && (
                <div className='text-[11px] text-muted-foreground truncate w-full text-center' title={`Concerne : ${nomConcerne(doc)}`}>
                  {nomConcerne(doc)}
                </div>
              )}
              {doc.status_doc === 'INCOMPLET_REJETE' && <CompteARebours document={doc} className='w-full' />}
            </div>
            </Link>
          </DocumentContextMenu>

          {/* Sélection multiple — les autres actions passent par le clic droit
              (ou l'appui long sur tactile, géré nativement par Radix) */}
          <div className='absolute top-1.5 left-1.5 z-10'>
            <input
              type="checkbox"
              className="checkbox checkbox-sm bg-card/90"
              checked={selectedIds.has(doc.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleSelect(doc.id)}
            />
          </div>
        </div>
      ))}

      <ShareDocumentModal doc={shareDoc} isOpen={!!shareDoc} onClose={() => setShareDoc(null)} />

      <dialog ref={renameDialogRef} className="modal" onClose={() => setRenameDoc(null)}>
        <div className="modal-box rounded-2xl">
          <form method="dialog">
            <button onClick={() => setRenameDoc(null)} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h1 className='text-lg font-semibold mb-4'>Modifier le document</h1>
          {renameDoc && (
            <form onSubmit={saveRename} className='flex flex-col gap-3'>
              <div>
                <label className='block text-sm font-medium mb-1.5'>Titre</label>
                <input type="text" value={renameForm.titre} onChange={(e) => setRenameForm({ ...renameForm, titre: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1.5'>Auteur</label>
                <input type="text" value={renameForm.auteur} onChange={(e) => setRenameForm({ ...renameForm, auteur: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1.5'>Référence</label>
                <input type="text" value={renameForm.reference} onChange={(e) => setRenameForm({ ...renameForm, reference: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
              </div>
              <PersonnelConcerneField
                personnelConcerneId={renameForm.personnel_concerne_id}
                nomPersonneConcernee={renameForm.nom_personne_concernee}
                onChange={(patch) => setRenameForm((prev) => ({ ...prev, ...patch }))}
              />
              <div>
                <label className='block text-sm font-medium mb-1.5'>Résumé</label>
                <textarea value={renameForm.resume} onChange={(e) => setRenameForm({ ...renameForm, resume: e.target.value })} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
              </div>
              <div className="modal-action">
                <button type="submit" disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
      </div>
    </div>
  );
};

export default DocumentGrid;
