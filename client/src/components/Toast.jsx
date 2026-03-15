import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
    useEffect(() => {
        const timer = setTimeout(() => onClose && onClose(), 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`toast toast-${type}`}>
            <span style={{display:'flex',alignItems:'center'}}>{type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}</span>
            {message}
        </div>
    );
}
