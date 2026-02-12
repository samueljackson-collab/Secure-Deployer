
import React from 'react';

interface RescanConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    deviceCount: number;
}

export const RescanConfirmationModal: React.FC<RescanConfirmationModalProps> = ({ isOpen, onClose, onConfirm, deviceCount }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" aria-modal="true" role="dialog">
            <div className="bg-gray-950 rounded-lg shadow-2xl border border-yellow-500/50 w-full max-w-md m-4">
                <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h2 className="text-xl font-bold text-gray-100">Confirm Full System Re-Scan</h2>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-400 font-bold mb-4">
                        You are about to initiate a full compliance and status scan for all <strong className="text-yellow-400">{deviceCount}</strong> device(s) currently in the table.
                    </p>
                    <p className="text-sm text-gray-400 font-bold">
                        This will re-check connectivity, BIOS, DCU, and Windows versions for every machine. This may take some time.
                    </p>
                </div>
                <div className="p-4 bg-black/50 rounded-b-lg flex justify-end space-x-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 text-white text-sm font-semibold rounded-lg hover:bg-gray-600 transition duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition duration-200 shadow-md"
                    >
                        Confirm & Re-Scan
                    </button>
                </div>
            </div>
        </div>
    );
};