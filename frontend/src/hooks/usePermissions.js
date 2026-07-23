/**
 * Lit les permissions de l'utilisateur connecté (stockées dans sessionStorage par useAuthStatus)
 * et fournit un contrôle d'accès simple, à la place des comparaisons de rôle codées en dur.
 */
export function usePermissions() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const permissions = user?.permissions || [];

  const hasPermission = (code) => permissions.includes(code);
  const isAdministrator = user?.role === 'Administrator';

  return { permissions, hasPermission, isAdministrator, role: user?.role };
}
