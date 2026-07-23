import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { consultationDocument, viewDocument } from '../api/routes/document';
import Loading from '../components/Loading';
import { GET_DOCUMENTS_API } from '../api';
import DocxReader from '../plugins/DocxReader';
/* import ExcelReader from '../plugins/ExcelReader';
import PptxReader from '../plugins/PptxReader'; */
import InvalideFormat from '../components/InvalideFormat';

function DocView() {
    const {id,type} = useParams();
    const [getdocument,setDocument] = useState({});
    const [loading,setLoading] = useState(false)
    const user = JSON.parse(sessionStorage.getItem('user'))
    function getDoc(){
        setLoading(true)
        viewDocument(id).then(async(res)=>{
            if (res.status ===200) {
                const data = await res.blob()
                consultationDocument({user_id:user?.id,document_id:id})
                setDocument(data)
                setLoading(false)
                console.log(data)
            }
        }).catch(function(err){
            console.log(err)
            setLoading(false)
        })
    }
    useEffect(() => {
      getDoc()
    }, [])

    const ReadFile = () => {
      const fileExtension = type;
      switch (fileExtension) {
        case 'pdf':
          return  <iframe src={GET_DOCUMENTS_API.url+`/${id}`} className='w-[80vw] h-[90vh]' frameborder="0"></iframe>;
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
    
  return loading? <Loading/>:(
    <div>
      {<ReadFile/>}
        {/* <DocViewer pluginRenderers={[DocViewerRenderers,PDFRenderer]} documents={[{fileData:GET_DOCUMENTS_API.url+`/${id}`}]}>

</DocViewer> */}
       {/* <iframe src={GET_DOCUMENTS_API.url+`/${id}`} className='w-[80vw] h-[90vh]' frameborder="0"></iframe> */}
    </div>
  )
}

export default DocView