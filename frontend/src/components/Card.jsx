import React from 'react'

function Card({children}) {
    return (
        <div className="card bg-base-100 w-full shadow-xl">
            <div className="card-body p-5">
                {children}
            </div>
        </div>
    )
}

export default Card