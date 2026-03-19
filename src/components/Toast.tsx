import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastProviderProps {
    children: React.ReactNode;
}

export const ToastContext = React.createContext<{
    addToast: (message: string, type: ToastType) => void;
}>({
    addToast: () => { },
});

export const useToast = () => React.useContext(ToastContext);

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = (message: string, type: ToastType) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            removeToast(id);
        }, 4000);
    };

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div style={{
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                pointerEvents: 'none'
            }}>
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        style={{
                            background: 'var(--bg-card)',
                            border: `1px solid ${toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--danger)' : toast.type === 'warning' ? 'var(--warning)' : 'var(--primary)'}`,
                            padding: '1rem 1.25rem',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
                            minWidth: '300px',
                            maxWidth: '450px',
                            animation: 'slideIn 0.3s ease-out forwards',
                            pointerEvents: 'auto'
                        }}
                    >
                        {toast.type === 'success' && <CheckCircle size={18} color="var(--success)" />}
                        {toast.type === 'error' && <AlertCircle size={18} color="var(--danger)" />}
                        {toast.type === 'warning' && <AlertCircle size={18} color="var(--warning)" />}
                        {toast.type === 'info' && <Info size={18} color="var(--primary)" />}

                        <span style={{ fontSize: '0.875rem', flex: 1 }}>{toast.message}</span>

                        <button
                            onClick={() => removeToast(toast.id)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex'
                            }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
            <style>
                {`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                `}
            </style>
        </ToastContext.Provider>
    );
};
