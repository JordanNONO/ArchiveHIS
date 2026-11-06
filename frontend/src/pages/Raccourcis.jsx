import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuKeyboard, LuPrinter, LuRotateCcw, LuSearch } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import CarteClavier from '../components/CarteClavier';
import GroupesRaccourcis from '../components/GroupesRaccourcis';
import ToucheClavier from '../components/ToucheClavier';
import { useRaccourcis } from '../contexts/RaccourcisContext';
import {
    PREFIXES_ACCORD,
    morceauxSignature,
    raccourciEnConflit,
    raccourcisAutorises,
    refusDeTouche,
    signatureEffective,
    signatureEvenement,
    touchesPhysiques,
} from '../utils/raccourcis';

/**
 * Page Raccourcis clavier — un vrai écran du Centre d'aide, consultable sans
 * rien demander à l'assistant (voir Formation.jsx, entièrement
 * conversationnel : on y pose une question, on n'y consulte pas une
 * référence).
 *
 * Elle montre la carte du clavier, la liste groupée, les réglages personnels,
 * le changement de touche et un bac d'essai. Elle n'affiche que les
 * raccourcis autorisés par les droits de la personne : une page qui promet
 * des touches qui ne répondent pas est pire que pas de page.
 */

/**
 * Zone d'écoute de la nouvelle touche. Prend le focus en se montant : sans
 * ça, la première frappe partirait dans le vide (ou, pire, déclencherait le
 * raccourci qu'on essaie justement de redéfinir).
 */
function ZoneCapture({ libelle, onTouche, onSortie }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
        ref.current?.focus();
    }, []);
    return (
        <div
            ref={ref}
            tabIndex={-1}
            role='textbox'
            aria-label={libelle}
            onKeyDown={onTouche}
            onBlur={onSortie}
            className='mt-2 rounded-lg border border-amber-600/50 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40'
        >
            {libelle}
        </div>
    );
}

/** Interrupteur, même dessin que les réglages de la maquette. */
function Interrupteur({ actif, onChange, titre, aide }) {
    return (
        <label className='flex items-start gap-3 border-t border-border/60 first:border-t-0 py-2.5 cursor-pointer'>
            <input type='checkbox' checked={actif} onChange={(e) => onChange(e.target.checked)} className='sr-only peer' />
            <span className={`mt-0.5 shrink-0 relative w-8 h-[18px] rounded-full transition-colors ${actif ? 'bg-primary' : 'bg-border'}`}>
                <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${actif ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
            <span className='flex-1 min-w-0'>
                <span className='block text-[13px] font-semibold text-foreground'>{titre}</span>
                <span className='block text-[12px] text-muted-foreground'>{aide}</span>
            </span>
        </label>
    );
}

function Raccourcis() {
    const { t } = useTranslation();
    const { prefs, majPrefs, reinitialiser, droits } = useRaccourcis();
    const [requete, setRequete] = useState('');
    const [survol, setSurvol] = useState(null);
    const [capture, setCapture] = useState(null);
    const [probleme, setProbleme] = useState(null);
    // Bac d'essai : sa propre ligne « en cours », son propre compte rendu.
    const [ligneEssai, setLigneEssai] = useState(1);
    const [essai, setEssai] = useState(null);
    const [attente, setAttente] = useState(null);

    const liste = useMemo(() => raccourcisAutorises(droits), [droits]);

    const filtree = useMemo(() => {
        const q = requete.trim().toLowerCase();
        if (!q) return liste;
        return liste.filter((r) => {
            const signature = signatureEffective(r, prefs.surcharges);
            const texte = `${t(`raccourcis.a_${r.id}`)} ${morceauxSignature(signature).touches.join(' ')}`;
            return texte.toLowerCase().includes(q);
        });
    }, [liste, requete, prefs.surcharges, t]);

    // État de chaque touche sur la carte. « En service » l'emporte sur
    // « ajouté » : une touche partagée (Ctrl, par exemple) doit se lire comme
    // déjà prise, pas comme une nouveauté.
    const etatsClavier = useMemo(() => {
        const sortie = {};
        liste.forEach((r) => {
            const etat = r.gere === 'reserve' ? 'ecarte' : r.gere === 'externe' ? 'service' : 'ajout';
            touchesPhysiques(signatureEffective(r, prefs.surcharges)).forEach((touche) => {
                if (sortie[touche] === 'service') return;
                sortie[touche] = etat;
            });
        });
        return sortie;
    }, [liste, prefs.surcharges]);

    const surbrillance = useMemo(
        () => (survol ? new Set(touchesPhysiques(signatureEffective(survol, prefs.surcharges))) : null),
        [survol, prefs.surcharges],
    );

    const modifiables = liste.filter((r) => r.modifiable);

    /** Capture de la nouvelle touche. preventDefault empêche aussi le gestionnaire global de réagir. */
    function surCapture(e) {
        e.preventDefault();
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        if (e.key === 'Escape') {
            setCapture(null);
            setProbleme(null);
            return;
        }
        const signature = signatureEvenement(e);
        const refus = refusDeTouche(signature);
        if (refus) {
            setProbleme({ texte: t(refus) });
            return;
        }
        const conflit = raccourciEnConflit(signature, capture, droits, prefs.surcharges);
        if (conflit) {
            setProbleme({
                texte: t('raccourcis.conflit', {
                    touche: morceauxSignature(signature).touches.join(' + '),
                    action: t(`raccourcis.a_${conflit.id}`),
                }),
            });
            return;
        }
        majPrefs({ surcharges: { ...prefs.surcharges, [capture]: signature } });
        setCapture(null);
        setProbleme(null);
        toast.success(t('raccourcis.enregistre'));
    }

    /** Bac d'essai : on nomme ce que la touche déclencherait, sans le déclencher. */
    function surEssai(e) {
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        e.preventDefault();
        const avecCtrl = e.ctrlKey || e.metaKey;
        let signature = signatureEvenement(e);
        if (attente && !avecCtrl) {
            signature = `${attente} ${signature}`;
            setAttente(null);
        } else if (!avecCtrl && PREFIXES_ACCORD.includes(signature)) {
            setAttente(signature);
            setEssai(null);
            return;
        }
        const trouve = liste.find(
            (r) => r.gere !== 'reserve' && signatureEffective(r, prefs.surcharges) === signature,
        );
        setEssai({ signature, id: trouve?.id || null });
        if (trouve?.id === 'listeBas') setLigneEssai((i) => Math.min(2, i + 1));
        if (trouve?.id === 'listeHaut') setLigneEssai((i) => Math.max(0, i - 1));
    }

    return (
        <div className='w-full py-6 flex flex-col gap-5'>
            <div className='print:hidden'>
                <Breadcrumbs where={t('raccourcis.titre')} backTo='/formation' />
                <h2 className='text-2xl font-semibold text-foreground mt-1'>{t('raccourcis.titre')}</h2>
                <p className='text-sm text-muted-foreground mt-1.5 max-w-4xl'>{t('raccourcis.intro')}</p>
            </div>

            {/* ---- barre d'outils ---- */}
            <div className='print:hidden flex flex-wrap items-center gap-2.5'>
                <div className='relative w-full sm:w-80'>
                    <LuSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={15} />
                    <input
                        type='text'
                        value={requete}
                        onChange={(e) => setRequete(e.target.value)}
                        placeholder={t('raccourcis.filtrer')}
                        className='w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                    />
                </div>
                <button
                    type='button'
                    onClick={() => window.print()}
                    className='inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-semibold hover:bg-muted transition-colors'
                >
                    <LuPrinter size={15} /> {t('raccourcis.imprimer')}
                </button>
            </div>

            {/* ---- la fiche : tout ce qui part à l'impression ---- */}
            <div className='fiche-raccourcis flex flex-col gap-4'>
                <div className='impression-seule mb-2'>
                    <strong className='text-lg'>{t('raccourcis.titre')} — {t('commun.entreprise')}</strong>
                </div>

                <div className='rounded-xl border border-border bg-card p-4 flex flex-col lg:flex-row gap-5'>
                    <div className='min-w-0'>
                        <p className='text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5'>{t('raccourcis.carte')}</p>
                        <CarteClavier etats={etatsClavier} surbrillance={surbrillance} />
                    </div>
                    <div className='flex-1 min-w-0 flex flex-col gap-2 lg:pt-5'>
                        <p className='flex items-center gap-2.5 text-[12.5px] text-muted-foreground'>
                            <span className='shrink-0 w-5 h-5 rounded-md border border-b-2 border-green-600/50 bg-green-600/20' /> {t('raccourcis.legendeService')}
                        </p>
                        <p className='flex items-center gap-2.5 text-[12.5px] text-muted-foreground'>
                            <span className='shrink-0 w-5 h-5 rounded-md border border-b-2 border-primary bg-primary' /> {t('raccourcis.legendeAjout')}
                        </p>
                        <p className='flex items-center gap-2.5 text-[12.5px] text-muted-foreground'>
                            <span className='shrink-0 w-5 h-5 rounded-md border border-b-2 border-destructive/40 bg-destructive/10' /> {t('raccourcis.legendeEcarte')}
                        </p>
                        <p className='flex items-center gap-2.5 text-[12.5px] text-muted-foreground'>
                            <span className='shrink-0 w-5 h-5 rounded-md border border-b-2 border-border bg-card' /> {t('raccourcis.legendeLibre')}
                        </p>
                        <p className='text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed print:hidden'>{t('raccourcis.aideCarte')}</p>
                        <p className='text-[12.5px] text-muted-foreground leading-relaxed'>{t('raccourcis.aideCaractere')}</p>
                    </div>
                </div>

                {filtree.length === 0 ? (
                    <p className='rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground'>
                        {t('raccourcis.aucunResultat', { requete: requete.trim() })}
                    </p>
                ) : (
                    <GroupesRaccourcis
                        raccourcis={filtree}
                        surcharges={prefs.surcharges}
                        colonnes='md:grid-cols-2 xl:grid-cols-3'
                        onSurvol={setSurvol}
                    />
                )}

                <p className='text-[12.5px] text-muted-foreground max-w-4xl'>{t('raccourcis.garde')}</p>
            </div>

            {/* ---- réglages personnels ---- */}
            <div className='print:hidden grid lg:grid-cols-2 gap-4 items-start'>
                <div className='rounded-xl border border-border bg-card px-4 py-3'>
                    <p className='text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1'>{t('raccourcis.reglages')}</p>
                    <Interrupteur
                        actif={!!prefs.toucheSimple}
                        onChange={(v) => majPrefs({ toucheSimple: v })}
                        titre={t('raccourcis.toucheSimple')}
                        aide={t('raccourcis.toucheSimpleAide')}
                    />
                    <Interrupteur
                        actif={!!prefs.barreAide}
                        onChange={(v) => majPrefs({ barreAide: v })}
                        titre={t('raccourcis.reglageBarre')}
                        aide={t('raccourcis.reglageBarreAide')}
                    />
                    <Interrupteur
                        actif={!!prefs.annonce}
                        onChange={(v) => majPrefs({ annonce: v })}
                        titre={t('raccourcis.reglageAnnonce')}
                        aide={t('raccourcis.reglageAnnonceAide')}
                    />
                    <p className='text-[11.5px] text-muted-foreground border-t border-border/60 pt-2.5 mt-1'>{t('raccourcis.reglagesPortee')}</p>
                </div>

                {/* ---- changer une touche ---- */}
                <div className='rounded-xl border border-border bg-card px-4 py-3'>
                    <p className='text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1'>{t('raccourcis.changerTouche')}</p>
                    <p className='text-[12px] text-muted-foreground mb-1.5'>{t('raccourcis.changerAide')}</p>
                    <ul className='flex flex-col'>
                        {modifiables.map((r) => {
                            const enCapture = capture === r.id;
                            return (
                                <li key={r.id} className='border-t border-border/60 py-2'>
                                    <div className='flex items-center gap-3'>
                                        <span className='shrink-0 min-w-[74px]'>
                                            {enCapture ? (
                                                <span className='inline-grid place-items-center min-w-[30px] rounded-md border border-dashed border-amber-600 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400'>
                                                    …
                                                </span>
                                            ) : (
                                                <ToucheClavier signature={signatureEffective(r, prefs.surcharges)} />
                                            )}
                                        </span>
                                        <span className='flex-1 min-w-0 text-[13px] text-foreground'>{t(`raccourcis.a_${r.id}`)}</span>
                                        {enCapture ? (
                                            <button
                                                type='button'
                                                onClick={() => { setCapture(null); setProbleme(null); }}
                                                className='shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted transition-colors'
                                            >
                                                {t('raccourcis.annuler')}
                                            </button>
                                        ) : (
                                            <button
                                                type='button'
                                                onClick={() => { setCapture(r.id); setProbleme(null); }}
                                                className='shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted transition-colors'
                                            >
                                                {t('raccourcis.modifier')}
                                            </button>
                                        )}
                                    </div>
                                    {enCapture && (
                                        <ZoneCapture
                                            libelle={probleme ? probleme.texte : t('raccourcis.appuyez')}
                                            onTouche={surCapture}
                                            onSortie={() => { setCapture(null); setProbleme(null); }}
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    <div className='flex justify-end border-t border-border/60 pt-2.5 mt-1'>
                        <button
                            type='button'
                            onClick={() => { reinitialiser(); toast.success(t('raccourcis.retabli')); }}
                            className='inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted transition-colors'
                        >
                            <LuRotateCcw size={13} /> {t('raccourcis.retablir')}
                        </button>
                    </div>
                </div>
            </div>

            {/* ---- bac d'essai ---- */}
            <div className='print:hidden rounded-xl border border-border bg-card px-4 py-3'>
                <p className='text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2'>{t('raccourcis.bacTitre')}</p>
                {/* Une zone focalisable : c'est le focus qui décide où partent les
                    touches, et le bac doit les intercepter avant le gestionnaire
                    global pour ne rien déclencher pour de vrai. */}
                <div
                    tabIndex={0}
                    role='group'
                    aria-label={t('raccourcis.bacTitre')}
                    onKeyDown={surEssai}
                    className='rounded-lg border border-border overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/30'
                >
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className={`flex items-center gap-2.5 px-3 py-2 text-[13px] border-t border-border/60 first:border-t-0 ${i === ligneEssai ? 'bg-primary/10 ring-2 ring-inset ring-primary font-semibold' : ''}`}
                        >
                            <span className={`shrink-0 w-3.5 h-3.5 rounded border ${i === ligneEssai ? 'border-primary bg-primary' : 'border-border'}`} />
                            <LuKeyboard size={14} className='shrink-0 text-muted-foreground' />
                            {t('raccourcis.exemple', { lettre: ['A', 'B', 'C'][i] })}
                        </div>
                    ))}
                </div>
                <div className='mt-2.5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2'>
                    <span className='text-[11px] font-bold uppercase tracking-wider text-muted-foreground'>{t('raccourcis.detecte')}</span>
                    {attente && <ToucheClavier signature={attente} />}
                    {essai && <ToucheClavier signature={essai.signature} />}
                    <span className='flex-1 min-w-[180px] text-[13px] text-foreground'>
                        {attente
                            ? t('raccourcis.attente')
                            : essai
                                ? essai.id ? t(`raccourcis.a_${essai.id}`) : t('raccourcis.inconnu')
                                : t('raccourcis.bacInvite')}
                    </span>
                    {essai?.id && (
                        <span className='shrink-0 rounded-full bg-green-600/15 px-2 py-0.5 text-[10px] font-bold text-green-800 dark:text-green-300'>
                            {t('raccourcis.reconnu')}
                        </span>
                    )}
                </div>
                <p className='text-[12.5px] text-muted-foreground mt-2'>{t('raccourcis.bacAide')}</p>
            </div>
        </div>
    );
}

export default Raccourcis;
