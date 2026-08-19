import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { LuUsers2, LuMail, LuBuilding2 } from 'react-icons/lu';
import { shareDocument } from '../api/routes/document';
import { getPersonnels } from '../api/routes/personnel';
import { getServicesMetier } from '../api/routes/serviceMetier';

function ShareDocumentModal({ doc, isOpen, onClose }) {
    const [mode, setMode] = useState('interne');
    const [personnels, setPersonnels] = useState([]);
    const [services, setServices] = useState([]);
    const [destinataireId, setDestinataireId] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [email, setEmail] = useState('');
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
                const data = await res.json();
                setServices(data);
            }
        }).catch((err) => console.log(err));
    }, [currentUser?.id]);

    function resetAndClose() {
        setDestinataireId('');
        setServiceId('');
        setEmail('');
        setMessage('');
        onClose && onClose();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const payload = mode === 'interne'
            ? { destinataire_utilisateur_id: destinataireId, message: message || undefined }
            : mode === 'service'
                ? { service_metier_id: serviceId, message: message || undefined }
                : { email, message: message || undefined };

        try {
            setSending(true);
            const res = await shareDocument(doc.id, payload);
            setSending(false);
            if (res.status === 200) {
                const data = await res.json().catch(() => ({}));
                toast.success(data?.message || 'Document partagé avec succès');
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
                <h1 className='text-lg font-semibold mb-1'>Partager le document</h1>
                <p className='text-sm text-muted-foreground mb-4 truncate'>{doc?.titre_document}</p>

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
                    <button
                        type="button"
                        onClick={() => setMode('email')}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${mode === 'email' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <LuMail size={15} />
                        Un tiers sans compte (email)
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {mode === 'interne' ? (
                        <div className='mb-4'>
                            <label className='block text-sm font-medium mb-1.5'>Destinataire <span className='text-red-500'>*</span></label>
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
                            <p className='text-xs text-muted-foreground mt-1.5'>Inclut vos collègues ainsi que les intervenants et bénéficiaires inscrits (ex: un avocat suivi comme intervenant).</p>
                        </div>
                    ) : mode === 'service' ? (
                        <div className='mb-4'>
                            <label className='block text-sm font-medium mb-1.5'>Service métier <span className='text-red-500'>*</span></label>
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
                            <p className='text-xs text-muted-foreground mt-1.5'>Tous les membres de ce service recevront le document par notification et par email.</p>
                        </div>
                    ) : (
                        <div className='mb-4'>
                            <label className='block text-sm font-medium mb-1.5'>Adresse email <span className='text-red-500'>*</span></label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="famille.dupont@exemple.com"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                required
                            />
                            <p className='text-xs text-muted-foreground mt-1.5'>Pour quelqu'un qui n'a pas de compte. Aucun fichier en pièce jointe : un lien sécurisé sera envoyé, protégé par un code à usage unique. Pour un contact régulier (avocat, expert-comptable...), préférez plutôt "Une personne du système" en lui faisant créer un compte intervenant.</p>
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
                            {sending ? 'Envoi...' : 'Envoyer'}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}

export default ShareDocumentModal;
