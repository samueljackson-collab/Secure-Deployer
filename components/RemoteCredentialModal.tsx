import React from 'react';
import type { Credentials } from '../types';
import { CredentialsForm } from './CredentialsForm';
import { X, Shield, Lock, Monitor, ArrowRight } from 'lucide-react';

interface RemoteCredentialModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (credentials: Credentials) => void;
    deviceHostname: string;
}

export const RemoteCredentialModal: React.FC<RemoteCredentialModalProps> = ({ isOpen, onClose, onConfirm, deviceHostname }) => {
    const [credentials, setCredentials] = React.useState<Credentials>({ username: '', password: '' });

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(credentials);
        setCredentials({ username: '', password: '' });
    };

    const handleClose = () => {
        setCredentials({ username: '', password: '' });
        onClose();
    };

    const isFormValid = credentials.username.trim() !== '' && credentials.password.trim() !== '';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[100]" aria-modal="true" role="dialog">
            <div className="bg-gray-950 rounded-2xl shadow-2xl border border-cyan-500/30 w-full max-w-md m-4 overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-cyan-500/10 rounded-lg">
                            <Monitor className="h-6 w-6 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Remote Connection</h2>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Secure Gateway Access</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    <div className="flex items-start gap-4 mb-8 p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                        <Shield className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Enter credentials for <span className="text-cyan-400 font-bold font-mono">{deviceHostname}</span>. 
                            These are used only for this session and are <span className="text-white font-bold underline decoration-cyan-500/50">never stored</span>.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <CredentialsForm credentials={credentials} setCredentials={setCredentials} />
                        
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest justify-center">
                            <Lock className="w-3 h-3" />
                            End-to-End Encrypted Session
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-900/30 border-t border-gray-800 flex justify-end space-x-3">
                    <button
                        onClick={handleClose}
                        className="px-5 py-2.5 text-gray-400 text-sm font-bold rounded-xl hover:bg-gray-800 hover:text-white transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isFormValid}
                        className="px-8 py-2.5 bg-cyan-600 text-white text-sm font-bold rounded-xl hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-900/20 active:scale-95 flex items-center gap-2"
                    >
                        Connect Now
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
