import React, { useEffect, useState } from 'react';
import { LuUsers2, LuUserCheck, LuUserX, LuSearch } from 'react-icons/lu';
import { getPersonnels } from '../api/routes/personnel';

/**
 * Qui prévenir d'un archivage manuel : tout le personnel interne, une poignée
 * de personnes précises, ou personne du tout — voir
 * DocumentController::store()/DocumentStatusService::notifierValidateurs().
 *
 * Le mode est transmis explicitement (pas juste déduit d'un tableau vide) :
 * un tableau vide veut dire deux choses différentes selon le mode ("tous" —
 * la liste sera calculée côté serveur — vs "aucune" — vraiment personne), et
 * FormData ne peut pas transporter un tableau vide pour faire la différence
 * avec un champ absent une fois envoyé au serveur.
 */
function DestinatairesNotificationField({ mode, selectionIds, onChange }) {
  const [personnels, setPersonnels] = useState([]);
  const [recherche, setRecherche] = useState('');
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');

  useEffect(() => {
    getPersonnels().then(async (res) => {
      if (res.status === 200) {
        const data = await res.json();
        setPersonnels(data.filter((p) => p?.user?.id !== currentUser?.id));
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choisirMode(nouveauMode) {
    onChange({ destinataires_mode: nouveauMode, destinataires_ids: nouveauMode === 'specifiques' ? selectionIds : [] });
  }

  function toggle(userId) {
    const ids = selectionIds.includes(userId) ? selectionIds.filter((id) => id !== userId) : [...selectionIds, userId];
    onChange({ destinataires_mode: 'specifiques', destinataires_ids: ids });
  }

  const filtres = personnels.filter((p) => `${p.prenom} ${p.nom}`.toLowerCase().includes(recherche.toLowerCase()));

  return (
    <div>
      <label className='block text-sm font-medium mb-1.5'>Prévenir</label>
      <div className='grid grid-cols-3 gap-2 mb-2'>
        <button
          type='button'
          onClick={() => choisirMode('tous')}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors ${mode === 'tous' ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:border-primary/40'}`}
        >
          <LuUsers2 size={14} />
          Tout le monde
        </button>
        <button
          type='button'
          onClick={() => choisirMode('specifiques')}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors ${mode === 'specifiques' ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:border-primary/40'}`}
        >
          <LuUserCheck size={14} />
          Personnes précises
        </button>
        <button
          type='button'
          onClick={() => choisirMode('aucune')}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors ${mode === 'aucune' ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:border-primary/40'}`}
        >
          <LuUserX size={14} />
          Personne
        </button>
      </div>

      {mode === 'specifiques' && (
        <div className='rounded-lg border border-border overflow-hidden'>
          <div className='flex items-center gap-2 px-2.5 py-1.5 border-b border-border bg-muted/30'>
            <LuSearch size={13} className='text-muted-foreground shrink-0' />
            <input
              type='text'
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder='Rechercher un nom...'
              className='w-full bg-transparent text-sm focus:outline-none'
            />
          </div>
          <div className='max-h-40 overflow-y-auto'>
            {filtres.length === 0 && (
              <p className='text-xs text-muted-foreground text-center py-3'>Aucun résultat</p>
            )}
            {filtres.map((p) => {
              const coche = selectionIds.includes(p.user?.id);
              return (
                <label key={p.id} className='flex items-center gap-2.5 px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors'>
                  <input
                    type='checkbox'
                    checked={coche}
                    onChange={() => p.user?.id && toggle(p.user.id)}
                    className='shrink-0'
                  />
                  <span className='truncate'>{p.prenom} {p.nom}</span>
                </label>
              );
            })}
          </div>
          {selectionIds.length > 0 && (
            <p className='text-[11px] text-muted-foreground px-2.5 py-1.5 border-t border-border bg-muted/20'>
              {selectionIds.length} personne{selectionIds.length > 1 ? 's' : ''} sélectionnée{selectionIds.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default DestinatairesNotificationField;
