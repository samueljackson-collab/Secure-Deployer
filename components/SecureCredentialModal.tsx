
import React, { useState } from 'react';
import type { Credentials } from '../types';
import { CredentialsForm } from './CredentialsForm';

interface SecureCredentialModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (credentials: Credentials) => void;
}

export const SecureCredentialModal: React.FC<SecureCredentialModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [credentials, setCredentials] = useState<Credentials>({ username: '', password: '' });

    if (!isOpen) {
        return null;
    }

    const handleConfirm = () => {
        onConfirm(credentials);
        // Reset for next time
        setCredentials({ username: '', password: '' });
    };

    const isFormValid = credentials.username.trim() !== '' && credentials.password.trim() !== '';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" aria-modal="true" role="dialog">
            <div className="bg-slate-800 rounded-lg shadow-2xl border border-cyan-500/50 w-full max-w-md m-4">
                <div className="p-6 border-b border-slate-700 flex items-center space-x-3">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <h2 className="text-xl font-bold text-slate-100">Secure Session Authentication</h2>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-400 mb-4">
                        Please enter your single-use administrative credentials to authorize this deployment session. These credentials are not stored and are used only for this operation.
                    </p>
                    <CredentialsForm credentials={credentials} setCredentials={setCredentials} />
                </div>
                <div className="p-4 bg-slate-900/50 rounded-b-lg flex justify-end space-x-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-600 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isFormValid}
                        className="px-6 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 disabled:bg-slate-500 disabled:cursor-not-allowed transition duration-200 shadow-md"
                    >
                        Confirm & Deploy
                    </button>
                </div>
            </div>
        </div>
    );
};
