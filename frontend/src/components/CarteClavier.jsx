import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Carte d'un clavier AZERTY, avec l'état de chaque touche : prise par un
 * raccourci déjà en service, prise par un raccourci ajouté, écartée
 * volontairement, ou libre.
 *
 * C'est la pièce qui justifie une page plutôt qu'une simple liste : quand on
 * voudra ajouter un raccourci dans six mois, on verra d'un coup d'œil ce qui
 * reste disponible, au lieu de relire vingt lignes.
 *
 * Le dessin reste un AZERTY même pour les autres langues de l'interface : il
 * montre où appuyer sur le clavier qu'ont réellement les postes de
 * l'association. Les raccourcis, eux, suivent le caractère produit (voir
 * utils/raccourcis.js) et fonctionnent donc sur n'importe quelle disposition.
 */

// `c` : le nom normalisé de la touche (celui des signatures). `l` : ce qui
// est écrit dessus. `w` : largeur en multiples de la touche de base, pour les
// touches longues (Maj, Espace…).
const RANGEES = [
    [
        { c: 'Escape', l: 'Échap', w: 1.6 },
        ...['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].map((f) => ({ c: f, l: f })),
    ],
    [
        ...['&', 'é', '"', "'", '(', '-', 'è', '_', 'ç', 'à', ')', '='].map((k) => ({ c: k, l: k })),
        { c: 'Backspace', l: '⌫', w: 1.6 },
    ],
    [
        { c: 'Tab', l: '⇥', w: 1.6 },
        ...['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].map((k) => ({ c: k, l: k.toUpperCase() })),
        { c: '^', l: '^' },
        { c: '$', l: '$' },
    ],
    [
        { c: 'CapsLock', l: '⇪', w: 2 },
        ...['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'].map((k) => ({ c: k, l: k.toUpperCase() })),
        { c: 'ù', l: 'ù' },
        { c: 'Enter', l: '⏎', w: 1.8 },
    ],
    [
        { c: 'Shift', l: '⇧', w: 2.6 },
        ...['w', 'x', 'c', 'v', 'b', 'n'].map((k) => ({ c: k, l: k.toUpperCase() })),
        ...[',', ';', ':', '!'].map((k) => ({ c: k, l: k })),
        { c: 'ShiftDroite', l: '⇧', w: 2 },
    ],
    [
        { c: 'Control', l: 'Ctrl', w: 1.9 },
        { c: 'Alt', l: 'Alt', w: 1.4 },
        { c: 'Espace', l: 'Espace', w: 6.4 },
        { c: 'AltGr', l: 'AltGr', w: 1.4 },
        { c: 'ControlDroite', l: 'Ctrl', w: 1.9 },
    ],
];

// Pavé de déplacement, tenu à part : il ne s'aligne pas sur les rangées de
// lettres, et c'est là que vit Suppr — la touche qu'on montre justement pour
// dire qu'elle reste libre de toute action destructrice.
const PAVE_HAUT = [{ c: 'Delete', l: 'Suppr', w: 1.6 }, { c: 'ArrowUp', l: '↑' }];
const PAVE_BAS = [{ c: 'ArrowLeft', l: '←' }, { c: 'ArrowDown', l: '↓' }, { c: 'ArrowRight', l: '→' }];

const LARGEUR_BASE = 29;
const HAUTEUR = 27;

const TEINTES = {
    service: 'bg-green-600/20 border-green-600/50 text-green-800 dark:text-green-300',
    ajout: 'bg-primary border-primary text-white',
    ecarte: 'bg-destructive/10 border-destructive/40 text-destructive line-through',
    libre: 'bg-card border-border text-muted-foreground',
};

function Touche({ touche, etat, allumee }) {
    const teinte = TEINTES[etat] || TEINTES.libre;
    return (
        <span
            className={`shrink-0 grid place-items-center rounded-md border border-b-2 font-mono text-[10px] font-semibold tabular-nums transition-all ${teinte} ${allumee ? 'ring-2 ring-accent ring-offset-1 ring-offset-card -translate-y-0.5' : ''}`}
            style={{ width: LARGEUR_BASE * (touche.w || 1), height: HAUTEUR }}
        >
            {touche.l}
        </span>
    );
}

/**
 * @param {Object} etats          nom de touche → 'service' | 'ajout' | 'ecarte'
 * @param {Set}    surbrillance   noms de touches à faire ressortir (ligne survolée)
 */
function CarteClavier({ etats = {}, surbrillance }) {
    const { t } = useTranslation();
    // Les deux Maj et les deux Ctrl partagent l'état de leur homologue : une
    // touche de modification est la même action des deux côtés du clavier.
    const etatDe = (c) => etats[c.replace('Droite', '')] || null;
    const allumee = (c) => !!surbrillance?.has(c.replace('Droite', ''));

    return (
        <div className='flex gap-2.5 items-start overflow-x-auto pb-1' role='img' aria-label={t('raccourcis.carte')}>
            <div className='flex flex-col gap-1 shrink-0'>
                {RANGEES.map((rangee, i) => (
                    <div key={i} className='flex gap-1'>
                        {rangee.map((touche) => (
                            <Touche key={touche.c} touche={touche} etat={etatDe(touche.c)} allumee={allumee(touche.c)} />
                        ))}
                    </div>
                ))}
            </div>
            <div className='flex flex-col gap-1 shrink-0 self-end'>
                <div className='flex gap-1 justify-end'>
                    {PAVE_HAUT.map((touche) => (
                        <Touche key={touche.c} touche={touche} etat={etatDe(touche.c)} allumee={allumee(touche.c)} />
                    ))}
                </div>
                <div className='flex gap-1'>
                    {PAVE_BAS.map((touche) => (
                        <Touche key={touche.c} touche={touche} etat={etatDe(touche.c)} allumee={allumee(touche.c)} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default CarteClavier;
