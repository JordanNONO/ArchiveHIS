import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuArrowLeft, LuFolder } from 'react-icons/lu';
import { getTypeDocuments, moveTypeDocument } from '../api/routes/typeDocument';
import { nomType } from '../utils/libelleLocalise';

/**
 * Déplace un sous-dossier (TypeDocument) vers un autre parent, toujours dans
 * la même catégorie que le dossier déplacé (voir TypeDocumentController::move
 * — un déplacement inter-catégorie déplacerait aussi tous les fichiers sur
 * disque, ce qu'on ne fait pas). Navigateur à la « explorateur de fichiers » :
 * on parcourt l'arborescence de la catégorie et on choisit où atterrir.
 */
function DeplacerDossierModal({ type, isOpen, onClose, onMoved }) {
    const { t, i18n } = useTranslation();
    const [allTypes, setAllTypes] = useState([]);
    const [chemin, setChemin] = useState([]); // pile de {id, libelle} parcourus, racine = []
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen || !type) return;
        setChemin([]);
        getTypeDocuments(type.categorie_id).then(async (res) => res.ok && setAllTypes(await res.json())).catch(() => {});
    }, [isOpen, type]);

    /** id du dossier déplacé + tous ses descendants — on ne peut ni le
     * déplacer dans lui-même, ni dans l'un de ses propres sous-dossiers. */
    const idsExclus = useMemo(() => {
        if (!type) return new Set();
        const exclus = new Set([type.id]);
        let ajoute = true;
        while (ajoute) {
            ajoute = false;
            for (const t of allTypes) {
                if (t.parent_id && exclus.has(t.parent_id) && !exclus.has(t.id)) {
                    exclus.add(t.id);
                    ajoute = true;
                }
            }
        }
        return exclus;
    }, [type, allTypes]);

    const parentActuelId = chemin.length > 0 ? chemin[chemin.length - 1].id : null;
    const dossiersDuNiveau = allTypes
        .filter((t) => (t.parent_id || null) === parentActuelId && !idsExclus.has(t.id))
        .sort((a, b) => a.libelle.localeCompare(b.libelle));

    async function confirmerDeplacement() {
        try {
            setSaving(true);
            const res = await moveTypeDocument(type.id, parentActuelId);
            setSaving(false);
            if (res.status === 200) {
                toast.success(t('deplacerDossier.dossierDeplace'));
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

    if (!isOpen || !type) return null;

    return (
        <dialog open className="modal">
            <div className="modal-box rounded-2xl">
                <form method="dialog">
                    <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                </form>
                <h1 className='text-lg font-semibold mb-1'>{t('deplacerDossier.titre', { nom: nomType(type, i18n.language) })}</h1>
                <p className='text-sm text-muted-foreground mb-4'>{t('deplacerDossier.choisirDestination')}</p>

                <div className='flex items-center gap-2 mb-3'>
                    {chemin.length > 0 && (
                        <button
                            onClick={() => setChemin((prev) => prev.slice(0, -1))}
                            className='flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-muted transition-colors shrink-0'
                        >
                            <LuArrowLeft size={14} />
                        </button>
                    )}
                    <p className='text-sm font-medium truncate'>
                        {parentActuelId === null ? t('deplacerDossier.racineCategorie') : nomType(chemin[chemin.length - 1], i18n.language)}
                    </p>
                </div>

                <div className='rounded-xl border border-border divide-y divide-border max-h-64 overflow-y-auto mb-4'>
                    {dossiersDuNiveau.length === 0 && (
                        <p className='text-sm text-muted-foreground p-3'>{t('deplacerDossier.aucunSousDossierIci')}</p>
                    )}
                    {dossiersDuNiveau.map((dt) => (
                        <button
                            key={dt.id}
                            onClick={() => setChemin((prev) => [...prev, dt])}
                            className='flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-muted/60 transition-colors'
                        >
                            <LuFolder size={16} className='text-primary shrink-0' />
                            <span className='text-sm truncate'>{nomType(dt, i18n.language)}</span>
                        </button>
                    ))}
                </div>

                <div className="modal-action">
                    <button
                        type="button"
                        disabled={saving || (parentActuelId || null) === (type.parent_id || null)}
                        onClick={confirmerDeplacement}
                        className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'
                    >
                        {saving ? t('deplacerDossier.deplacementEnCours') : t('deplacerDossier.deplacerIci')}
                    </button>
                </div>
            </div>
        </dialog>
    );
}

export default DeplacerDossierModal;
