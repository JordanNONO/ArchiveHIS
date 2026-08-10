import React, { useEffect, useState } from 'react';
import mammoth from 'mammoth';

/**
 * Aperçu du contenu réel d'un fichier sélectionné, avant même son envoi au serveur :
 * rendu PDF natif, texte pour Word. Permet de vérifier qu'on téléverse bien le bon
 * document. Excel/CSV et PowerPoint n'ont pas de rendu fiable disponible sans
 * dépendance supplémentaire incompatible avec le bundler de ce projet — ils
 * gardent juste l'icône (voir FilePreviewCard).
 */
function FileContentPreview({ file }) {
    const [state, setState] = useState({ status: 'loading', html: null, pdfUrl: null });

    useEffect(() => {
        if (!file) return;
        const ext = file.name.split('.').pop()?.toLowerCase();
        setState({ status: 'loading', html: null, pdfUrl: null });

        if (ext === 'pdf') {
            const url = URL.createObjectURL(file);
            setState({ status: 'pdf', html: null, pdfUrl: url });
            return () => URL.revokeObjectURL(url);
        }

        if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
            const url = URL.createObjectURL(file);
            setState({ status: 'image', html: null, pdfUrl: url });
            return () => URL.revokeObjectURL(url);
        }

        if (ext === 'doc' || ext === 'docx') {
            const reader = new FileReader();
            reader.onload = (e) => {
                mammoth.convertToHtml({ arrayBuffer: e.target.result })
                    .then((result) => setState({ status: 'html', html: result.value, pdfUrl: null }))
                    .catch(() => setState({ status: 'unsupported' }));
            };
            reader.onerror = () => setState({ status: 'unsupported' });
            reader.readAsArrayBuffer(file);
            return;
        }

        setState({ status: 'unsupported' });
    }, [file]);

    if (state.status === 'unsupported') return null;

    if (state.status === 'loading') {
        return <div className='w-full h-48 rounded-lg bg-muted animate-pulse' />;
    }

    if (state.status === 'pdf') {
        return (
            <iframe
                src={state.pdfUrl}
                title="Aperçu du PDF"
                className='w-full h-64 rounded-lg border border-border'
            />
        );
    }

    if (state.status === 'image') {
        return (
            <img
                src={state.pdfUrl}
                alt="Aperçu"
                className='w-full h-64 rounded-lg border border-border object-contain bg-muted'
            />
        );
    }

    if (state.status === 'html') {
        return (
            <div className='relative w-full h-48 rounded-lg border border-border bg-white overflow-hidden'>
                <div className='p-3 text-xs text-gray-800 overflow-hidden' dangerouslySetInnerHTML={{ __html: state.html }} />
                <div className='absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent' />
            </div>
        );
    }

    return null;
}

export default FileContentPreview;
