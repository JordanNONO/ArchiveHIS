import React from 'react'

function Card({children}) {
    return (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
            {children}
        </div>
    )
}

export default Card