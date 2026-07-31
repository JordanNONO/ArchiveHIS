import React from 'react'

function InvalideFormat({href}) {
  return (
    <div className='flex items-center justify-center p-3 bg-accent/20 absolute w-full h-full left-0 '>
        <div className='mx-12 flex flex-col items-center justify-center mb-3 gap-5'>
            <h1 className='text-center text-xl font-semibold font-serif'>
                Le fichier sélectionné, n'est pas encore prise en charge et est cours de développement
            </h1>
            <a className='p-2 bg-white text-primary border-2 border-primary rounded-md' href={href}>Télécharger le fichier</a>
        </div>
    </div>
  )
}

export default InvalideFormat
