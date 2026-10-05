import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuSearch, LuX, LuCornerDownLeft, LuLoader2, LuUsers2, LuFileText, LuMail, LuPhoneIncoming, LuLandmark, LuListChecks } from 'react-icons/lu';
import { usePermissions } from '../hooks/usePermissions';
import { useDossierPersonne } from '../contexts/DossierPersonneContext';
import { correspondARequete } from '../utils/recherche';
import { listeFonctionnalites } from '../constants/fonctionnalitesApp';
import { rechercherGlobalement } from '../api/routes/recherche';

/**
 * Recherche globale — Ctrl/Cmd+K depuis n'importe où (ou le bouton dans
 * Navbar.jsx) ouvre une fenêtre centrée, on tape, on ouvre le premier
 * résultat avec Entrée ou un clic. Cherche à la fois dans les PAGES de
 * l'appli (voir fonctionnalitesApp.js, instantané côté client) ET dans les
 * vraies données (personnel/documents/courriers/appels/chèques/PAI, via
 * RechercheController::globale(), débouncé) — taper un nom amène donc
 * directement à la bonne fiche, pas seulement à la bonne page. Un résultat
 * "personnel" ouvre le volet "dossier unique" (DossierPersonneContext)
 * plutôt que de naviguer, pour rester cohérent avec le reste de l'appli.
 */
function RechercheGlobale() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isAdministrator, hasPermission } = usePermissions();
    const { ouvrirDossier } = useDossierPersonne();
    const [ouvert, setOuvert] = useState(false);
    const [requete, setRequete] = useState('');
    const [donnees, setDonnees] = useState(null);
    const [chargement, setChargement] = useState(false);
    const inputRef = useRef(null);

    const fonctionnalites = useMemo(() => listeFonctionnalites(t).filter((f) => {
        if (f.adminOnly) return isAdministrator;
        if (f.permission) return isAdministrator || hasPermission(f.permission);
        return true;
    }), [t, isAdministrator, hasPermission]);

    const pagesTrouvees = useMemo(() => {
        const q = requete.trim();
        if (!q) return fonctionnalites;
        return fonctionnalites.filter((f) => correspondARequete([f.label], q));
    }, [fonctionnalites, requete]);

    // Débouncée et seulement à partir de 2 caractères, comme la recherche
    // documentaire existante — évite d'interroger le serveur à chaque frappe.
    useEffect(() => {
        const q = requete.trim();
        if (q.length < 2) { setDonnees(null); setChargement(false); return; }
        setChargement(true);
        const id = setTimeout(() => {
            rechercherGlobalement(q).then(async (res) => {
                if (res.status === 200) setDonnees(await res.json());
            }).finally(() => setChargement(false));
        }, 250);
        return () => clearTimeout(id);
    }, [requete]);

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
            setDonnees(null);
            // Laisse la fenêtre finir de s'afficher avant de focus (sinon perdu
            // sur certains navigateurs si le dialog n'est pas encore peint).
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [ouvert]);

    function fermer() { setOuvert(false); }
    function allerVersLien(lien) { navigate(lien); fermer(); }
    function voirPersonne(id) { fermer(); ouvrirDossier(id); }

    // Regroupe pages + données serveur en sections, pour l'affichage et pour
    // que Entrée ouvre toujours le tout premier résultat, quelle que soit sa
    // section.
    const sections = useMemo(() => {
        const liste = [{
            titre: t('rechercheGlobale.sectionPages'),
            items: pagesTrouvees.map((f) => ({ key: `page-${f.id}`, icon: f.icon, titre: f.label, action: () => { navigate(f.to); fermer(); } })),
        }];
        if (donnees) {
            const groupes = [
                ['personnes', 'sectionPersonnes', LuUsers2, (p) => voirPersonne(p.id)],
                ['documents', 'sectionDocuments', LuFileText, (d) => allerVersLien(d.lien)],
                ['courriers', 'sectionCourriers', LuMail, (c) => allerVersLien(c.lien)],
                ['appels', 'sectionAppels', LuPhoneIncoming, (a) => allerVersLien(a.lien)],
                ['cheques', 'sectionCheques', LuLandmark, (c) => allerVersLien(c.lien)],
                ['pai', 'sectionPai', LuListChecks, (p) => allerVersLien(p.lien)],
            ];
            for (const [cle, labelCle, Icon, action] of groupes) {
                const items = donnees[cle] || [];
                if (items.length === 0) continue;
                liste.push({
                    titre: t(`rechercheGlobale.${labelCle}`),
                    items: items.map((item) => ({ key: `${cle}-${item.id}`, icon: Icon, titre: item.titre, sousTitre: item.sousTitre, action: () => action(item) })),
                });
            }
        }
        return liste.filter((s) => s.items.length > 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pagesTrouvees, donnees, t]);

    const premierResultat = sections[0]?.items[0];
    const aucunResultat = sections.length === 0;

    function onKeyDownRecherche(e) {
        if (e.key === 'Enter' && premierResultat) premierResultat.action();
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
                    <div className='absolute inset-0 bg-black/50' onClick={fermer} />
                    <div className='relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden'>
                        <div className='flex items-center gap-2.5 px-4 py-3 border-b border-border'>
                            {chargement ? (
                                <LuLoader2 size={17} className='text-muted-foreground shrink-0 animate-spin' />
                            ) : (
                                <LuSearch size={17} className='text-muted-foreground shrink-0' />
                            )}
                            <input
                                ref={inputRef}
                                type='text'
                                value={requete}
                                onChange={(e) => setRequete(e.target.value)}
                                onKeyDown={onKeyDownRecherche}
                                placeholder={t('rechercheGlobale.placeholder')}
                                className='flex-1 min-w-0 bg-transparent text-sm focus:outline-none'
                            />
                            <button type='button' onClick={fermer} className='flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0'>
                                <LuX size={14} />
                            </button>
                        </div>
                        <div className='max-h-[60vh] overflow-y-auto py-1.5'>
                            {aucunResultat ? (
                                <p className='px-4 py-6 text-center text-sm text-muted-foreground'>{t('rechercheGlobale.aucunResultat')}</p>
                            ) : sections.map((section, si) => (
                                <div key={section.titre}>
                                    <p className='px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70'>{section.titre}</p>
                                    {section.items.map((item, i) => (
                                        <button
                                            key={item.key}
                                            type='button'
                                            onClick={item.action}
                                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/60 transition-colors ${si === 0 && i === 0 ? 'bg-muted/40' : ''}`}
                                        >
                                            <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0'>
                                                <item.icon size={15} />
                                            </span>
                                            <span className='flex-1 min-w-0'>
                                                <span className='block font-medium text-foreground truncate'>{item.titre}</span>
                                                {item.sousTitre && <span className='block text-xs text-muted-foreground truncate'>{item.sousTitre}</span>}
                                            </span>
                                            {si === 0 && i === 0 && <LuCornerDownLeft size={13} className='text-muted-foreground shrink-0' />}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default RechercheGlobale;
