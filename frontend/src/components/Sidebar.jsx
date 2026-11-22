import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    LuChevronDown, LuPanelLeftClose, LuPanelLeftOpen, LuPhoneCall, LuTrash2, LuUser, LuKeyboard,
    LuLogOut, LuShieldCheck, LuTag, LuBuilding2, LuBriefcase, LuChevronsUpDown, LuKeyRound, LuPalette,
    LuWallet, LuFolderOpen,
} from 'react-icons/lu';
import { IoApps } from 'react-icons/io5';
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import hisLogo from '../assets/his-badge.png';
import { SERVER_URL } from '../api';
import { LANGUES_DISPONIBLES } from '../i18n';
import { getDisplayName, getInitials } from '../utils/common';
import { deconnecter } from '../utils/deconnexion';
import { usePermissions } from '../hooks/usePermissions';
import { useOrdrePersonnalise } from '../hooks/useOrdrePersonnalise';
import { groupesVisibles, estLienActif } from '../constants/navigation';
import { tuilesDuTableauDeBord } from '../constants/typesDemande';
import LogoSaisonnier from './LogoSaisonnier';

const ROLES_DEPOT = ['Intervenant', 'Beneficiaire'];
const CLE_GROUPES_FERMES = 'his_sidebar_groupes_fermes';
const OR = '#FACC14';

// `permission` : chaque lien exige la sienne propre — voir Settings.jsx.
const ADMIN_LINKS = [
    { tab: 'roles', labelKey: 'sidebar.rolesPermissions', icon: LuShieldCheck, permission: 'gerer_roles' },
    { tab: 'categories', labelKey: 'sidebar.categories', icon: LuTag, permission: 'gerer_categories' },
    { tab: 'bureaux', labelKey: 'sidebar.bureaux', icon: LuBuilding2, permission: 'gerer_utilisateurs' },
    { tab: 'services', labelKey: 'sidebar.servicesMetier', icon: LuBriefcase, permission: 'gerer_services_metier' },
];

const FOCUS_OR = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FACC14]';

function formaterCompteur(n) {
    return n > 999 ? '999+' : String(n);
}

function lireGroupesFermes() {
    try {
        const v = JSON.parse(localStorage.getItem(CLE_GROUPES_FERMES) || '{}');
        return v && typeof v === 'object' ? v : {};
    } catch {
        return {};
    }
}

/** Un élément du menu déplié — états : défaut, survol, actif (or), focus clavier (anneau or). */
function ElementMenu({ to, icon: Icone, libelle, compteur, actif, ...rest }) {
    const { t } = useTranslation();
    return (
        <Link
            to={to}
            aria-current={actif ? 'page' : undefined}
            className={`relative flex h-9 w-full items-center gap-2.5 rounded-[10px] pl-3 pr-2.5 text-[13px] transition-colors ${FOCUS_OR} ${actif ? 'bg-[#FACC14]/[0.14] font-semibold text-white' : 'font-medium text-white/[0.76] hover:bg-white/[0.07] hover:text-white'}`}
            {...rest}
        >
            {actif && <span aria-hidden='true' className='absolute -left-3 bottom-2 top-2 w-[3px] rounded-r-[3px] bg-[#FACC14]' />}
            <Icone size={17} className='shrink-0' style={actif ? { color: OR } : undefined} />
            <span className='truncate'>{libelle}</span>
            {compteur > 0 && (
                <span
                    aria-label={t('sidebar.enAttente', { count: compteur })}
                    className={`ml-auto inline-flex h-5 min-w-[24px] items-center justify-center rounded-full px-[7px] text-xs font-semibold tabular-nums ${actif ? 'bg-[#FACC14] text-[#0A0F16]' : 'bg-white/[0.12] text-white'}`}
                >
                    {formaterCompteur(compteur)}
                </span>
            )}
        </Link>
    );
}

/**
 * Lien glissable sur toute la ligne (rester appuyé ~400 ms), comme avant la
 * refonte — l'ordre se règle désormais à l'intérieur de chaque groupe.
 */
function LienTriable({ id, children }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} tabIndex={-1} className='relative cursor-grab touch-manipulation select-none active:cursor-grabbing'>
            {children}
        </div>
    );
}

function GroupeMenu({ groupe, ferme, onBasculer, compteurs, pathname, capteurs }) {
    const { t } = useTranslation();
    const ids = groupe.liens.map((l) => l.id);
    const [ordre, setOrdre] = useOrdrePersonnalise(`his_ordre_sidebar_${groupe.id}`, ids);
    const liens = ordre.map((id) => groupe.liens.find((l) => l.id === id)).filter(Boolean);

    function finGlissement({ active, over }) {
        if (!over || active.id === over.id) return;
        setOrdre(arrayMove(ordre, ordre.indexOf(active.id), ordre.indexOf(over.id)));
    }

    return (
        <div className='flex flex-col gap-0.5'>
            <button
                type='button'
                onClick={onBasculer}
                aria-expanded={!ferme}
                className={`flex h-[26px] w-full items-center justify-between whitespace-nowrap rounded-lg pl-3 pr-2.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white/[0.55] transition-colors hover:text-white ${FOCUS_OR}`}
            >
                {t(groupe.labelKey)}
                <LuChevronDown size={14} className={`transition-transform ${ferme ? '-rotate-90' : ''}`} />
            </button>
            {!ferme && (
                <DndContext sensors={capteurs} collisionDetection={closestCenter} onDragEnd={finGlissement}>
                    <SortableContext items={ordre} strategy={verticalListSortingStrategy}>
                        <div className='flex flex-col gap-0.5'>
                            {liens.map((l) => (
                                <LienTriable key={l.id} id={l.id}>
                                    <ElementMenu
                                        to={l.to}
                                        icon={l.icon}
                                        libelle={t(l.labelKey)}
                                        compteur={l.compteur ? compteurs[l.compteur] : 0}
                                        actif={estLienActif(l.to, pathname)}
                                        title={t('sidebar.glisserPourReordonner')}
                                    />
                                </LienTriable>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}

/** Menu flottant d'un groupe en mode réduit (au survol ou au focus d'une icône). */
function MenuFlottant({ groupe, top, compteurs, pathname, onEntrer, onSortir }) {
    const { t } = useTranslation();
    return (
        <div
            role='menu'
            aria-label={t(groupe.labelKey)}
            onMouseEnter={onEntrer}
            onMouseLeave={onSortir}
            style={{ top, left: 84 }}
            className='fixed z-[60] flex w-[248px] flex-col gap-0.5 rounded-[14px] border border-border bg-card p-1.5 shadow-[0_16px_40px_-12px_rgba(10,15,22,0.35)]'
        >
            <span className='px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'>{t(groupe.labelKey)}</span>
            {groupe.liens.map((l) => {
                const actif = estLienActif(l.to, pathname);
                const n = l.compteur ? compteurs[l.compteur] : 0;
                return (
                    <Link
                        key={l.id}
                        to={l.to}
                        role='menuitem'
                        className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors ${actif ? 'bg-muted font-semibold text-foreground' : 'text-foreground/80 hover:bg-muted hover:text-foreground'}`}
                    >
                        <l.icon size={16} className='shrink-0' />
                        {t(l.labelKey)}
                        {n > 0 && <span className='ml-auto rounded-full bg-amber-100 px-[7px] py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'>{formaterCompteur(n)}</span>}
                    </Link>
                );
            })}
        </div>
    );
}

function MenuProfil({ estCompteDepot, onFermer }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { hasPermission, isSuperAdministrator } = usePermissions();
    // Mêmes onglets que Settings.jsx : chacun selon sa permission, plus les
    // deux réservés au Super Administrateur (avant, atteints par l'icône
    // « réglages » de la barre du haut, retirée par la refonte).
    const liensAdmin = estCompteDepot ? [] : [
        ...ADMIN_LINKS.filter(({ permission }) => hasPermission(permission)),
        ...(isSuperAdministrator ? [
            { tab: 'jetons', labelKey: 'settings.jetonsApi', icon: LuKeyRound },
            { tab: 'habillage', labelKey: 'habillage.onglet', icon: LuPalette },
        ] : []),
    ];
    const classeItem = 'flex h-9 w-full shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-foreground/80 transition-colors hover:bg-muted hover:text-foreground';

    return (
        <div role='menu' aria-label={t('sidebar.compte')} className='absolute bottom-[calc(100%+8px)] left-3 z-[60] flex max-h-[calc(100vh-100px)] w-[248px] flex-col gap-0.5 overflow-y-auto rounded-[14px] border border-border bg-card p-1.5 shadow-[0_16px_40px_-12px_rgba(10,15,22,0.35)]'>
            <Link to='/profile' role='menuitem' onClick={onFermer} className={classeItem}><LuUser size={16} /> {t('sidebar.monProfil')}</Link>
            {!estCompteDepot && (
                <Link to='/raccourcis' role='menuitem' onClick={onFermer} className={classeItem}><LuKeyboard size={16} /> {t('raccourcis.titre')}</Link>
            )}
            <div className='px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'>{t('commun.langue')}</div>
            {/* Une seule ligne : code court (FR, EN…), nom complet au survol.
                Pas de drapeaux — une langue n'est pas un pays, et Windows
                affiche les drapeaux emoji en simples lettres. */}
            <div className='flex gap-1 px-1.5 pb-1'>
                {LANGUES_DISPONIBLES.map((langue) => {
                    const actuelle = langue.code === i18n.resolvedLanguage;
                    return (
                        <button
                            key={langue.code}
                            type='button'
                            onClick={() => i18n.changeLanguage(langue.code)}
                            aria-pressed={actuelle}
                            title={langue.label}
                            aria-label={langue.label}
                            className={`flex-1 rounded-full border py-1 text-xs font-semibold tracking-wide transition-colors ${actuelle ? 'border-primary bg-primary text-white' : 'border-border text-foreground hover:bg-muted'}`}
                        >
                            {langue.code.toUpperCase()}
                        </button>
                    );
                })}
            </div>
            {liensAdmin.length > 0 && (
                <>
                    <div className='mx-1.5 my-1 h-px bg-border' />
                    <div className='px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'>{t('sidebar.administration')}</div>
                    {liensAdmin.map(({ tab, labelKey, icon: Icone }) => (
                        <Link key={tab} to={`/setting?tab=${tab}`} role='menuitem' onClick={onFermer} className={classeItem}><Icone size={16} /> {t(labelKey)}</Link>
                    ))}
                </>
            )}
            <div className='mx-1.5 my-1 h-px bg-border' />
            <button type='button' role='menuitem' onClick={() => { onFermer(); deconnecter(navigate); }} className={`${classeItem} text-red-700 hover:text-red-800 dark:text-red-400`}>
                <LuLogOut size={16} /> {t('sidebar.deconnexion')}
            </button>
        </div>
    );
}

/**
 * Barre latérale — maquette validée (en-tête 64 px aligné sur la barre du
 * haut, bouton « Nouveau document », 4 groupes repliables avec compteurs,
 * page active en or, administration et langue dans le menu du profil, mode
 * réduit en rail de 76 px). Voir constants/navigation.js pour les liens.
 */
function Sidebar({ replie = false, onBasculerReplie, compteurs = {} }) {
    const { t } = useTranslation();
    const location = useLocation();
    const droits = usePermissions();
    const { role } = droits;
    const estCompteDepot = ROLES_DEPOT.includes(role);
    const [user, setUser] = useState({});
    const [groupesFermes, setGroupesFermes] = useState(lireGroupesFermes);
    const [menuProfil, setMenuProfil] = useState(false);
    const [flottant, setFlottant] = useState(null); // { groupe, top }
    const minuterieFlottant = useRef(null);
    const profilRef = useRef(null);

    useEffect(() => {
        const charger = () => setUser(JSON.parse(sessionStorage.getItem('user') || '{}'));
        charger();
        window.addEventListener('user-updated', charger);
        return () => window.removeEventListener('user-updated', charger);
    }, []);

    useEffect(() => { setMenuProfil(false); setFlottant(null); }, [location.pathname]);

    useEffect(() => {
        if (!menuProfil) return undefined;
        const dehors = (e) => { if (profilRef.current && !profilRef.current.contains(e.target)) setMenuProfil(false); };
        const echap = (e) => { if (e.key === 'Escape') setMenuProfil(false); };
        document.addEventListener('mousedown', dehors);
        document.addEventListener('keydown', echap);
        return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap); };
    }, [menuProfil]);

    // Même réglage qu'avant : rester appuyé sans trop bouger, pour ne pas
    // confondre un glissement avec un clic ou un défilement au doigt.
    const capteurs = useSensors(
        useSensor(MouseSensor, { activationConstraint: { delay: 400, tolerance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 6 } }),
    );

    const nomAffiche = getDisplayName(user);
    const initiales = getInitials(nomAffiche);
    const groupes = estCompteDepot ? [] : groupesVisibles(droits);

    function basculerGroupe(id) {
        setGroupesFermes((avant) => {
            const suivant = { ...avant, [id]: !avant[id] };
            try { localStorage.setItem(CLE_GROUPES_FERMES, JSON.stringify(suivant)); } catch { /* stockage indisponible : le choix vaut pour la session */ }
            return suivant;
        });
    }

    function ouvrirFlottant(groupe, e) {
        clearTimeout(minuterieFlottant.current);
        const rect = e.currentTarget.getBoundingClientRect();
        setFlottant({ groupe, top: Math.min(rect.top, window.innerHeight - 60 - groupe.liens.length * 42) });
    }
    function fermerFlottantBientot() {
        clearTimeout(minuterieFlottant.current);
        minuterieFlottant.current = setTimeout(() => setFlottant(null), 150);
    }

    const avatar = (
        <span aria-hidden='true' className='flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2B4A75] text-[13px] font-semibold text-white'>
            {user?.profile ? <img src={SERVER_URL + user.profile} alt='' className='h-full w-full object-cover' /> : (initiales || '?')}
        </span>
    );

    const logo = (
        <div className='relative h-9 w-9 shrink-0 rounded-full bg-white'>
            <img src={hisLogo} alt={t('commun.entreprise')} className='h-full w-full rounded-full object-cover' />
            <LogoSaisonnier />
        </div>
    );

    // ------------------------------------------------------------ Mode réduit
    if (replie) {
        return (
            <aside aria-label={t('sidebar.navigationPrincipale')} className='flex h-screen w-full flex-col items-center bg-gradient-to-b from-[#1B365D] via-[#10243F] to-[#0A0F16] text-white'>
                <div className='flex h-16 w-full shrink-0 items-center justify-center border-b border-white/[0.08]'>{logo}</div>
                <div className='flex shrink-0 flex-col items-center gap-2 pb-1 pt-3'>
                    <button type='button' onClick={onBasculerReplie} aria-label={t('sidebar.developperMenu')} title={t('sidebar.developperMenu')} className={`flex h-10 w-10 items-center justify-center rounded-[10px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white ${FOCUS_OR}`}>
                        <LuPanelLeftOpen size={18} />
                    </button>
                </div>
                <nav aria-label={t('sidebar.menu')} className='flex flex-1 flex-col items-center gap-1 overflow-y-auto pb-4 pt-2'>
                    {groupes.map((g, gi) => (
                        <div key={g.id} className='flex flex-col items-center gap-1' onMouseEnter={(e) => ouvrirFlottant(g, e)} onMouseLeave={fermerFlottantBientot}>
                            {gi > 0 && <div aria-hidden='true' className='my-1.5 h-px w-7 bg-white/[0.14]' />}
                            {g.liens.map((l) => {
                                const actif = estLienActif(l.to, location.pathname);
                                const n = l.compteur ? compteurs[l.compteur] : 0;
                                return (
                                    <Link
                                        key={l.id}
                                        to={l.to}
                                        aria-label={n > 0 ? `${t(l.labelKey)} — ${t('sidebar.enAttente', { count: n })}` : t(l.labelKey)}
                                        aria-current={actif ? 'page' : undefined}
                                        onFocus={(e) => ouvrirFlottant(g, e)}
                                        className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${FOCUS_OR} ${actif ? 'bg-[#FACC14]/[0.14]' : 'text-white/[0.76] hover:bg-white/[0.08] hover:text-white'}`}
                                        style={actif ? { color: OR } : undefined}
                                    >
                                        <l.icon size={20} />
                                        {n > 0 && <span aria-hidden='true' className='absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FACC14] shadow-[0_0_0_2px_#14294A]' />}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>
                <div ref={profilRef} className='relative flex w-full shrink-0 justify-center border-t border-white/[0.08] py-3'>
                    <button type='button' onClick={() => setMenuProfil((v) => !v)} aria-haspopup='menu' aria-expanded={menuProfil} aria-label={t('sidebar.compteDe', { nom: nomAffiche })} className={`flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/[0.08] ${FOCUS_OR}`}>
                        {avatar}
                    </button>
                    {menuProfil && <MenuProfil estCompteDepot={estCompteDepot} onFermer={() => setMenuProfil(false)} />}
                </div>
                {flottant && (
                    <MenuFlottant
                        groupe={flottant.groupe}
                        top={flottant.top}
                        compteurs={compteurs}
                        pathname={location.pathname}
                        onEntrer={() => clearTimeout(minuterieFlottant.current)}
                        onSortir={fermerFlottantBientot}
                    />
                )}
            </aside>
        );
    }

    // ------------------------------------------------------------ Mode déplié
    return (
        <aside aria-label={t('sidebar.navigationPrincipale')} className='flex h-screen w-full flex-col bg-gradient-to-b from-[#1B365D] via-[#10243F] to-[#0A0F16] text-white'>
            <div className='flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.08] pl-4 pr-3'>
                {logo}
                <span className='min-w-0 flex-1 truncate font-serif text-[15px] font-semibold leading-5'>HIS Archivage</span>
                {onBasculerReplie && (
                    <button type='button' onClick={onBasculerReplie} aria-label={t('sidebar.reduireMenu')} title={t('sidebar.reduireMenu')} className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white md:flex ${FOCUS_OR}`}>
                        <LuPanelLeftClose size={18} />
                    </button>
                )}
            </div>


            <nav aria-label={t('sidebar.menu')} className='flex flex-1 flex-col gap-3.5 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-3'>
                {estCompteDepot ? (
                    <div className='flex flex-col gap-0.5'>
                        <ElementMenu to='/' icon={IoApps} libelle={t('sidebar.tableauDeBord')} actif={estLienActif('/', location.pathname)} />
                        {/* « Mes papiers » (voir MesBulletins.jsx / MesDocuments.jsx) —
                            bulletins réservés aux salariés, comme Fiche de paie. */}
                        {role === 'Intervenant' && (
                            <ElementMenu to='/mes-bulletins' icon={LuWallet} libelle={t('mesPapiers.bulletinsTitre')} actif={estLienActif('/mes-bulletins', location.pathname)} />
                        )}
                        <ElementMenu to='/mes-documents' icon={LuFolderOpen} libelle={t('mesPapiers.documentsTitre')} actif={estLienActif('/mes-documents', location.pathname)} />
                        {tuilesDuTableauDeBord(role).flatMap((tuile) => (tuile.groupe ? tuile.membres : [tuile])).map((l) => (
                            <ElementMenu key={l.id} to={l.to} icon={l.icon} libelle={t(l.label)} actif={estLienActif(l.to, location.pathname)} />
                        ))}
                        <ElementMenu to='/corbeille' icon={LuTrash2} libelle={t('sidebar.corbeille')} actif={estLienActif('/corbeille', location.pathname)} />
                        <ElementMenu to='/contact' icon={LuPhoneCall} libelle={t('sidebar.contact')} actif={estLienActif('/contact', location.pathname)} />
                    </div>
                ) : groupes.map((g) => (
                    <GroupeMenu
                        key={g.id}
                        groupe={g}
                        ferme={!!groupesFermes[g.id]}
                        onBasculer={() => basculerGroupe(g.id)}
                        compteurs={compteurs}
                        pathname={location.pathname}
                        capteurs={capteurs}
                    />
                ))}
            </nav>

            <div ref={profilRef} className='relative shrink-0 border-t border-white/[0.08] p-3'>
                <button type='button' onClick={() => setMenuProfil((v) => !v)} aria-haspopup='menu' aria-expanded={menuProfil} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left text-white transition-colors hover:bg-white/[0.07] ${FOCUS_OR}`}>
                    {avatar}
                    <span className='flex min-w-0 flex-1 flex-col'>
                        <span className='truncate text-[13px] font-semibold leading-5'>{nomAffiche || '—'}</span>
                        <span className='truncate text-xs leading-4 text-white/[0.62]'>{user?.role || t('sidebar.utilisateur')}</span>
                    </span>
                    <LuChevronsUpDown size={16} className='shrink-0 text-white/[0.62]' />
                </button>
                {menuProfil && <MenuProfil estCompteDepot={estCompteDepot} onFermer={() => setMenuProfil(false)} />}
            </div>
        </aside>
    );
}

export default Sidebar;
