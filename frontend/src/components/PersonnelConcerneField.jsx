import React, { useEffect, useState } from 'react';
import { getPersonnels } from '../api/routes/personnel';

const MODE_AUCUN = 'aucun';
const MODE_EXTERNE = 'externe';

/**
 * Sélection du salarié concerné par un document (ex: le titulaire d'un CV,
 * d'un contrat...) — distinct de celui qui téléverse le document (souvent un RH).
 * Couvre aussi le cas d'une personne sans compte dans le système (ex: un candidat).
 */
function PersonnelConcerneField({ personnelConcerneId, nomPersonneConcernee, onChange }) {
  const [personnels, setPersonnels] = useState([]);

  useEffect(() => {
    getPersonnels().then(async (res) => {
      if (res.status === 200) setPersonnels(await res.json());
    }).catch(() => {});
  }, []);

  const mode = personnelConcerneId ? String(personnelConcerneId) : (nomPersonneConcernee ? MODE_EXTERNE : MODE_AUCUN);

  function handleSelect(e) {
    const val = e.target.value;
    if (val === MODE_AUCUN) {
      onChange({ personnel_concerne_id: '', nom_personne_concernee: '' });
    } else if (val === MODE_EXTERNE) {
      onChange({ personnel_concerne_id: '', nom_personne_concernee: nomPersonneConcernee || '' });
    } else {
      onChange({ personnel_concerne_id: val, nom_personne_concernee: '' });
    }
  }

  return (
    <div>
      <label className='block text-sm font-medium mb-1.5'>Personnel concerné (optionnel)</label>
      <select
        value={mode}
        onChange={handleSelect}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value={MODE_AUCUN}>Aucun</option>
        {personnels.map((p) => (
          <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
        ))}
        <option value={MODE_EXTERNE}>Personne externe (pas dans le système)</option>
      </select>
      {mode === MODE_EXTERNE && (
        <input
          type="text"
          value={nomPersonneConcernee}
          onChange={(e) => onChange({ personnel_concerne_id: '', nom_personne_concernee: e.target.value })}
          placeholder="Nom de la personne concernée"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}
    </div>
  );
}

export default PersonnelConcerneField;
