
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

    const handleClose = () => {
        setCredentials({ username: '', password: '' });
        onClose();
    };

    const isFormValid = credentials.username.trim() !== '' && credentials.password.trim() !== '';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" aria-modal="true" role="dialog">
            <div className="bg-gray-950 rounded-lg shadow-2xl border border-[#39FF14]/50 w-full max-w-md m-4">
                <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#39FF14]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <h2 className="text-xl font-bold text-gray-100">Secure Session Authentication</h2>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-400 font-bold mb-4">
                        Please enter your single-use administrative credentials to authorize this deployment session. These credentials are not stored and are used only for this operation.
                    </p>
                    <CredentialsForm credentials={credentials} setCredentials={setCredentials} />
                </div>
                <div className="p-4 bg-black/50 rounded-b-lg flex justify-end space-x-4">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-gray-700 text-white text-sm font-semibold rounded-lg hover:bg-gray-600 transition duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isFormValid}
                        className="px-6 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#2ECC10] disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition duration-200 shadow-md"
                    >
                        Confirm & Deploy
                    </button>
                </div>
            </div>
        </div>
    );
};