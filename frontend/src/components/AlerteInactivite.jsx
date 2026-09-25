import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logoutAPI } from '../api/routes/auth';
import { playNotificationSound } from '../utils/notificationSound';

// Sécurité demandée : une session laissée ouverte sans surveillance (poste
// partagé, oubli en fin de journée) ne doit pas rester active indéfiniment —
// voir useAuthStatus.js, qui renouvelle le jeton toutes les 30 min tant que
// l'onglet reste ouvert, activité ou non. Ici on mesure la vraie inactivité
// (aucune souris/clavier/défilement) : avertissement 2 min avant, puis
// déconnexion à 2h pile si personne n'a répondu.
const DELAI_INACTIVITE_MS = 2 * 60 * 60 * 1000;
const DELAI_AVERTISSEMENT_MS = 2 * 60 * 1000;
const INTERVALLE_VERIFICATION_MS = 1000;
const EVENEMENTS_ACTIVITE = ['mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'];

// Compte fondateur, déjà protégé ailleurs dans l'app (voir
// UTILISATEUR_ID_ADMIN_PROTEGE dans PersonnelController.php côté backend) —
// exempté explicitement de la déconnexion automatique.
const MAIL_COMPTE_EXEMPTE = 'admin@sige.com';
const ID_COMPTE_EXEMPTE = 1;

const RAYON_ANNEAU = 32;
const CIRCONFERENCE_ANNEAU = 2 * Math.PI * RAYON_ANNEAU;

function estCompteExempte(user) {
  return user?.id === ID_COMPTE_EXEMPTE || user?.mail === MAIL_COMPTE_EXEMPTE;
}

function formatMinutesSecondes(secondes) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AlerteInactivite() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const derniereActivite = useRef(Date.now());
  const [secondesRestantes, setSecondesRestantes] = useState(null);
  // Son/notification système déjà déclenchés pour ce cycle (une seule fois,
  // pas à chaque tick du décompte) et notification système en cours, à
  // fermer si on quitte l'avertissement avant qu'elle ne disparaisse seule.
  const dejaSignale = useRef(false);
  const notificationSysteme = useRef(null);

  function seDeconnecter() {
    notificationSysteme.current?.close();
    logoutAPI().catch(() => {}).finally(() => {
      sessionStorage.clear();
      navigate('/login');
    });
  }

  function resterConnecte() {
    derniereActivite.current = Date.now();
    setSecondesRestantes(null);
  }

  useEffect(() => {
    function enregistrerActivite() {
      derniereActivite.current = Date.now();
      // Toute activité pendant que l'avertissement est affiché vaut "je suis
      // toujours là" — pas besoin de cliquer précisément sur le bouton.
      setSecondesRestantes((actuel) => (actuel !== null ? null : actuel));
    }
    EVENEMENTS_ACTIVITE.forEach((evt) => window.addEventListener(evt, enregistrerActivite, { passive: true }));

    const intervalle = setInterval(() => {
      if (!sessionStorage.getItem('token')) return;
      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
      if (estCompteExempte(user)) return;

      const restant = DELAI_INACTIVITE_MS - (Date.now() - derniereActivite.current);
      if (restant <= 0) {
        seDeconnecter();
      } else if (restant <= DELAI_AVERTISSEMENT_MS) {
        setSecondesRestantes(Math.ceil(restant / 1000));
      }
    }, INTERVALLE_VERIFICATION_MS);

    return () => {
      EVENEMENTS_ACTIVITE.forEach((evt) => window.removeEventListener(evt, enregistrerActivite));
      clearInterval(intervalle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Alerte utile même si la personne est sur un autre onglet ou une autre
  // application au moment où l'avertissement démarre : le son (déjà mis au
  // volume maximum, voir notificationSound.js) s'entend même onglet en
  // arrière-plan, et une notification système apparaît si la permission a
  // déjà été accordée (voir pushNotifications.js).
  useEffect(() => {
    if (secondesRestantes === null) {
      dejaSignale.current = false;
      notificationSysteme.current?.close();
      notificationSysteme.current = null;
      return;
    }
    if (dejaSignale.current) return; // déjà signalé pour ce cycle
    dejaSignale.current = true;

    playNotificationSound();

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const notif = new Notification(t('inactivite.titre'), {
          body: t('inactivite.message'),
          icon: `${process.env.PUBLIC_URL || ''}/logo192.png`,
          tag: 'his-inactivite',
        });
        notif.onclick = () => { window.focus(); notif.close(); };
        notificationSysteme.current = notif;
      } catch {
        // Certains navigateurs refusent new Notification() hors contexte
        // sécurisé/service worker — le son et le titre d'onglet suffisent.
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondesRestantes]);

  // Titre d'onglet clignotant tant que l'avertissement est affiché — plus
  // accrocheur du coin de l'œil qu'un préfixe fixe, sans permission à
  // demander. Ne redémarre pas à chaque tick du décompte (clé booléenne),
  // et se restaure tout seul (nettoyage de l'effet) dès que l'avertissement
  // disparaît, y compris au moment de la déconnexion.
  useEffect(() => {
    if (secondesRestantes === null) return;
    const titreNormal = document.title;
    const titreAlerte = `⏳ ${t('inactivite.titre')}`;
    let visible = true;
    document.title = titreAlerte;
    const intervalle = setInterval(() => {
      visible = !visible;
      document.title = visible ? titreAlerte : titreNormal;
    }, 1000);
    return () => {
      clearInterval(intervalle);
      document.title = titreNormal;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondesRestantes !== null]);

  if (secondesRestantes === null) return null;

  const progres = secondesRestantes / (DELAI_AVERTISSEMENT_MS / 1000);

  return (
    <div className='fixed inset-0 z-[200] flex items-center justify-center'>
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={resterConnecte} />
      <div className='relative w-[min(380px,90vw)] rounded-2xl bg-card p-6 text-center shadow-2xl animate-wizard-rise-in'>
        <div className='relative mx-auto mb-3 h-[76px] w-[76px]'>
          <svg width='76' height='76' className='-rotate-90'>
            <circle cx='38' cy='38' r={RAYON_ANNEAU} fill='none' stroke='currentColor' strokeWidth='6' className='text-border' />
            <circle
              cx='38' cy='38' r={RAYON_ANNEAU} fill='none' stroke='currentColor' strokeWidth='6' strokeLinecap='round'
              className='text-accent'
              strokeDasharray={CIRCONFERENCE_ANNEAU}
              strokeDashoffset={CIRCONFERENCE_ANNEAU * (1 - progres)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className='absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums'>
            {formatMinutesSecondes(secondesRestantes)}
          </div>
        </div>
        <h3 className='mb-1.5 text-base font-semibold'>{t('inactivite.titre')}</h3>
        <p className='mb-5 text-sm text-muted-foreground'>{t('inactivite.message')}</p>
        <div className='flex justify-center gap-2.5'>
          <button
            onClick={seDeconnecter}
            className='rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors'
          >
            {t('inactivite.seDeconnecter')}
          </button>
          <button
            onClick={resterConnecte}
            className='rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-2.5 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all active:scale-95'
          >
            {t('inactivite.resterConnecte')}
          </button>
        </div>
      </div>
    </div>
  );
}
