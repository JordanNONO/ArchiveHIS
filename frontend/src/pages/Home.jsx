import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuBookOpen, LuFileEdit, LuFolder, LuFolderSearch, LuPlus, LuShare2, LuTrash2, LuSearch, LuMoreVertical, LuFileText, LuAlertCircle, LuCheckCircle2, LuClock, LuArchive, LuDownload } from 'react-icons/lu';
import { IoClose } from 'react-icons/io5';
import { toast } from 'react-toastify';
import Cards from '../components/fragments/Cards';
import Breadcrumbs from '../components/Breadcrumbs';
import { createCategorie, deleteCategorieById, downloadCategorie, getCategorie, updateCatgory } from '../api/routes/categorie';
import { getDocument, getDocumentsATraiter } from '../api/routes/document';
import { getFileTypeVisual } from '../utils/fileTypeIcons';
import { getDisplayName } from '../utils/common';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuShortcut } from '../ui/ui/context-menu';
import { useConfirm } from '../contexts/ConfirmDialogContext';

/**
 * Le badge d'un dossier reflète le cas le plus prioritaire parmi ses documents
 * (comme un feu tricolore), puisqu'un dossier contient des documents à des statuts
 * différents : rouge si au moins un rejeté/expiré, jaune si au moins un pas encore
 * traité, vert seulement si tous sont validés/archivés.
 */
function getFolderBadgeTone(dossier) {
  if ((dossier.documents_attention_count ?? 0) > 0) {
    return { classes: 'bg-destructive text-destructive-foreground', label: `${dossier.documents_attention_count} à traiter (rejeté/expiré)` };
  }
  if ((dossier.documents_en_cours_count ?? 0) > 0) {
    return { classes: 'bg-accent text-accent-foreground', label: `${dossier.documents_en_cours_count} pas encore traité(s)` };
  }
  if ((dossier.documents_traites_count ?? 0) > 0) {
    return { classes: 'bg-green-500 text-white', label: 'Tous les documents sont traités' };
  }
  return { classes: 'bg-muted text-muted-foreground', label: 'Aucun document' };
}

function Home() {
  const confirm = useConfirm();
  const [dossiers, setDossiers] = useState([]);
  const [tousLesDocuments, setTousLesDocuments] = useState([]);
  const [folderData, setFolderData] = useState({ label: '' });
  const [searchValue, setSearchValue] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [documentsTrouves, setDocumentsTrouves] = useState([]);
  const [user, setUser] = useState();
  const [aTraiter, setATraiter] = useState({ en_attente: [], a_purger: [] });
  const [showATraiter, setShowATraiter] = useState(true);

  function deleteFolder(id){
    deleteCategorieById(id).then(function(res){
      if (res.status===200) {
        fetchFolders()
        toast.success("Dossier supprimer avec succès")
      }
    })
  }

  async function confirmDeleteFolder(dossier){
    if (await confirm({ message: `Supprimer le dossier « ${dossier.libelle_cat} » ? Cette action n'est pas rétroactive.`, danger: true })) {
      deleteFolder(dossier.id)
    }
  }

  function demanderTelechargement(id){
    downloadCategorie(id).then(async (res) => {
      if (res.status === 202) {
        toast.success('Préparation du dossier en cours, vous serez notifié quand il sera prêt.')
      } else {
        const data = await res.json()
        toast.error(data?.error || "Le téléchargement n'a pas pu être lancé")
      }
    }).catch(() => toast.error("Une erreur s'est produite"))
  }

  function updateFolder(e,id){
    e.preventDefault()
    updateCatgory(folderData,id).then(async function(res){
      if (res.status ===200) {
        fetchFolders()
        document.getElementById('edit_folder' + id)?.close()
      }
      else{
        toast.error("Une erreur est survenue")
      }
    }).catch(function(err){
      console.log(err)
      toast.error("Une erreur est survenue")
    })
  }

  const fetchFolders = async () => {
    try {
      const res = await getCategorie();
      if (res.status === 200) {
        const data = await res.json();
        setDossiers(data);
        setSearchValue(data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const fetchTousLesDocuments = async () => {
    try {
      const res = await getDocument();
      if (res.status === 200) {
        setTousLesDocuments(await res.json());
      }
    } catch (error) {
      console.log(error);
    }
  };

  const fetchATraiter = async () => {
    try {
      const res = await getDocumentsATraiter();
      if (res.status === 200) {
        setATraiter(await res.json());
      }
    } catch (error) {
      console.log(error);
    }
  };

  const getFormData = (e, callback) => {
    callback(prevData => ({
      ...prevData,
      [e.target.name]: e.target.value
    }));
  };

  function searchFolder(e) {
    e.preventDefault();
    const value = e.target.value;
    setSearchTerm(value);

    if (value === "") {
      setSearchValue(dossiers);
      setDocumentsTrouves([]);
      return;
    }

    const terme = value.toLocaleLowerCase();
    setSearchValue(dossiers.filter(d => String(d.libelle_cat).toLocaleLowerCase().includes(terme)));
    setDocumentsTrouves(tousLesDocuments.filter(doc =>
      String(doc.titre_document).toLocaleLowerCase().includes(terme)
      || String(doc.code_reference).toLocaleLowerCase().includes(terme)
      || String(doc.auteur).toLocaleLowerCase().includes(terme)
      || String(doc.resume).toLocaleLowerCase().includes(terme)
      || String(doc.texte_extrait || '').toLocaleLowerCase().includes(terme)
    ));
  }

  const createFolder = async (e) => {
    e.preventDefault();
    try {
      const res = await createCategorie(folderData);
      if (res.status === 201) {
        fetchFolders();
        toast.success("Votre dossier a été bien créé");
      } else {
        toast.error("Une erreur s'est produite");
      }
    } catch (error) {
      toast.error("Une erreur s'est produite");
      console.log(error);
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    setUser(JSON.parse(sessionStorage.getItem("user")));
    fetchFolders();
    fetchTousLesDocuments();
    fetchATraiter();
  }, []);

  function joursDepuis(dateStr) {
    const jours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    return jours;
  }

  function joursAvant(dateStr) {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function saluation() {
    const heure = new Date().getHours();
    return heure < 18 ? 'Bonjour' : 'Bonsoir';
  }

  const totalAttention = dossiers.reduce((sum, d) => sum + (d.documents_attention_count ?? 0), 0);
  const totalTraites = dossiers.reduce((sum, d) => sum + (d.documents_traites_count ?? 0), 0);

  const stats = [
    { label: 'Dossiers', value: dossiers.length, icon: LuFolder, tint: 'bg-primary/10 text-primary' },
    { label: 'Documents', value: tousLesDocuments.length, icon: LuFileText, tint: 'bg-secondary/10 text-secondary' },
    { label: 'À traiter', value: totalAttention, icon: LuAlertCircle, tint: 'bg-destructive/10 text-destructive' },
    { label: 'Traités', value: totalTraites, icon: LuCheckCircle2, tint: 'bg-green-500/10 text-green-600' },
  ];

  return (
    <div className='flex flex-col flex-grow py-6 gap-1'>
      <Breadcrumbs where="Tableau de bord" />
      <div className='mb-6 mt-1'>
        <div className='flex items-start justify-between flex-wrap gap-3 mb-4'>
          <div>
            <h2 className='text-2xl font-semibold text-foreground'>{saluation()}, {getDisplayName(user) || 'bienvenue'}</h2>
            <p className='text-sm text-muted-foreground mt-1'>
              {totalAttention > 0
                ? `${totalAttention} document${totalAttention > 1 ? 's' : ''} ${totalAttention > 1 ? 'vous attendent' : 'vous attend'} aujourd'hui.`
                : 'Tout est à jour, aucun document en attente.'}
            </p>
          </div>
          <p className='text-sm text-muted-foreground capitalize sm:text-right'>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {showATraiter && (aTraiter.en_attente.length > 0 || aTraiter.a_purger.length > 0) && (
          <div className='rounded-2xl border border-accent/40 bg-accent/5 p-4 mb-4'>
            <div className='flex items-center justify-between mb-3'>
              <h3 className='text-sm font-semibold text-foreground'>À traiter bientôt</h3>
              <button onClick={() => setShowATraiter(false)} className='text-muted-foreground hover:text-foreground transition-colors'>
                <IoClose size={18} />
              </button>
            </div>
            <div className='flex flex-col gap-2'>
              {aTraiter.en_attente.map((d) => (
                <Link key={`att-${d.id}`} to={`/view/${d.id}/${d.extension || 'pdf'}`} className='flex items-center gap-2.5 text-sm hover:bg-card rounded-lg p-1.5 -m-1.5 transition-colors'>
                  <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-accent/20 text-accent-foreground shrink-0'>
                    <LuClock size={15} />
                  </span>
                  <span className='min-w-0 truncate'>
                    <span className='font-medium'>{d.titre}</span>
                    <span className='text-muted-foreground'> — en attente depuis {joursDepuis(d.depuis)} j</span>
                  </span>
                </Link>
              ))}
              {aTraiter.a_purger.map((d) => {
                const jours = joursAvant(d.echeance);
                return (
                  <Link key={`pur-${d.id}`} to={`/view/${d.id}/${d.extension || 'pdf'}`} className='flex items-center gap-2.5 text-sm hover:bg-card rounded-lg p-1.5 -m-1.5 transition-colors'>
                    <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 text-destructive shrink-0'>
                      <LuArchive size={15} />
                    </span>
                    <span className='min-w-0 truncate'>
                      <span className='font-medium'>{d.titre}</span>
                      <span className='text-muted-foreground'> — {jours >= 0 ? `à purger dans ${jours} j` : `échéance dépassée depuis ${-jours} j`}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
          {stats.map((s) => (
            <div key={s.label} className='flex items-center gap-3 rounded-2xl border border-border bg-card p-4'>
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${s.tint}`}>
                <s.icon size={18} />
              </div>
              <div>
                <p className='text-lg font-semibold text-foreground leading-none'>{s.value}</p>
                <p className='text-xs text-muted-foreground mt-0.5'>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Cards />
      <div>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4'>
          <div className='relative w-full sm:w-64'>
            <LuSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
            <input
              type="text"
              onChange={searchFolder}
              className="w-full rounded-lg bg-muted border-none pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              placeholder="Rechercher un dossier..."
            />
          </div>
          <button
            onClick={() => document.getElementById('createFolder').showModal()}
            className='inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0'
          >
            <LuPlus size={16} />
            Nouveau dossier
          </button>
        </div>
        {searchValue.length === 0 && (
          <div className='flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center'>
            <LuFolderSearch size={32} className='text-muted-foreground' strokeWidth={1.5} />
            <p className='text-sm font-medium text-foreground'>
              {dossiers.length === 0 ? 'Aucun dossier pour le moment' : 'Aucun dossier ne correspond à votre recherche'}
            </p>
            <p className='text-xs text-muted-foreground'>
              {dossiers.length === 0 ? 'Créez votre premier dossier pour commencer à archiver.' : 'Essayez un autre terme de recherche.'}
            </p>
          </div>
        )}
        <div className='grid lg:grid-cols-6 md:grid-cols-4 sm:grid-cols-3 grid-cols-2 gap-4 w-full'>
          {searchValue.map((dossier, k) => (
            <div key={k} className='relative group'>
              <ContextMenu>
                <ContextMenuTrigger>
                  <Link
                    to={'folder/' + dossier.id}
                    className='relative flex flex-col items-center justify-center gap-2 h-[150px] rounded-2xl border border-border bg-card p-5 text-center hover:border-primary/40 hover:shadow-md transition-all duration-200'
                  >
                    <span
                      title={getFolderBadgeTone(dossier).label}
                      className={`absolute top-2.5 left-2.5 min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-semibold flex items-center justify-center ${getFolderBadgeTone(dossier).classes}`}
                    >
                      {dossier.document_archives_count ?? 0}
                    </span>
                    <LuFolder size={44} className='text-primary' strokeWidth={1.5} />
                    <span className='text-sm font-medium text-foreground line-clamp-2'>{dossier.libelle_cat}</span>
                  </Link>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-64">
                  <ContextMenuItem inset className="cursor-pointer" onClick={() => { navigate('folder/' + dossier.id) }}>
                    Ouvrir le dossier
                    <ContextMenuShortcut><LuBookOpen /></ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem inset className="cursor-pointer" onClick={() => demanderTelechargement(dossier.id)}>
                    Télécharger le dossier
                    <ContextMenuShortcut><LuDownload /></ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem inset className="cursor-pointer" disabled={user?.role !== "Administrator"}>
                    Partager le dossier
                    <ContextMenuShortcut><LuShare2 /></ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem inset className="cursor-pointer" onClick={() => document.getElementById('edit_folder' + dossier.id).showModal()} disabled={user?.role !== "Administrator"}>
                    Renommer le dossier
                    <ContextMenuShortcut><LuFileEdit /></ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem disabled={user?.role !== "Administrator"} onClick={() => confirmDeleteFolder(dossier)} inset className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer">
                    <div>
                      Supprimer le dossier
                    </div>
                    <ContextMenuShortcut><LuTrash2 /></ContextMenuShortcut>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              {/* Menu d'actions toujours accessible (le clic-droit ne fonctionne pas au toucher) */}
              <div className='dropdown dropdown-end absolute top-1.5 right-1.5 z-10'>
                <button
                  tabIndex={0}
                  onClick={(e) => e.stopPropagation()}
                  className='flex items-center justify-center w-7 h-7 rounded-lg bg-card/90 text-muted-foreground opacity-70 hover:opacity-100 hover:bg-muted hover:text-foreground transition-all'
                >
                  <LuMoreVertical size={14} />
                </button>
                <div tabIndex={0} className='dropdown-content flex items-center gap-1 bg-card border border-border rounded-xl z-20 p-1.5 shadow-lg mt-1'>
                  <button title="Ouvrir le dossier" onClick={() => navigate('folder/' + dossier.id)} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
                    <LuBookOpen size={15} />
                  </button>
                  <button title="Partager le dossier" disabled={user?.role !== "Administrator"} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                    <LuShare2 size={15} />
                  </button>
                  <button title="Renommer le dossier" disabled={user?.role !== "Administrator"} onClick={() => document.getElementById('edit_folder' + dossier.id).showModal()} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                    <LuFileEdit size={15} />
                  </button>
                  <button
                    title="Supprimer le dossier"
                    disabled={user?.role !== "Administrator"}
                    onClick={() => confirmDeleteFolder(dossier)}
                    className='flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
                  >
                    <LuTrash2 size={15} />
                  </button>
                </div>
              </div>

              <dialog id={"edit_folder" + dossier.id} className="modal">
                <div className="modal-box rounded-2xl">

                    <form method="dialog" className='flex justify-end'>
                      <button className="btn btn-sm btn-ghost btn-circle">✕</button>
                    </form>

                  <h1 className='text-lg font-semibold mb-4'>
                    Modifier le nom du dossier ({dossier.libelle_cat})
                  </h1>
                  <form onSubmit={(e)=>updateFolder(e,dossier.id)}>
                      <div className="mb-4">
                        <label htmlFor="name" className='block text-sm font-medium mb-1.5'>Nom du dossier</label>
                        <input
                          type="text"
                          id='name'
                          name='label'
                          onChange={(e) => getFormData(e, setFolderData)}
                          placeholder={dossier.libelle_cat}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="modal-action">
                        <button className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>Modifier</button>
                      </div>
                    </form>

                </div>
              </dialog>
            </div>
          ))}
        </div>

        {searchTerm !== '' && documentsTrouves.length > 0 && (
          <div className='mt-6'>
            <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3'>
              Documents ({documentsTrouves.length})
            </p>
            <div className='grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3'>
              {documentsTrouves.map((doc) => {
                const { icon: Icon, tint } = getFileTypeVisual(doc.chemin_stockage_serveur);
                const ext = String(doc.chemin_stockage_serveur).split('.').pop();
                return (
                  <button
                    key={doc.id}
                    onClick={() => navigate(`/view/${doc.id}/${ext}`)}
                    className='flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:shadow-md transition-all duration-200'
                  >
                    <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${tint}`}>
                      <Icon size={19} />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-foreground truncate'>{doc.titre_document}</p>
                      <p className='text-xs text-muted-foreground truncate mt-0.5'>{doc.categorie_document?.libelle_cat}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <dialog id="createFolder" className="modal">
        <div className="modal-box w-3/4 rounded-2xl">
          <form method="dialog" className='flex justify-end'>
            <button className='btn btn-sm btn-ghost btn-circle'><IoClose /></button>
          </form>
          <div className='py-2'>
            <h1 className='text-lg font-semibold mb-4'>Nouveau dossier</h1>
            <form onSubmit={createFolder}>
              <div className="mb-4">
                <label htmlFor="name" className='block text-sm font-medium mb-1.5'>Nom du dossier</label>
                <input
                  type="text"
                  id='name'
                  name='label'
                  onChange={(e) => getFormData(e, setFolderData)}
                  placeholder="Informatique"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="modal-action">
                <button className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>Créer</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>

    </div>
  );
}

export default Home;
