import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { LuX, LuFolderOpen, LuTrash2, LuCheckCircle2 } from 'react-icons/lu';
import { getCategorie } from '../api/routes/categorie';
import { getTypeDocuments } from '../api/routes/typeDocument';
import { updateDocument, deleteDocument, transitionDocument } from '../api/routes/document';
import { useConfirm } from '../contexts/ConfirmDialogContext';

/**
 * Barre d'actions groupées affichée quand au moins un document est sélectionné
 * dans DocumentList/DocumentGrid — déplacer ou envoyer à la corbeille plusieurs
 * documents à la fois, plutôt qu'un par un.
 */
function BulkActionBar({ documents, selectedIds, onClear, onChanged }) {
  const confirm = useConfirm();
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [moveForm, setMoveForm] = useState({ category_id: '', type_document_id: '' });

  const count = selectedIds.size;
  if (count === 0) return null;

  const selectedDocs = documents.filter((d) => selectedIds.has(d.id));

  function openMoveForm() {
    if (categories.length === 0) {
      getCategorie().then(async (res) => res.ok && setCategories(await res.json())).catch(() => {});
    }
    setShowMoveForm(true);
  }

  function onCategorieChange(newCategoryId) {
    setMoveForm({ category_id: newCategoryId, type_document_id: '' });
    setTypes([]);
    if (newCategoryId) {
      getTypeDocuments(newCategoryId).then(async (res) => res.ok && setTypes(await res.json())).catch(() => {});
    }
  }

  async function confirmMove() {
    if (!moveForm.category_id) {
      toast.error('Choisissez une catégorie');
      return;
    }
    setMoving(true);
    let ok = 0;
    for (const doc of selectedDocs) {
      try {
        const res = await updateDocument(doc.id, {
          category_id: moveForm.category_id,
          type_document_id: moveForm.type_document_id || null,
          titre: doc.titre_document,
          auteur: doc.auteur,
          resume: doc.resume,
          reference: doc.code_reference,
          personnel_concerne_id: doc.personnel_concerne_id,
          nom_personne_concernee: doc.nom_personne_concernee,
        });
        if (res.status === 200) ok++;
      } catch (error) {
        console.log(error);
      }
    }
    setMoving(false);
    setShowMoveForm(false);
    setMoveForm({ category_id: '', type_document_id: '' });
    if (ok > 0) toast.success(`${ok} document(s) déplacé(s)`);
    if (ok < selectedDocs.length) toast.error(`${selectedDocs.length - ok} document(s) n'ont pas pu être déplacés`);
    onClear();
    onChanged && onChanged();
  }

  /**
   * Archive plusieurs documents d'un coup — même logique que bulkDelete/confirmMove
   * (boucle sur l'endpoint unitaire déjà existant, pas de nouvel endpoint "en
   * masse"), en réutilisant transitionDocument tel qu'utilisé sur la fiche
   * document (DocView.jsx). Un document déjà traité, ou que l'utilisateur n'a
   * pas le droit de valider, échoue simplement pour celui-là — voir le compte
   * rendu partiel affiché ensuite (même schéma que les autres actions groupées).
   */
  async function bulkArchiver() {
    setArchiving(true);
    let ok = 0;
    for (const doc of selectedDocs) {
      try {
        const res = await transitionDocument(doc.id, { nouveau_statut: 'VALIDE_ET_TRAITE' });
        if (res.status === 200) ok++;
      } catch (error) {
        console.log(error);
      }
    }
    setArchiving(false);
    if (ok > 0) toast.success(`${ok} document(s) archivé(s)`);
    if (ok < selectedDocs.length) toast.error(`${selectedDocs.length - ok} document(s) n'ont pas pu être archivés`);
    onClear();
    onChanged && onChanged();
  }

  async function bulkDelete() {
    if (!await confirm({ message: `Envoyer ${count} document(s) à la corbeille ?`, danger: true, confirmLabel: 'Envoyer à la corbeille' })) return;
    setDeleting(true);
    let ok = 0;
    for (const doc of selectedDocs) {
      try {
        const res = await deleteDocument(doc.id);
        if (res.status === 200) ok++;
      } catch (error) {
        console.log(error);
      }
    }
    setDeleting(false);
    if (ok > 0) toast.success(`${ok} document(s) envoyé(s) à la corbeille`);
    if (ok < selectedDocs.length) toast.error(`${selectedDocs.length - ok} document(s) n'ont pas pu être supprimés`);
    onClear();
    onChanged && onChanged();
  }

  return (
    <div className='sticky top-0 z-10 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 mb-4'>
      <div className='flex items-center justify-between flex-wrap gap-2'>
        <div className='flex items-center gap-2 text-sm font-medium'>
          <span className='flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold'>{count}</span>
          document{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}
        </div>
        <div className='flex items-center gap-2'>
          <button onClick={bulkArchiver} disabled={archiving} className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60'>
            <LuCheckCircle2 size={14} /> {archiving ? 'Archivage...' : 'Archiver'}
          </button>
          <button onClick={openMoveForm} className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors'>
            <LuFolderOpen size={14} /> Déplacer
          </button>
          <button onClick={bulkDelete} disabled={deleting} className='inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 text-destructive px-3 py-1.5 text-sm font-medium hover:bg-destructive/10 transition-colors disabled:opacity-60'>
            <LuTrash2 size={14} /> {deleting ? 'Suppression...' : 'Supprimer'}
          </button>
          <button onClick={onClear} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
            <LuX size={15} />
          </button>
        </div>
      </div>

      {showMoveForm && (
        <div className='flex flex-col sm:flex-row gap-2 items-start sm:items-center pt-3 border-t border-primary/20'>
          <select
            className='select select-bordered select-sm w-full sm:w-56'
            value={moveForm.category_id}
            onChange={(e) => onCategorieChange(e.target.value)}
          >
            <option value=''>Choisir une catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.libelle_cat}</option>
            ))}
          </select>
          <select
            className='select select-bordered select-sm w-full sm:w-56'
            value={moveForm.type_document_id}
            onChange={(e) => setMoveForm((f) => ({ ...f, type_document_id: e.target.value }))}
            disabled={!moveForm.category_id}
          >
            <option value=''>Aucun sous-dossier</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.libelle}</option>
            ))}
          </select>
          <div className='flex gap-2'>
            <button onClick={() => setShowMoveForm(false)} className='btn btn-sm btn-ghost'>Annuler</button>
            <button onClick={confirmMove} disabled={moving} className='btn btn-sm bg-primary text-white hover:bg-primary'>
              {moving ? 'Déplacement...' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkActionBar;
