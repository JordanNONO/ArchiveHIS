import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuSparkles, LuLoader2 } from 'react-icons/lu';
import { analyserDocumentIa } from '../api/routes/document';

const EXTENSIONS_SUPPORTEES = ['pdf', 'jpg', 'jpeg', 'png'];

/**
 * Bouton "Analyser avec l'IA" partagé entre ArchiverDocumentModal.jsx et
 * OpenFolder.jsx (qui a son propre formulaire d'archivage dupliqué — voir
 * historique git) : lit le fichier tout juste sélectionné et propose
 * titre/résumé/référence/texte extrait via l'IA, toujours éditables ensuite.
 * N'apparaît que pour les formats qu'on sait analyser (PDF/image) — pas
 * d'erreur pour les autres, juste absent. Échec silencieux (toast discret) :
 * ne bloque jamais la saisie manuelle.
 */
function AnalyserIaBouton({ file, onResultat }) {
    const { t } = useTranslation();
    const [enCours, setEnCours] = useState(false);

    const extension = file?.name?.split('.').pop()?.toLowerCase();
    if (!file || !EXTENSIONS_SUPPORTEES.includes(extension)) return null;

    async function analyser() {
        if (enCours) return;
        try {
            setEnCours(true);
            const res = await analyserDocumentIa(file);
            const data = await res.json().catch(() => ({}));
            if (res.status === 200 && (data.titre_suggere || data.resume_suggere || data.texte_extrait)) {
                onResultat(data);
                toast.success(t('openFolder.iaAnalyseReussie'));
            } else {
                toast.info(t('openFolder.iaAnalyseIndisponible'));
            }
        } catch (error) {
            console.log(error);
            toast.info(t('openFolder.iaAnalyseIndisponible'));
        } finally {
            setEnCours(false);
        }
    }

    return (
        <button
            type='button'
            onClick={analyser}
            disabled={enCours}
            className='inline-flex items-center gap-1.5 self-start rounded-lg border border-primary/30 text-primary px-3 py-1.5 text-xs font-medium hover:bg-primary/10 transition-colors disabled:opacity-60'
        >
            {enCours ? <LuLoader2 size={13} className='animate-spin' /> : <LuSparkles size={13} />}
            {enCours ? t('openFolder.iaAnalyseEnCours') : t('openFolder.iaAnalyserBouton')}
        </button>
    );
}

export default AnalyserIaBouton;
