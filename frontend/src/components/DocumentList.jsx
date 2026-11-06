import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuShare2, LuFileEdit, LuTrash2, LuFolderInput, LuPin } from 'react-icons/lu';
import DocumentContextMenu from './DocumentContextMenu';
import ShareDocumentModal from './ShareDocumentModal';
import DeplacerDocumentModal from './DeplacerDocumentModal';
import StatutBadge from './StatutBadge';
import BulkActionBar from './BulkActionBar';
import CompteARebours from './CompteARebours';
import BarreAideRaccourcis from './BarreAideRaccourcis';
import { usePermissions } from '../hooks/usePermissions';
import { updateDocument, deleteDocument, getDocumentLienFichier } from '../api/routes/document';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import { useRaccourci, useRaccourcis } from '../contexts/RaccourcisContext';
import { signatureEffective, PAR_ID } from '../utils/raccourcis';
import { alerteDelaiLabel, bordureDocumentClass } from '../utils/common';
import { useTranslation } from 'react-i18next';
import { NIVEAU_CONFIDENTIALITE_KEYS, teinteConfidentialite } from '../utils/confidentialite';

/**
 * Nom de la personne concernée par le document (ex: le titulaire d'un CV),
 * via la fiche Personnel liée si elle existe, sinon le nom libre saisi.
 */
function nomConcerne(doc) {
  if (doc.personnel_concerne) {
    return `${doc.personnel_concerne.prenom || ''} ${doc.personnel_concerne.nom || ''}`.trim();
  }
  return doc.nom_personne_concernee || null;
}

const DocumentList = ({ documents, getFileIcon, onChanged, onApercu }) => {
  const { t } = useTranslation();
  const navigate = useNavigate()
  const confirm = useConfirm();
  const { isAdministrator, hasPermission } = usePermissions();
  const canManageDocument = isAdministrator || hasPermission('archiver_documents');
  const [shareDoc, setShareDoc] = useState(null);
  const [moveDoc, setMoveDoc] = useState(null);
  const [renameDoc, setRenameDoc] = useState(null);
  const [renameForm, setRenameForm] = useState({ titre: '', auteur: '', reference: '', resume: '' });
  const [saving, setSaving] = useState(false);
  const renameDialogRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Ligne « en cours » au clavier. -1 = personne : tant que rien n'est
  // sélectionné, Entrée, Espace et T gardent leur sens habituel (valider un
  // formulaire, faire défiler la page, écrire la lettre) — on n'engage la
  // liste qu'à la première flèche.
  const [indexActif, setIndexActif] = useState(-1);
  const lignesRef = useRef([]);
  const [annonce, setAnnonce] = useState('');
  const { prefs } = useRaccourcis();
  const docActif = indexActif >= 0 ? documents[indexActif] : null;

  /** La touche réellement en vigueur pour ce raccourci (surcharge personnelle comprise). */
  const toucheDe = (id) => signatureEffective(PAR_ID[id], prefs.surcharges);

  function extensionDe(doc) {
    return String(doc?.chemin_stockage_serveur || '').split('.').pop();
  }

  function ouvrirDoc(doc) {
    if (doc) navigate(`/view/${doc.id}/${extensionDe(doc)}`);
  }

  async function telechargerDoc(doc) {
    if (!doc) return;
    try {
      const res = await getDocumentLienFichier(doc.id);
      if (res.status !== 200) {
        toast.error('Le téléchargement a échoué');
        return;
      }
      const data = await res.json();
      window.location.href = data.telechargement;
    } catch (error) {
      console.log(error);
      toast.error('Une erreur est survenue');
    }
  }

  // Une page de liste change (pagination, recherche, archivage) : l'ancien
  // index ne désigne plus le même document, on repart à zéro plutôt que de
  // laisser le curseur sur une ligne qui a changé sous les doigts.
  useEffect(() => {
    setIndexActif(-1);
  }, [documents]);

  function deplacer(pas) {
    if (documents.length === 0) return;
    // La première flèche prend la première ligne plutôt que de bouger d'un
    // cran depuis nulle part.
    const suite = indexActif < 0 ? 0 : Math.min(documents.length - 1, Math.max(0, indexActif + pas));
    setIndexActif(suite);
    const doc = documents[suite];
    // Lecture à voix haute si la personne l'a demandé (voir /raccourcis) :
    // une région aria-live suffit, c'est le lecteur d'écran qui parle.
    if (prefs.annonce && doc) {
      setAnnonce(`${suite + 1} / ${documents.length} — ${doc.titre_document || ''}`);
    }
    lignesRef.current[suite]?.scrollIntoView({ block: 'nearest' });
  }

  useRaccourci('listeBas', () => deplacer(1), documents.length > 0);
  useRaccourci('listeHaut', () => deplacer(-1), documents.length > 0);
  useRaccourci('listeTout', () => toggleSelectAll(), documents.length > 0);
  useRaccourci('listeOuvrir', () => ouvrirDoc(docActif), !!docActif);
  useRaccourci('listeCocher', () => docActif && toggleSelect(docActif.id), !!docActif);
  useRaccourci('docTelecharger', () => telechargerDoc(docActif), !!docActif);
  useRaccourci('docCorbeille', () => docActif && removeDoc(docActif), !!docActif && canManageDocument);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === documents.length ? new Set() : new Set(documents.map((d) => d.id))));
  }

  useEffect(() => {
    if (renameDoc) {
      renameDialogRef.current?.showModal();
    } else {
      renameDialogRef.current?.close();
    }
  }, [renameDoc]);

  function openRename(doc) {
    setRenameDoc(doc);
    setRenameForm({
      titre: doc.titre_document || '',
      auteur: doc.auteur || '',
      reference: doc.code_reference || '',
      resume: doc.resume || '',
    });
  }

  async function saveRename(e) {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await updateDocument(renameDoc.id, {
        category_id: renameDoc.categorie_id,
        type_document_id: renameDoc.type_document_id,
        titre: renameForm.titre,
        auteur: renameForm.auteur,
        reference: renameForm.reference,
        resume: renameForm.resume,
      });
      setSaving(false);
      if (res.status === 200) {
        toast.success('Document mis à jour avec succès');
        setRenameDoc(null);
        onChanged && onChanged();
      } else {
        toast.error("Une erreur s'est produite");
      }
    } catch (error) {
      setSaving(false);
      console.log(error);
      toast.error("Une erreur s'est produite");
    }
  }

  async function removeDoc(doc) {
    if (!await confirm({ message: 'Le document sera envoyé à la corbeille. Continuer ?', danger: true, confirmLabel: 'Envoyer à la corbeille' })) return;
    deleteDocument(doc.id).then((res) => {
      if (res.status === 200) {
        toast.success('Document supprimé avec succès');
        onChanged && onChanged();
      } else {
        toast.error("Une erreur s'est produite");
      }
    }).catch((err) => {
      console.log(err);
      toast.error("Une erreur s'est produite");
    });
  }

  return (
    <div>
      <BulkActionBar documents={documents} selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} onChanged={onChanged} />
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr className='border-b border-border'>
              <th>
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={documents.length > 0 && selectedIds.size === documents.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th></th>
              <th>Date de création du fichier</th>
              <th>Date d'archivage</th>
              <th>Nom du fichier</th>
              <th>{t('openFolder.objet')}</th>
              <th>Concerné</th>
              <th>Statut</th>
              <th>Taille du fichier</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, k) => (
              <tr
                key={k}
                ref={(el) => { lignesRef.current[k] = el; }}
                onMouseDown={() => setIndexActif(k)}
                className={`transition-colors ${k === indexActif ? 'bg-primary/10 shadow-[inset_3px_0_0_0_hsl(var(--primary))]' : 'hover:bg-muted/60'}`}
              >
                <th>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedIds.has(doc.id)}
                    onChange={() => toggleSelect(doc.id)}
                  />
                </th>
                <th className='cursor-pointer' onClick={()=>navigate(`/view/${doc.id}/${String(doc.chemin_stockage_serveur).split(".").pop()}`)}>
                  <DocumentContextMenu doc={doc} onRename={() => openRename(doc)} onDelete={() => removeDoc(doc)} onApercu={onApercu} onMove={() => setMoveDoc(doc)} onChanged={onChanged}>
                    <div
                      className={`text-xl rounded-lg pl-2 ${bordureDocumentClass(doc)}`}
                      title={alerteDelaiLabel(doc.suivi_delai_actif)}
                    >
                      {getFileIcon(doc.chemin_stockage_serveur)}
                    </div>
                  </DocumentContextMenu>
                </th>
                <td className='cursor-pointer' onClick={()=>navigate(`/view/${doc.id}/${String(doc.chemin_stockage_serveur).split(".").pop()}`)}>{doc?.file_create_date}</td>
                <td className='cursor-pointer' onClick={()=>navigate(`/view/${doc.id}/${String(doc.chemin_stockage_serveur).split(".").pop()}`)}>
                  {new Date(doc?.created_at).getDate().toString().padStart(2, '0')}/{(new Date(doc?.created_at).getMonth() + 1).toString().padStart(2, '0')}/{new Date(doc?.created_at).getFullYear()} - {new Date(doc?.created_at).getUTCHours()}:{new Date(doc?.created_at).getMinutes()}
                </td>
                <td className='cursor-pointer' onClick={()=>navigate(`/view/${doc.id}/${String(doc.chemin_stockage_serveur).split(".").pop()}`)}>
                  <DocumentContextMenu doc={doc} onRename={() => openRename(doc)} onDelete={() => removeDoc(doc)} onApercu={onApercu} onMove={() => setMoveDoc(doc)} onChanged={onChanged}>
                    <span className='inline-flex items-center gap-1.5'>
                      {doc.is_favorite && <LuPin size={12} className='text-accent shrink-0' />}
                      {`${doc.titre_document}.${String(doc.chemin_stockage_serveur).split('.').pop()}`}
                      {teinteConfidentialite(doc.niveau_confidentialite) && (
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${teinteConfidentialite(doc.niveau_confidentialite)}`}>
                          {t(NIVEAU_CONFIDENTIALITE_KEYS[doc.niveau_confidentialite])}
                        </span>
                      )}
                    </span>
                  </DocumentContextMenu>
                </td>
                <td className='cursor-pointer text-muted-foreground truncate max-w-[160px]' onClick={()=>navigate(`/view/${doc.id}/${String(doc.chemin_stockage_serveur).split(".").pop()}`)} title={doc.objet || ''}>{doc.objet || '—'}</td>
                <td className='cursor-pointer text-muted-foreground' onClick={()=>navigate(`/view/${doc.id}/${String(doc.chemin_stockage_serveur).split(".").pop()}`)}>{nomConcerne(doc) || '—'}</td>
                <td className='cursor-pointer' onClick={()=>navigate(`/view/${doc.id}/${String(doc.chemin_stockage_serveur).split(".").pop()}`)}>
                  <StatutBadge statut={doc.status_doc} />
                  {doc.status_doc === 'INCOMPLET_REJETE' && <CompteARebours document={doc} className='!text-left mt-0.5' />}
                </td>
                <td className='cursor-pointer' onClick={()=>navigate(`/view/${doc.id}/${String(doc.chemin_stockage_serveur).split(".").pop()}`)}>{doc?.taille > 1024 * 1024 ? `${(doc.taille / (1024 * 1024)).toFixed(2)} Mo` : `${(doc.taille / 1024).toFixed(2)} Ko`}</td>
                <td>
                  <div className='flex items-center gap-1'>
                    <button title="Partager le document" onClick={() => setShareDoc(doc)} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
                      <LuShare2 size={15} />
                    </button>
                    <button title="Modifier le document" disabled={!canManageDocument} onClick={() => openRename(doc)} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                      <LuFileEdit size={15} />
                    </button>
                    <button title="Déplacer le document" disabled={!canManageDocument} onClick={() => setMoveDoc(doc)} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                      <LuFolderInput size={15} />
                    </button>
                    <button title="Supprimer le document" disabled={!canManageDocument} onClick={() => removeDoc(doc)} className='flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                      <LuTrash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rappel des touches utiles, sous la liste : c'est là qu'on les
          découvre en travaillant, sans ouvrir de panneau. Masquable depuis
          /raccourcis. */}
      {documents.length > 0 && (
        <div className='px-3 pb-3'>
          <BarreAideRaccourcis
            elements={[
              { signatures: [toucheDe('listeHaut'), toucheDe('listeBas')], texte: t('raccourcis.court_deplacer') },
              { signatures: [toucheDe('listeOuvrir')], texte: t('raccourcis.court_ouvrir') },
              { signatures: [toucheDe('listeCocher')], texte: t('raccourcis.court_cocher') },
              { signatures: [toucheDe('docTelecharger')], texte: t('raccourcis.court_telecharger') },
            ]}
          />
        </div>
      )}
      <p aria-live='polite' className='sr-only'>{annonce}</p>

      <ShareDocumentModal doc={shareDoc} isOpen={!!shareDoc} onClose={() => setShareDoc(null)} />
      <DeplacerDocumentModal doc={moveDoc} isOpen={!!moveDoc} onClose={() => setMoveDoc(null)} onMoved={onChanged} />

      <dialog ref={renameDialogRef} className="modal" onClose={() => setRenameDoc(null)}>
        <div className="modal-box rounded-2xl">
          <form method="dialog">
            <button onClick={() => setRenameDoc(null)} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h1 className='text-lg font-semibold mb-4'>Modifier le document</h1>
          {renameDoc && (
            <form onSubmit={saveRename} className='flex flex-col gap-3'>
              <div>
                <label className='block text-sm font-medium mb-1.5'>Titre <span className='text-red-500'>*</span></label>
                <input type="text" value={renameForm.titre} onChange={(e) => setRenameForm({ ...renameForm, titre: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1.5'>Auteur <span className='text-red-500'>*</span></label>
                <input type="text" value={renameForm.auteur} onChange={(e) => setRenameForm({ ...renameForm, auteur: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1.5'>Référence <span className='text-red-500'>*</span></label>
                <input type="text" value={renameForm.reference} onChange={(e) => setRenameForm({ ...renameForm, reference: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" required />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1.5'>Résumé</label>
                <textarea value={renameForm.resume} onChange={(e) => setRenameForm({ ...renameForm, resume: e.target.value })} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="modal-action">
                <button type="submit" disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
      </div>
    </div>
  )
};

export default DocumentList;
