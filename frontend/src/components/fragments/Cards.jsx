import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuInbox, LuCheckCheck } from 'react-icons/lu';
import { getPartagesRecus, marquerPartageLu, marquerTousPartagesLus } from '../../api/routes/document';
import { getFileTypeVisual, timeAgo } from '../../utils/fileTypeIcons';
import { getInitials } from '../../utils/common';

/**
 * Nom à afficher pour l'expéditeur d'un partage : celui qui a réellement partagé
 * le document, via sa fiche Personnel (prénom/nom) plutôt que le champ technique
 * Utilisateurs.nom — cohérent avec le reste de l'application.
 */
function nomExpediteur(partage, t) {
  const personnel = partage.user?.personnels?.[0];
  if (personnel?.prenom || personnel?.nom) {
    return `${personnel.prenom || ''} ${personnel.nom || ''}`.trim();
  }
  return partage.user?.nom || t('documentsRecus.unCollegue');
}

/**
 * Aperçu des documents récemment partagés avec l'utilisateur connecté, par un
 * collègue ou transmis par un service métier — une vraie boîte de réception :
 * le serveur ne renvoie que les partages pas encore lus (voir
 * DocumentController::partagesRecus()), et ouvrir ou marquer un partage le
 * fait disparaître d'ici plutôt que de rester affiché indéfiniment.
 */
function Cards() {
    const { t } = useTranslation();
    const [partages, setPartages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toutEnCours, setToutEnCours] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        getPartagesRecus(6).then(async (res) => {
            if (res.status === 200) {
                setPartages(await res.json());
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    function openDocument(partage) {
        const doc = partage.shareable;
        const ext = String(doc?.chemin_stockage_serveur).split('.').pop();
        // Retiré de la liste tout de suite (pas besoin d'attendre la réponse
        // serveur) : l'ouverture du document est déjà l'action qui compte pour
        // l'utilisateur, marquer lu est un détail de tenue à jour en arrière-plan.
        setPartages((prev) => prev.filter((p) => p.id !== partage.id));
        marquerPartageLu(partage.id).catch(() => {});
        navigate(`/view/${doc.id}/${ext}`);
    }

    async function toutMarquerLu() {
        setToutEnCours(true);
        try {
            const res = await marquerTousPartagesLus();
            if (res.status === 200) setPartages([]);
        } finally {
            setToutEnCours(false);
        }
    }

    if (loading) return null;

    return (
        <div className='mb-8'>
            <div className='flex items-center justify-between mb-3 gap-3 flex-wrap'>
                <div>
                    <h3 className='text-sm font-semibold text-foreground'>{t('documentsRecus.titre')}</h3>
                    <p className='text-xs text-muted-foreground'>{t('documentsRecus.sousTitre')}</p>
                </div>
                {partages.length > 0 && (
                    <button
                        onClick={toutMarquerLu}
                        disabled={toutEnCours}
                        className='inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-60 shrink-0'
                    >
                        <LuCheckCheck size={13} />
                        {t('documentsRecus.toutMarquerLu')}
                    </button>
                )}
            </div>

            {partages.length === 0 ? (
                <div className='rounded-2xl border border-dashed border-border bg-card/50 p-6 flex items-center gap-3 text-muted-foreground'>
                    <LuInbox size={20} />
                    <p className='text-sm'>{t('documentsRecus.aucunDocument')}</p>
                </div>
            ) : (
                <div className='grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3'>
                    {partages.map((partage) => {
                        const doc = partage.shareable;
                        if (!doc) return null;
                        const { icon: Icon, tint } = getFileTypeVisual(doc.chemin_stockage_serveur);
                        const nom = nomExpediteur(partage, t);
                        const viaService = partage.type_partage === 'service' && partage.service_metier?.nom_service;

                        return (
                            <button
                                key={partage.id}
                                onClick={() => openDocument(partage)}
                                className='relative flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:shadow-md transition-all duration-200'
                            >
                                <span className='absolute top-3 right-3 w-2 h-2 rounded-full bg-primary' title={t('documentsRecus.nonLu')} />
                                <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${tint}`}>
                                    <Icon size={19} />
                                </div>
                                <div className='flex-1 min-w-0'>
                                    <p className='text-sm font-medium text-foreground truncate pr-3'>{doc.titre_document}</p>
                                    {doc.categorie_document && (
                                        <p className='text-xs text-muted-foreground truncate mt-0.5'>{doc.categorie_document.libelle_cat}</p>
                                    )}
                                    <div className='flex items-center gap-1.5 mt-1.5 min-w-0'>
                                        <span className='flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-semibold shrink-0'>
                                            {getInitials(nom)}
                                        </span>
                                        <span className='text-[11px] text-muted-foreground truncate'>
                                            {viaService ? t('documentsRecus.viaService', { service: partage.service_metier.nom_service }) : nom} · {timeAgo(partage.created_at)}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Cards;
