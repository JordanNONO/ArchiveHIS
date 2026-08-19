import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getCategorie } from '../api/routes/categorie';
import { getTypeDocuments } from '../api/routes/typeDocument';
import { updateDocument } from '../api/routes/document';
import { typesAvecHierarchie } from '../utils/typeHierarchie';

/**
 * Déplace un document vers une autre catégorie/sous-dossier — même endpoint
 * que « Changer de dossier » sur la fiche document (DocView.jsx), mais
 * accessible directement depuis la grille/liste sans avoir à ouvrir chaque
 * document un par un.
 */
function DeplacerDocumentModal({ doc, isOpen, onClose, onMoved }) {
    const [categories, setCategories] = useState([]);
    const [typesForCategorie, setTypesForCategorie] = useState([]);
    const [categoryId, setCategoryId] = useState('');
    const [typeDocumentId, setTypeDocumentId] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen || !doc) return;
        setCategoryId(doc.categorie_id || '');
        setTypeDocumentId(doc.type_document_id || '');
        getCategorie().then(async (res) => res.ok && setCategories(await res.json())).catch(() => {});
        if (doc.categorie_id) {
            getTypeDocuments(doc.categorie_id).then(async (res) => res.ok && setTypesForCategorie(await res.json())).catch(() => {});
        }
    }, [isOpen, doc]);

    function onCategorieChange(newCategoryId) {
        setCategoryId(newCategoryId);
        setTypeDocumentId('');
        setTypesForCategorie([]);
        if (newCategoryId) {
            getTypeDocuments(newCategoryId).then(async (res) => res.ok && setTypesForCategorie(await res.json())).catch(() => {});
        }
    }

    async function confirmerDeplacement(e) {
        e.preventDefault();
        if (!categoryId) {
            toast.error('Choisissez une catégorie');
            return;
        }
        try {
            setSaving(true);
            const res = await updateDocument(doc.id, {
                category_id: categoryId,
                type_document_id: typeDocumentId || null,
                titre: doc.titre_document,
                auteur: doc.auteur,
                resume: doc.resume,
                reference: doc.code_reference,
                personnel_concerne_id: doc.personnel_concerne_id,
                nom_personne_concernee: doc.nom_personne_concernee,
            });
            setSaving(false);
            if (res.status === 200) {
                toast.success('Document déplacé avec succès');
                onMoved && onMoved();
                onClose();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || "Une erreur s'est produite");
            }
        } catch (error) {
            setSaving(false);
            console.log(error);
            toast.error("Une erreur s'est produite");
        }
    }

    if (!isOpen || !doc) return null;

    return (
        <dialog open className="modal">
            <div className="modal-box rounded-2xl">
                <form method="dialog">
                    <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                </form>
                <h1 className='text-lg font-semibold mb-1'>Déplacer le document</h1>
                <p className='text-sm text-muted-foreground mb-4 truncate'>{doc.titre_document}</p>
                <form onSubmit={confirmerDeplacement} className='flex flex-col gap-3'>
                    <div>
                        <label className='block text-sm font-medium mb-1.5'>Catégorie <span className='text-red-500'>*</span></label>
                        <select
                            className='select select-bordered select-sm w-full'
                            value={categoryId}
                            onChange={(e) => onCategorieChange(e.target.value)}
                            required
                        >
                            <option value='' disabled>Choisir une catégorie</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.libelle_cat}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className='block text-sm font-medium mb-1.5'>Sous-dossier</label>
                        <select
                            className='select select-bordered select-sm w-full'
                            value={typeDocumentId}
                            onChange={(e) => setTypeDocumentId(e.target.value)}
                            disabled={!categoryId}
                        >
                            <option value=''>Aucun sous-dossier</option>
                            {typesAvecHierarchie(typesForCategorie).map((t) => (
                                <option key={t.id} value={t.id}>{t.profondeur > 0 ? `${'—'.repeat(t.profondeur)} ${t.libelle}` : t.libelle}</option>
                            ))}
                        </select>
                    </div>
                    <div className="modal-action">
                        <button type="submit" disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                            {saving ? 'Déplacement...' : 'Déplacer ici'}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}

export default DeplacerDocumentModal;
