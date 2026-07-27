import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuInbox } from 'react-icons/lu';
import { getPartagesRecus } from '../../api/routes/document';
import { getFileTypeVisual, timeAgo } from '../../utils/fileTypeIcons';
import { getInitials } from '../../utils/common';

/**
 * Nom à afficher pour l'expéditeur d'un partage : celui qui a réellement partagé
 * le document, via sa fiche Personnel (prénom/nom) plutôt que le champ technique
 * Utilisateurs.nom — cohérent avec le reste de l'application.
 */
function nomExpediteur(partage) {
  const personnel = partage.user?.personnels?.[0];
  if (personnel?.prenom || personnel?.nom) {
    return `${personnel.prenom || ''} ${personnel.nom || ''}`.trim();
  }
  return partage.user?.nom || 'Un collègue';
}

/**
 * Aperçu des documents récemment partagés avec l'utilisateur connecté,
 * par un collègue ou transmis par un service métier.
 */
function Cards() {
    const [partages, setPartages] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        getPartagesRecus(6).then(async (res) => {
            if (res.status === 200) {
                setPartages(await res.json());
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    function openDocument(doc) {
        const ext = String(doc?.chemin_stockage_serveur).split('.').pop();
        navigate(`/view/${doc.id}/${ext}`);
    }

    if (loading) return null;

    return (
        <div className='mb-8'>
            <div className='flex items-center justify-between mb-3'>
                <h3 className='text-sm font-semibold text-foreground'>Documents reçus</h3>
                <p className='text-xs text-muted-foreground'>Partagés par vos collègues et vos services</p>
            </div>

            {partages.length === 0 ? (
                <div className='rounded-2xl border border-dashed border-border bg-card/50 p-6 flex items-center gap-3 text-muted-foreground'>
                    <LuInbox size={20} />
                    <p className='text-sm'>Aucun document reçu pour le moment. Ce qu'un collègue ou un service partage avec vous apparaîtra ici.</p>
                </div>
            ) : (
                <div className='grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3'>
                    {partages.map((partage) => {
                        const doc = partage.shareable;
                        if (!doc) return null;
                        const { icon: Icon, tint } = getFileTypeVisual(doc.chemin_stockage_serveur);
                        const nom = nomExpediteur(partage);
                        const viaService = partage.type_partage === 'service' && partage.service_metier?.nom_service;

                        return (
                            <button
                                key={partage.id}
                                onClick={() => openDocument(doc)}
                                className='flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:shadow-md transition-all duration-200'
                            >
                                <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${tint}`}>
                                    <Icon size={19} />
                                </div>
                                <div className='flex-1 min-w-0'>
                                    <p className='text-sm font-medium text-foreground truncate'>{doc.titre_document}</p>
                                    {doc.categorie_document && (
                                        <p className='text-xs text-muted-foreground truncate mt-0.5'>{doc.categorie_document.libelle_cat}</p>
                                    )}
                                    <div className='flex items-center gap-1.5 mt-1.5 min-w-0'>
                                        <span className='flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-semibold shrink-0'>
                                            {getInitials(nom)}
                                        </span>
                                        <span className='text-[11px] text-muted-foreground truncate'>
                                            {viaService ? `Service ${partage.service_metier.nom_service}` : nom} · {timeAgo(partage.created_at)}
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
