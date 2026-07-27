export const getFormData = (e, callback) => {
    callback(prevData => ({
      ...prevData,
      [e.target.name]: e.target.value
    }));
  };

/**
 * Le nom affiché doit venir de la fiche Personnel (nom/prénom, modifiable dans le profil)
 * plutôt que du champ `nom` du compte de connexion (Utilisateurs), qui n'est qu'un
 * identifiant technique jamais mis à jour par l'utilisateur.
 */
export const getDisplayName = (user) => {
  const personnel = user?.personnel;
  if (personnel?.nom || personnel?.prenom) {
    return `${personnel.prenom || ''} ${personnel.nom || ''}`.trim();
  }
  return user?.nom || '';
};

export const getInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
};