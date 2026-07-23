import React from 'react'
import { LuLoader2 } from 'react-icons/lu'

function Loading() {
  return (
    <div className='w-full bg-amber-100/50 z-[100] h-screen fixed top-0 left-0 flex items-center justify-center'>
        <div className="flex items-center justify-center">
            <LuLoader2 size={50} className='text-primary animate-spin duration-500'/>
        </div>
    </div>
  )
}

export default Loading