import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LuMenu, LuHelpCircle } from 'react-icons/lu';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';
import RechercheGlobale from './RechercheGlobale';
import CentreActivite from './CentreActivite';
import { usePermissions } from '../hooks/usePermissions';
import { pageCourante } from '../constants/navigation';

const ROLES_DEPOT = ['Intervenant', 'Beneficiaire'];

/**
 * Barre du haut — direction A validée (« centre d'activité ») : titre de la
 * page et fil d'Ariane à gauche, grande recherche au centre, puis ce qui
 * demande une action (« N à traiter ») et un seul bouton « Activité »
 * (notifications, messages, tâches). Le profil, la langue et
 * l'administration sont dans le menu du profil, en bas de la barre latérale
 * — plus d'avatar en double ici.
 *
 * `estCompteDepot` lu via usePermissions (sessionStorage, synchrone) et non
 * via un état local : au premier rendu après un remontage, un état local
 * vaudrait encore {} et monterait des éléments réservés au personnel interne
 * (voir l'historique de ce fichier : MessagerieIcone sans son contexte).
 */
function Navbar({ toggleSidebar, compteurs = {} }) {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { role } = usePermissions();
    const estCompteDepot = ROLES_DEPOT.includes(role);
    const { labelKey, groupeLabelKey } = pageCourante(location.pathname);
    const titre = labelKey ? t(labelKey) : t('commun.titreNavbar');
    const aTraiter = compteurs.documents || 0;

    return (
        <header className='flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:gap-5 sm:px-6'>
            <button type='button' onClick={toggleSidebar} aria-label={t('navbar.ouvrirMenu')} className='flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted md:hidden'>
                <LuMenu size={19} />
            </button>

            <div className='flex min-w-0 flex-col gap-0.5'>
                <nav aria-label={t('navbar.filAriane')} className='hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex'>
                    <Link to='/' className='hover:text-foreground'>HIS Archivage</Link>
                    {groupeLabelKey && (
                        <>
                            <span aria-hidden='true'>/</span>
                            <span className='truncate'>{t(groupeLabelKey)}</span>
                        </>
                    )}
                </nav>
                <h1 className='truncate text-base font-semibold leading-[22px] text-foreground'>{titre}</h1>
            </div>

            <div className='flex min-w-0 flex-1 justify-center'>
                {!estCompteDepot && <RechercheGlobale large />}
            </div>

            <div className='flex shrink-0 items-center gap-1.5 sm:gap-2'>
                {!estCompteDepot && aTraiter > 0 && (
                    <>
                        <button
                            type='button'
                            onClick={() => navigate('/?aTraiter=1')}
                            className='hidden h-9 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 text-[13px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 lg:inline-flex'
                        >
                            <span aria-hidden='true' className='h-2 w-2 rounded-full bg-amber-500' />
                            {t('navbar.aTraiter', { count: aTraiter })}
                        </button>
                        <span aria-hidden='true' className='mx-1 hidden h-6 w-px bg-border lg:block' />
                    </>
                )}

                {estCompteDepot ? (
                    <>
                        <LanguageSwitcher compact />
                        <NotificationBell />
                    </>
                ) : (
                    <>
                        <Link to='/formation' aria-label={t('navbar.aide')} title={t('navbar.aide')} className='flex h-10 w-10 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'>
                            <LuHelpCircle size={18} />
                        </Link>
                        <CentreActivite compteurs={compteurs} />
                    </>
                )}
            </div>
        </header>
    );
}

export default Navbar;
