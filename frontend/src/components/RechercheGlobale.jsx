import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuSearch, LuX, LuCornerDownLeft } from 'react-icons/lu';
import { usePermissions } from '../hooks/usePermissions';
import { correspondARequete } from '../utils/recherche';
import { listeFonctionnalites } from '../constants/fonctionnalitesApp';

/**
 * Recherche globale des fonctionnalités de l'appli — "comme sur un
 * téléphone" (retour utilisateur) : Ctrl/Cmd+K depuis n'importe où (ou le
 * bouton dans Navbar.jsx) ouvre une fenêtre centrée, on tape, on ouvre le
 * premier résultat avec Entrée ou un clic. Ne cherche que dans les PAGES de
 * l'appli (voir fonctionnalitesApp.js), pas dans les documents — la
 * recherche documentaire existante (Home.jsx) reste l'outil dédié pour ça.
 */
function RechercheGlobale() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isAdministrator, hasPermission } = usePermissions();
    const [ouvert, setOuvert] = useState(false);
    const [requete, setRequete] = useState('');
    const inputRef = useRef(null);

    const fonctionnalites = useMemo(() => listeFonctionnalites(t).filter((f) => {
        if (f.adminOnly) return isAdministrator;
        if (f.permission) return isAdministrator || hasPermission(f.permission);
        return true;
    }), [t, isAdministrator, hasPermission]);

    const resultats = useMemo(() => {
        const q = requete.trim();
        if (!q) return fonctionnalites;
        return fonctionnalites.filter((f) => correspondARequete([f.label], q));
    }, [fonctionnalites, requete]);

    useEffect(() => {
        function onKeyDown(e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOuvert((v) => !v);
            } else if (e.key === 'Escape') {
                setOuvert(false);
            }
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        if (ouvert) {
            setRequete('');
            // Laisse la fenêtre finir de s'afficher avant de focus (sinon perdu
            // sur certains navigateurs si le dialog n'est pas encore peint).
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [ouvert]);

    function ouvrir(fonctionnalite) {
        navigate(fonctionnalite.to);
        setOuvert(false);
    }

    function onKeyDownRecherche(e) {
        if (e.key === 'Enter' && resultats[0]) ouvrir(resultats[0]);
    }

    return (
        <>
            <button
                type='button'
                onClick={() => setOuvert(true)}
                title={t('rechercheGlobale.ouvrir')}
                className='flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
            >
                <LuSearch size={15} />
                <span className='hidden md:inline'>{t('rechercheGlobale.placeholder')}</span>
                <span className='hidden md:inline rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono'>Ctrl K</span>
            </button>

            {ouvert && (
                <div className='fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4'>
                    <div className='absolute inset-0 bg-black/50' onClick={() => setOuvert(false)} />
                    <div className='relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden'>
                        <div className='flex items-center gap-2.5 px-4 py-3 border-b border-border'>
                            <LuSearch size={17} className='text-muted-foreground shrink-0' />
                            <input
                                ref={inputRef}
                                type='text'
                                value={requete}
                                onChange={(e) => setRequete(e.target.value)}
                                onKeyDown={onKeyDownRecherche}
                                placeholder={t('rechercheGlobale.placeholder')}
                                className='flex-1 min-w-0 bg-transparent text-sm focus:outline-none'
                            />
                            <button type='button' onClick={() => setOuvert(false)} className='flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0'>
                                <LuX size={14} />
                            </button>
                        </div>
                        <div className='max-h-[50vh] overflow-y-auto py-1.5'>
                            {resultats.length === 0 ? (
                                <p className='px-4 py-6 text-center text-sm text-muted-foreground'>{t('rechercheGlobale.aucunResultat')}</p>
                            ) : resultats.map((f, i) => (
                                <button
                                    key={f.id}
                                    type='button'
                                    onClick={() => ouvrir(f)}
                                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/60 transition-colors ${i === 0 ? 'bg-muted/40' : ''}`}
                                >
                                    <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0'>
                                        <f.icon size={15} />
                                    </span>
                                    <span className='flex-1 min-w-0 font-medium text-foreground truncate'>{f.label}</span>
                                    {i === 0 && <LuCornerDownLeft size={13} className='text-muted-foreground shrink-0' />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default RechercheGlobale;
