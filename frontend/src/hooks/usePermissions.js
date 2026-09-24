/**
 * Lit les permissions de l'utilisateur connecté (stockées dans sessionStorage par useAuthStatus)
 * et fournit un contrôle d'accès simple, à la place des comparaisons de rôle codées en dur.
 */
export function usePermissions() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const permissions = user?.permissions || [];

  const hasPermission = (code) => permissions.includes(code);
  // Le Super Administrateur hérite de tout ce que voit/fait un Administrator
  // (voir Utilisateurs::estAdministrateur() côté backend, même convention).
  const isAdministrator = user?.role === 'Administrator' || user?.role === 'Super Administrateur';
  // Distinct d'isAdministrator : seul ce rôle garde gerer_roles/
  // gerer_utilisateurs/gerer_services_metier (voir RoleSeeder.php) — réservé
  // aux quelques comptes qui doivent pouvoir gérer les autres utilisateurs et
  // rôles, un Administrateur "normal" ne les a plus.
  const isSuperAdministrator = user?.role === 'Super Administrateur';

  return { permissions, hasPermission, isAdministrator, isSuperAdministrator, role: user?.role };
}
