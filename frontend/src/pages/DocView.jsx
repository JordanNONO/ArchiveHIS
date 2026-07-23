import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { consultationDocument, viewDocument, getDocumentMeta, getDocumentHistorique, transitionDocument } from '../api/routes/document';
import Loading from '../components/Loading';
import { GET_DOCUMENTS_API } from '../api';
import DocxReader from '../plugins/DocxReader';
/* import ExcelReader from '../plugins/ExcelReader';
import PptxReader from '../plugins/PptxReader'; */
import InvalideFormat from '../components/InvalideFormat';
import StatutBadge, { STATUT_LABELS, STATUT_TRANSITIONS } from '../components/StatutBadge';
import { usePermissions } from '../hooks/usePermissions';
import { toast } from 'react-toastify';

function DocView() {
    const {id,type} = useParams();
    const [getdocument,setDocument] = useState({});
    const [loading,setLoading] = useState(false)
    const [meta, setMeta] = useState(null)
    const [historique, setHistorique] = useState([])
    const [motif, setMotif] = useState('')
    const [transitioning, setTransitioning] = useState(false)
    const user = JSON.parse(sessionStorage.getItem('user'))
    const { hasPermission, isAdministrator } = usePermissions();
    const canValidate = isAdministrator || hasPermission('valider_documents');

    function getDoc(){
        setLoading(true)
        viewDocument(id).then(async(res)=>{
            if (res.status ===200) {
                const data = await res.blob()
                consultationDocument({user_id:user?.id,document_id:id})
                setDocument(data)
                setLoading(false)
            }
        }).catch(function(err){
            console.log(err)
            setLoading(false)
        })
    }

    function fetchMeta(){
        getDocumentMeta(id).then(async (res) => {
            if (res.status === 200) {
                setMeta(await res.json())
            }
        }).catch((err) => console.log(err))
    }

    function fetchHistorique(){
        getDocumentHistorique(id).then(async (res) => {
            if (res.status === 200) {
                setHistorique(await res.json())
            }
        }).catch((err) => console.log(err))
    }

    useEffect(() => {
      getDoc()
      fetchMeta()
      fetchHistorique()
    }, [])

    async function doTransition(nouveauStatut){
        try {
            setTransitioning(true)
            const res = await transitionDocument(id, { nouveau_statut: nouveauStatut, motif: motif || undefined })
            if (res.status === 200) {
                toast.success('Statut mis à jour')
                setMotif('')
                fetchMeta()
                fetchHistorique()
            } else {
                const data = await res.json()
                toast.error(data?.error || 'Transition non autorisée')
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        } finally {
            setTransitioning(false)
        }
    }

    const ReadFile = () => {
      const fileExtension = type;
      switch (fileExtension) {
        case 'pdf':
          return  <iframe src={GET_DOCUMENTS_API.url+`/${id}`} className='w-full h-[90vh]' frameborder="0"></iframe>;
        case 'doc':
        case 'docx':
          return <DocxReader fileUrl={GET_DOCUMENTS_API.url+`/${id}`}/>
        case 'xls':
        case 'xlsx':
        case 'csv':
          return <InvalideFormat id={id}/>//<ExcelReader fileUrl={GET_DOCUMENTS_API.url+`/${id}`}/>;
        case 'ppt':
        case 'pptx':
          return <InvalideFormat id={id} />;
        default:
          return <InvalideFormat id={id}/>;
      }
    };

    const transitionsPossibles = meta?.status_doc ? (STATUT_TRANSITIONS[meta.status_doc] || []) : [];

  return loading? <Loading/>:(
    <div className='flex w-full gap-4'>
      <div className='flex-grow'>
        {<ReadFile/>}
      </div>
      <div className='w-80 flex-shrink-0 py-4 pr-4'>
        <div className='mb-4'>
          <h2 className='font-bold text-lg mb-1'>{meta?.titre_document}</h2>
          <StatutBadge statut={meta?.status_doc} />
        </div>

        {canValidate && transitionsPossibles.length > 0 && (
          <div className='mb-6 border border-border rounded-lg p-3'>
            <h3 className='font-semibold mb-2 text-sm'>Faire évoluer le statut</h3>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Motif (optionnel)"
              className='textarea textarea-bordered textarea-sm w-full mb-2'
            />
            <div className='flex flex-col gap-2'>
              {transitionsPossibles.map((statut) => (
                <button
                  key={statut}
                  disabled={transitioning}
                  onClick={() => doTransition(statut)}
                  className='btn btn-sm bg-primary text-white hover:bg-primary'
                >
                  → {STATUT_LABELS[statut] || statut}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className='font-semibold mb-2 text-sm'>Historique des statuts</h3>
          <ul className='flex flex-col gap-3'>
            {historique.map((h) => (
              <li key={h.id} className='text-sm border-l-2 border-border pl-2'>
                <div className='flex items-center gap-1 flex-wrap'>
                  {h.ancien_statut && <StatutBadge statut={h.ancien_statut} />}
                  {h.ancien_statut && <span>→</span>}
                  <StatutBadge statut={h.nouveau_statut} />
                </div>
                <div className='text-muted-foreground text-xs mt-1'>
                  {new Date(h.date_changement).toLocaleString()}
                </div>
                {h.motif_changement && <div className='text-xs mt-1'>{h.motif_changement}</div>}
              </li>
            ))}
            {historique.length === 0 && <li className='text-sm text-muted-foreground'>Aucun historique</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default DocView
