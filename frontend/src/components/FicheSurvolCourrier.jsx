import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuLoader, LuPaperclip } from 'react-icons/lu';
import { libelleTypePiece, nomUtilisateur } from '../utils/piecesJointes';

/**
 * Fiche qui apparaît au survol d'une ligne du registre des courriers : la
 * dernière décision et les pièces versées, sans ouvrir le courrier.
 *
 * Elle évite d'ajouter trois colonnes au registre pour une information qu'on
 * ne lit qu'une ligne à la fois (demande explicite : « pas besoin de la
 * colonne, en survolant une ligne on a les détails directement »).
 *
 * Purement décorative : pointer-events-none, pour ne jamais s'interposer
 * entre la souris et la ligne qu'elle décrit. Elle ne s'affiche pas sur un
 * écran tactile, où le survol n'existe pas — c'est le détail du courrier qui
 * joue ce rôle.
 */

const LARGEUR = 320;
const MARGE = 12;

function FicheSurvolCourrier({ apercu, chargement, ancre, etat, etatClasse }) {
    const { t, i18n } = useTranslation();
    const ref = useRef(null);
    const [position, setPosition] = useState({ left: -9999, top: -9999 });

    // useLayoutEffect : on mesure la fiche et on la place AVANT la peinture,
    // sinon elle apparaît une image au mauvais endroit puis saute.
    useLayoutEffect(() => {
        if (!ancre) return;
        const hauteur = ref.current?.offsetHeight || 0;
        const left = Math.min(Math.max(MARGE, ancre.x + 14), window.innerWidth - LARGEUR - MARGE);
        // Sous la ligne par défaut, au-dessus quand le bas de l'écran est trop proche.
        let top = ancre.bas + 6;
        if (top + hauteur > window.innerHeight - MARGE) top = ancre.haut - hauteur - 6;
        setPosition({ left, top: Math.max(8, top) });
    }, [ancre, apercu, chargement]);

    if (!ancre) return null;

    const decision = apercu?.derniere_decision;
    const pieces = apercu?.pieces_jointes || [];

    return (
        <div
            ref={ref}
            role='tooltip'
            style={{ left: position.left, top: position.top, width: LARGEUR }}
            className='hidden sm:block fixed z-50 pointer-events-none rounded-xl border border-border bg-card shadow-xl px-3.5 py-3 text-[12.5px]'
        >
            {chargement ? (
                <p className='flex items-center gap-2 text-muted-foreground'>
                    <LuLoader size={13} className='animate-spin' /> {t('commun.chargement', { defaultValue: 'Chargement…' })}
                </p>
            ) : (
                <div className='flex flex-col gap-2'>
                    <div className='flex items-center justify-between gap-2'>
                        <span className={`font-semibold ${etatClasse}`}>{etat}</span>
                        {decision && (
                            <span className='text-muted-foreground tabular-nums truncate'>
                                {nomUtilisateur(decision.utilisateur, t('docView.utilisateur'))}
                                {' · '}
                                {new Date(decision.date).toLocaleDateString(i18n.language)}
                            </span>
                        )}
                    </div>

                    {decision?.motif ? (
                        <p className='text-foreground line-clamp-3 whitespace-pre-wrap break-words'>{decision.motif}</p>
                    ) : (
                        <p className='text-muted-foreground'>{t('courriers.aucunCommentaire')}</p>
                    )}

                    {pieces.length > 0 && (
                        <ul className='flex flex-col gap-1 border-t border-border pt-2'>
                            {pieces.map((p) => (
                                <li key={p.id} className='flex items-center gap-1.5 min-w-0'>
                                    <LuPaperclip size={12} className='shrink-0 text-muted-foreground' />
                                    <span className='flex-1 min-w-0 truncate'>{p.nom_fichier_original}</span>
                                    <span className='shrink-0 text-muted-foreground'>{libelleTypePiece(t, p.type_piece)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

export default FicheSurvolCourrier;
