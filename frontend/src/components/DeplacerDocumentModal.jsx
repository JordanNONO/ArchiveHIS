import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { getCategorie } from '../api/routes/categorie';
import { getTypeDocuments } from '../api/routes/typeDocument';
import { updateDocument } from '../api/routes/document';
import { typesAvecHierarchie } from '../utils/typeHierarchie';
import { nomCategorie, nomType } from '../utils/libelleLocalise';
import SelectRecherchable from './SelectRecherchable';

/**
 * Déplace un document vers une autre catégorie/sous-dossier — même endpoint
 * que « Changer de dossier » sur la fiche document (DocView.jsx), mais
 * accessible directement depuis la grille/liste sans avoir à ouvrir chaque
 * document un par un.
 */
function DeplacerDocumentModal({ doc, isOpen, onClose, onMoved }) {
    const { t, i18n } = useTranslation();
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
            toast.error(t('docView.choisirUneCategorie'));
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
                toast.success(t('deplacerDocument.documentDeplace'));
                onMoved && onMoved();
                onClose();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || t('commun.erreurGenerique'));
            }
        } catch (error) {
            setSaving(false);
            console.log(error);
            toast.error(t('commun.erreurGenerique'));
        }
    }

    if (!isOpen || !doc) return null;

    return (
        <dialog open className="modal">
            <div className="modal-box rounded-2xl">
                <form method="dialog">
                    <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                </form>
                <h1 className='text-lg font-semibold mb-1'>{t('deplacerDocument.titre')}</h1>
                <p className='text-sm text-muted-foreground mb-4 truncate'>{doc.titre_document}</p>
                <form onSubmit={confirmerDeplacement} className='flex flex-col gap-3'>
                    <div>
                        <label className='block text-sm font-medium mb-1.5'>{t('deplacerDocument.categorie')} <span className='text-red-500'>*</span></label>
                        <SelectRecherchable
                            options={categories.map((c) => ({ value: c.id, label: nomCategorie(c, i18n.language) }))}
                            value={categoryId}
                            onChange={onCategorieChange}
                            placeholder={t('docView.choisirCategorie')}
                            required
                        />
                    </div>
                    <div>
                        <label className='block text-sm font-medium mb-1.5'>{t('deplacerDocument.sousDossier')}</label>
                        <SelectRecherchable
                            options={[
                                { value: '', label: t('docView.aucunSousDossier') },
                                ...typesAvecHierarchie(typesForCategorie).map((tp) => ({
                                    value: tp.id,
                                    label: tp.profondeur > 0 ? `${'—'.repeat(tp.profondeur)} ${nomType(tp, i18n.language)}` : nomType(tp, i18n.language),
                                })),
                            ]}
                            value={typeDocumentId}
                            onChange={setTypeDocumentId}
                            placeholder={t('docView.aucunSousDossier')}
                            disabled={!categoryId}
                        />
                    </div>
                    <div className="modal-action">
                        <button type="submit" disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                            {saving ? t('deplacerDossier.deplacementEnCours') : t('deplacerDossier.deplacerIci')}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}

export default DeplacerDocumentModal;
