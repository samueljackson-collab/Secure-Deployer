import React from 'react';
import type { Credentials } from '../types';
import { CredentialsForm } from './CredentialsForm';

interface RemoteCredentialModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (credentials: Credentials) => void;
    deviceHostname: string;
}

const RemoteCredentialModal: React.FC<RemoteCredentialModalProps> = ({ isOpen, onClose, onConfirm, deviceHostname }) => {
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
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" aria-modal="true" role="dialog">
            <div className="bg-gray-950 rounded-lg shadow-2xl border border-cyan-400/50 w-full max-w-md m-4">
                <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <h2 className="text-xl font-bold text-gray-100">Remote Connection</h2>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-400 font-bold mb-4">
                        Enter credentials for <span className="text-cyan-400 font-mono">{deviceHostname}</span>. These are for one-time use and are not stored.
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
                        className="px-6 py-2 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition duration-200 shadow-md"
                    >
                        Connect
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RemoteCredentialModal;
