
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface ScriptAnalysisModalProps {
    isOpen: boolean;
    isLoading: boolean;
    analysisResult: string;
    onClose: () => void;
}

export const ScriptAnalysisModal: React.FC<ScriptAnalysisModalProps> = ({ isOpen, isLoading, analysisResult, onClose }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" aria-modal="true" role="dialog">
            <div className="bg-slate-800 rounded-lg shadow-2xl border border-indigo-500/50 w-full max-w-3xl m-4 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <h2 className="text-xl font-bold text-slate-100">AI Script Security Analysis</h2>
                    </div>
                     <button
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition duration-200"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center text-center text-slate-400 h-64">
                            <svg className="animate-spin h-8 w-8 text-indigo-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-lg font-semibold">Analyzing Script...</p>
                            <p className="text-sm">Please wait while the AI examines the script for security vulnerabilities.</p>
                        </div>
                    ) : (
                        <article className="prose prose-sm prose-invert max-w-none prose-headings:text-indigo-400 prose-strong:text-slate-100 prose-a:text-cyan-400 hover:prose-a:text-cyan-300 prose-code:text-yellow-300 prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-indigo-500 prose-blockquote:text-slate-400">
                             <ReactMarkdown>{analysisResult}</ReactMarkdown>
                        </article>
                    )}
                </div>
                <div className="p-4 bg-slate-900/50 rounded-b-lg flex justify-end space-x-4 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-600 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition duration-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
