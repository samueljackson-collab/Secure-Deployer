import React from 'react';
import type { ScriptSafetyResult } from '../types';

interface ScriptAnalysisModalProps {
    isOpen: boolean;
    isLoading: boolean;
    result: ScriptSafetyResult | null;
    onClose: () => void;
}

const severityColors: Record<string, string> = {
    INFO: 'text-slate-400 bg-slate-700/50',
    WARNING: 'text-yellow-400 bg-yellow-900/30',
    DANGER: 'text-orange-400 bg-orange-900/30',
    BLOCKED: 'text-red-400 bg-red-900/30',
};

const riskLevelColors: Record<string, string> = {
    LOW: 'text-green-400 border-green-500',
    MEDIUM: 'text-yellow-400 border-yellow-500',
    HIGH: 'text-orange-400 border-orange-500',
    CRITICAL: 'text-red-400 border-red-500',
};

export const ScriptAnalysisModal: React.FC<ScriptAnalysisModalProps> = ({ isOpen, isLoading, result, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" aria-modal="true" role="dialog">
            <div className="bg-slate-800 rounded-lg shadow-2xl border border-amber-500/50 w-full max-w-3xl m-4 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <h2 className="text-xl font-bold text-slate-100">Script Safety Analysis</h2>
                        <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">Deterministic - No AI</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center text-center text-slate-400 h-64">
                            <svg className="animate-spin h-8 w-8 text-amber-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-lg font-semibold">Analyzing Script...</p>
                            <p className="text-sm">Running deterministic pattern analysis for hospital network safety.</p>
                        </div>
                    ) : result ? (
                        <div className="space-y-6">
                            <div className={`p-4 rounded-lg border-2 text-center ${riskLevelColors[result.riskLevel] || 'border-slate-500'}`}>
                                <p className="text-sm font-medium uppercase tracking-wider">Risk Level</p>
                                <p className="text-3xl font-bold">{result.riskLevel}</p>
                                <p className={`text-sm mt-1 ${result.isSafe ? 'text-green-400' : 'text-red-400'}`}>
                                    {result.isSafe ? 'Script passed safety checks' : 'SCRIPT BLOCKED - Contains dangerous patterns'}
                                </p>
                            </div>

                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <h3 className="font-semibold text-slate-200 mb-2">Summary</h3>
                                <p className="text-sm text-slate-400">{result.summary}</p>
                            </div>

                            {result.blockedPatterns.length > 0 && (
                                <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/50">
                                    <h3 className="font-semibold text-red-400 mb-2">Blocked Patterns ({result.blockedPatterns.length})</h3>
                                    <ul className="space-y-1">
                                        {result.blockedPatterns.map((pattern, i) => (
                                            <li key={i} className="text-sm text-red-300 flex items-start gap-2">
                                                <span className="text-red-500 flex-shrink-0 font-bold">X</span>
                                                <span className="font-mono text-xs break-all">{pattern}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {result.scopeViolations.length > 0 && (
                                <div className="bg-orange-900/20 p-4 rounded-lg border border-orange-500/50">
                                    <h3 className="font-semibold text-orange-400 mb-2">Scope Violations ({result.scopeViolations.length})</h3>
                                    <ul className="space-y-1">
                                        {result.scopeViolations.map((v, i) => (
                                            <li key={i} className="text-sm text-orange-300 flex items-start gap-2">
                                                <span className="text-orange-500 flex-shrink-0 font-bold">!</span>
                                                <span>{v}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {result.findings.length > 0 && (
                                <div>
                                    <h3 className="font-semibold text-slate-200 mb-3">Findings ({result.findings.length})</h3>
                                    <div className="space-y-2">
                                        {result.findings.map((finding, i) => (
                                            <div key={i} className={`p-3 rounded-md border border-slate-700 ${severityColors[finding.severity]?.split(' ').slice(1).join(' ') || 'bg-slate-800'}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${severityColors[finding.severity] || 'text-slate-400'}`}>
                                                        {finding.severity}
                                                    </span>
                                                    <span className="text-xs text-slate-500">Line {finding.line}</span>
                                                </div>
                                                <p className="text-sm font-mono text-slate-300 mb-1">{finding.pattern}</p>
                                                <p className="text-xs text-slate-400">{finding.description}</p>
                                                <p className="text-xs text-cyan-400 mt-1">{finding.recommendation}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {result.findings.length === 0 && result.blockedPatterns.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-green-400 text-lg font-semibold">No issues detected</p>
                                    <p className="text-sm text-slate-400 mt-1">Script appears safe for deployment on verified devices.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500">No analysis data available.</div>
                    )}
                </div>
                <div className="p-4 bg-slate-900/50 rounded-b-lg flex justify-end flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-600 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
