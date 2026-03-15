import { useState, useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
    useEffect(() => {
        const timer = setTimeout(() => onClose && onClose(), 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`toast toast-${type}`}>
            <span>{type === 'success' ? '✓' : '✗'}</span>
            {message}
        </div>
    );
}
