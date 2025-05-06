import clsx from 'clsx'

function Card({children, className, onClick}) {

    return (
        <div
            className={clsx('bg-gray-800 border border-gray-700 rounded-lg shadow-lg', className)} // Enhanced styling
            onClick={onClick ? onClick : null}
        >
            {children}
        </div>
    )
}

export default Card 