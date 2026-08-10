import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { LuUsers2, LuBuilding2 } from 'react-icons/lu';
import { shareCategorie } from '../api/routes/categorie';
import { getPersonnels } from '../api/routes/personnel';
import { getServicesMetier } from '../api/routes/serviceMetier';

/**
 * Partage d'un dossier entier — volontairement plus simple que
 * ShareDocumentModal (document par document) : reste interne, pas d'email
 * externe, puisqu'envoyer tout un dossier en pièce jointe à un tiers n'aurait
 * pas de sens (voir CategorieController::share côté backend).
 */
function ShareFolderModal({ folder, isOpen, onClose }) {
  const [mode, setMode] = useState('interne');
  const [personnels, setPersonnels] = useState([]);
  const [services, setServices] = useState([]);
  const [destinataireId, setDestinataireId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const dialogRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  useEffect(() => {
    getPersonnels().then(async (res) => {
      if (res.status === 200) {
        const data = await res.json();
        setPersonnels(data.filter((p) => p?.user?.id !== currentUser?.id));
      }
    }).catch((err) => console.log(err));
    getServicesMetier().then(async (res) => {
      if (res.status === 200) {
        setServices(await res.json());
      }
    }).catch((err) => console.log(err));
  }, [currentUser?.id]);

  function resetAndClose() {
    setDestinataireId('');
    setServiceId('');
    setMessage('');
    onClose && onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = mode === 'interne'
      ? { destinataire_utilisateur_id: destinataireId, message: message || undefined }
      : { service_metier_id: serviceId, message: message || undefined };

    try {
      setSending(true);
      const res = await shareCategorie(folder.id, payload);
      setSending(false);
      if (res.status === 200) {
        const data = await res.json().catch(() => ({}));
        toast.success(data?.message || 'Dossier partagé avec succès');
        resetAndClose();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Une erreur s'est produite");
      }
    } catch (error) {
      setSending(false);
      console.log(error);
      toast.error("Une erreur s'est produite");
    }
  }

  return (
    <dialog ref={dialogRef} className="modal" onClose={() => onClose && onClose()}>
      <div className="modal-box rounded-2xl">
        <form method="dialog">
          <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h1 className='text-lg font-semibold mb-1'>Partager le dossier</h1>
        <p className='text-sm text-muted-foreground mb-4 truncate'>{folder?.libelle_cat}</p>

        <div className='inline-flex items-center gap-1 rounded-lg bg-muted p-1 mb-4 flex-wrap'>
          <button
            type="button"
            onClick={() => setMode('interne')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${mode === 'interne' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LuUsers2 size={15} />
            Une personne du système
          </button>
          <button
            type="button"
            onClick={() => setMode('service')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${mode === 'service' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LuBuilding2 size={15} />
            Un service métier
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'interne' ? (
            <div className='mb-4'>
              <label className='block text-sm font-medium mb-1.5'>Destinataire</label>
              <select
                value={destinataireId}
                onChange={(e) => setDestinataireId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              >
                <option value="">Sélectionner une personne</option>
                {personnels.map((p) => (
                  <option key={p.id} value={p.user?.id}>{p.prenom} {p.nom}</option>
                ))}
              </select>
              <p className='text-xs text-muted-foreground mt-1.5'>Donne accès à tous les documents actuellement dans ce dossier, pas seulement ceux d'aujourd'hui.</p>
            </div>
          ) : (
            <div className='mb-4'>
              <label className='block text-sm font-medium mb-1.5'>Service métier</label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              >
                <option value="">Sélectionner un service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.nom_service}</option>
                ))}
              </select>
              <p className='text-xs text-muted-foreground mt-1.5'>Tous les membres de ce service recevront une notification et pourront consulter le dossier.</p>
            </div>
          )}

          <div className='mb-1'>
            <label className='block text-sm font-medium mb-1.5'>Message (optionnel)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Ajouter un message..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className='modal-action'>
            <button
              type="submit"
              disabled={sending}
              className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'
            >
              {sending ? 'Envoi...' : 'Partager'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

export default ShareFolderModal;
