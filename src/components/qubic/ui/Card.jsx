import React from 'react';
import clsx from 'clsx'
import PropTypes from 'prop-types';

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

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  onClick: PropTypes.func,
};

export default Card 