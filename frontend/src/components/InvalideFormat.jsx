import React from 'react'
import { Link } from 'react-router-dom'
import { GET_DOCUMENTS_API } from '../api'

function InvalideFormat({id}) {
  return (
    <div className='flex items-center justify-center p-3 bg-amber-200/50 absolute w-full h-full left-0 '>
        <div className='mx-12 flex flex-col items-center justify-center mb-3 gap-5'>
            <h1 className='text-center text-xl font-semibold font-serif'>
                Le fichier sélectionné, n'est pas encore prise en charge et est cours de développement
            </h1>
            <Link className='p-2 bg-white text-primary border-2 border-primary rounded-md' to={GET_DOCUMENTS_API.url+`/${id}`}>Télécharger le fichier</Link>
        </div>
    </div>
  )
}

export default InvalideFormat