
import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, XCircle, Info, X } from 'lucide-react';

type PopupType = 'alert' | 'confirm' | 'prompt';
type Severity = 'info' | 'success' | 'warning' | 'error';

interface PopupOptions {
    title: string;
    message: string;
    type?: PopupType;
    severity?: Severity;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
}

interface PopupContextType {
    showAlert: (title: string, message: string, severity?: Severity) => Promise<void>;
    showConfirm: (title: string, message: string, severity?: Severity) => Promise<boolean>;
    showPrompt: (title: string, message: string, defaultValue?: string, severity?: Severity) => Promise<string | null>;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

export const usePopup = () => {
    const context = useContext(PopupContext);
    if (!context) throw new Error('usePopup must be used within a PopupProvider');
    return context;
};

export const PopupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<PopupOptions | null>(null);
    const [promptValue, setPromptValue] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [resolvePromise, setResolvePromise] = useState<((value: any) => void) | null>(null);

    const show = (opts: PopupOptions) => {
        setOptions(opts);
        setPromptValue(opts.defaultValue || '');
        setIsOpen(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new Promise<any>((resolve) => {
            setResolvePromise(() => resolve);
        });
    };

    const handleConfirm = () => {
        if (!resolvePromise) return;
        setIsOpen(false);
        if (options?.type === 'prompt') resolvePromise(promptValue);
        else if (options?.type === 'confirm') resolvePromise(true);
        else resolvePromise(undefined);
    };

    const handleCancel = () => {
        if (!resolvePromise) return;
        setIsOpen(false);
        if (options?.type === 'prompt') resolvePromise(null);
        else if (options?.type === 'confirm') resolvePromise(false);
        else resolvePromise(undefined);
    };

    const showAlert = (title: string, message: string, severity: Severity = 'info') =>
        show({ title, message, type: 'alert', severity });

    const showConfirm = (title: string, message: string, severity: Severity = 'warning') =>
        show({ title, message, type: 'confirm', severity });

    const showPrompt = (title: string, message: string, defaultValue = '', severity: Severity = 'info') =>
        show({ title, message, type: 'prompt', defaultValue, severity });

    return (
        <PopupContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
            {children}
            {isOpen && options && (
                <div className="popup-overlay animate-fade">
                    <div className="popup-card glassmorphism animate-scale">
                        <div className="popup-header">
                            <div className={`popup-icon-wrapper ${options.severity || 'info'}`}>
                                {options.severity === 'success' && <CheckCircle2 size={24} />}
                                {options.severity === 'error' && <XCircle size={24} />}
                                {options.severity === 'warning' && <AlertCircle size={24} />}
                                {options.severity === 'info' && <Info size={24} />}
                            </div>
                            <button className="popup-close" onClick={handleCancel}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="popup-content">
                            <h3>{options.title}</h3>
                            <p>{options.message}</p>

                            {options.type === 'prompt' && (
                                <div className="input-wrapper" style={{ marginTop: '1.25rem' }}>
                                    <input
                                        type="text"
                                        value={promptValue}
                                        onChange={(e) => setPromptValue(e.target.value)}
                                        autoFocus
                                        className="popup-input"
                                        placeholder="Saisissez ici..."
                                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="popup-footer">
                            {(options.type === 'confirm' || options.type === 'prompt') && (
                                <button className="btn btn-ghost" onClick={handleCancel}>
                                    {options.cancelText || 'Annuler'}
                                </button>
                            )}
                            <button
                                className={`btn ${options.severity === 'error' ? 'btn-danger' : 'btn-primary'}`}
                                onClick={handleConfirm}
                            >
                                {options.confirmText || (options.type === 'alert' ? 'D\'accord' : 'Confirmer')}
                            </button>
                        </div>
                    </div>

                    <style>{`
                        .popup-overlay {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: rgba(0, 0, 0, 0.7);
                            backdrop-filter: blur(4px);
                            display: grid;
                            place-items: center;
                            z-index: 9999;
                            padding: 1.5rem;
                        }
                        .popup-card {
                            width: 100%;
                            max-width: 400px;
                            border-radius: 20px;
                            padding: 1.5rem;
                            border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        .popup-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            margin-bottom: 1.25rem;
                        }
                        .popup-icon-wrapper {
                            width: 48px;
                            height: 48px;
                            border-radius: 12px;
                            display: grid;
                            place-items: center;
                        }
                        .popup-icon-wrapper.info { background: rgba(99, 102, 241, 0.1); color: var(--primary); }
                        .popup-icon-wrapper.success { background: rgba(16, 185, 129, 0.1); color: var(--success); }
                        .popup-icon-wrapper.warning { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
                        .popup-icon-wrapper.error { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

                        .popup-close {
                            background: transparent;
                            border: none;
                            color: var(--text-muted);
                            cursor: pointer;
                            padding: 4px;
                            border-radius: 50%;
                            transition: all 0.2s;
                        }
                        .popup-close:hover { background: rgba(255,255,255,0.05); color: white; }

                        .popup-content h3 {
                            font-size: 1.25rem;
                            font-weight: 700;
                            margin-bottom: 0.5rem;
                            color: white;
                        }
                        .popup-content p {
                            font-size: 0.9375rem;
                            color: var(--text-muted);
                            line-height: 1.5;
                        }
                        .popup-input {
                            width: 100%;
                            background: rgba(255,255,255,0.03);
                            border: 1px solid var(--border);
                            border-radius: 10px;
                            padding: 0.75rem 1rem;
                            color: white;
                            font-size: 0.9375rem;
                        }
                        .popup-input:focus {
                            outline: none;
                            border-color: var(--primary);
                            background: rgba(255,255,255,0.05);
                        }
                        .popup-footer {
                            margin-top: 2rem;
                            display: flex;
                            justify-content: flex-end;
                            gap: 0.75rem;
                        }
                        .btn-ghost {
                            background: transparent;
                            color: var(--text-muted);
                        }
                        .btn-ghost:hover {
                            background: rgba(255,255,255,0.05);
                            color: white;
                        }
                        .btn-danger {
                            background: var(--danger);
                            color: white;
                        }

                        .animate-fade { animation: fadeIn 0.2s ease-out; }
                        .animate-scale { animation: scaleIn 0.2s ease-out; }
                        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                    `}</style>
                </div>
            )}
        </PopupContext.Provider>
    );
};
