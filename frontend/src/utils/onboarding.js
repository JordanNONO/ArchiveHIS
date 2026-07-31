/**
 * Tour de bienvenue vu ou non, par compte — stocké dans localStorage (pas
 * sessionStorage) pour survivre à la fermeture de l'onglet : on veut le
 * montrer une seule fois "pour de vrai", à la toute première connexion sur
 * cet appareil, qu'il s'agisse d'un compte auto-inscrit (intervenant/
 * bénéficiaire) ou d'un compte personnel créé par un administrateur.
 */
function cleOnboarding(userId) {
  return `onboarding_vu_${userId}`;
}

export function onboardingDejaVu(userId) {
  if (!userId) return true;
  return localStorage.getItem(cleOnboarding(userId)) === '1';
}

export function marquerOnboardingVu(userId) {
  if (!userId) return;
  localStorage.setItem(cleOnboarding(userId), '1');
}
