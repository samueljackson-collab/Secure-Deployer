import React from 'react';

/**
 * ScriptAnalysisModal — Planned feature.
 * Will display AI-powered analysis of uploaded PowerShell/batch scripts
 * using the Gemini API (see services/geminiService.ts).
 */
export const ScriptAnalysisModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-gray-950 rounded-lg shadow-2xl border border-gray-700 w-full max-w-md m-4 p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-[#39FF14] mb-3">Script Analysis</h2>
                <p className="text-sm text-gray-400">
                    AI-powered script analysis is coming soon. This feature will use the Gemini API to review
                    deployment scripts for security issues, syntax errors, and best-practice violations.
                </p>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors">Close</button>
            </div>
        </div>
    );
};
