import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, ShieldAlert, ShieldCheck, ShieldX, ChevronRight } from 'lucide-react';
import { analyzeScriptRisks } from '../services/powershellScript';

interface ScriptAnalysisModalProps {
    isOpen: boolean;
    scriptContent: string;
    deviceHostname?: string;
    onClose: () => void;
    onApprove: () => void;
}

export const ScriptAnalysisModal: React.FC<ScriptAnalysisModalProps> = ({
    isOpen,
    scriptContent,
    deviceHostname,
    onClose,
    onApprove,
}) => {
    const analysis = useMemo(() => analyzeScriptRisks(scriptContent), [scriptContent]);

    const riskConfig = {
        low: { icon: ShieldCheck, color: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-700', label: 'Low Risk' },
        medium: { icon: ShieldAlert, color: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-700', label: 'Medium Risk' },
        high: { icon: ShieldX, color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-700', label: 'High Risk' },
    };

    const cfg = riskConfig[analysis.level];
    const RiskIcon = cfg.icon;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
                    >
                        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950 rounded-t-xl">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <RiskIcon className={cfg.color} size={22} />
                                Script Security Analysis
                            </h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-6 flex flex-col gap-5 overflow-y-auto flex-grow">
                            <div className={`flex items-center gap-3 p-4 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                                <RiskIcon className={`${cfg.color} flex-shrink-0`} size={28} />
                                <div>
                                    <p className={`font-bold text-lg ${cfg.color}`}>{cfg.label}</p>
                                    <p className="text-sm text-gray-400">
                                        {deviceHostname ? `Target: ${deviceHostname}` : 'Target: All monitor devices'}
                                        {analysis.warnings.length > 0
                                            ? ` · ${analysis.warnings.length} warning${analysis.warnings.length !== 1 ? 's' : ''} detected`
                                            : ' · No dangerous patterns detected'}
                                    </p>
                                </div>
                            </div>

                            {analysis.warnings.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-2 tracking-wide">Warnings</h4>
                                    <div className="space-y-2">
                                        {analysis.warnings.map((w, i) => (
                                            <div key={i} className="flex items-start gap-3 bg-gray-800 rounded-lg p-3 border border-gray-700">
                                                <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
                                                <div>
                                                    <p className="text-sm text-gray-200 font-medium">{w.pattern}</p>
                                                    <p className="text-xs text-gray-400 mt-0.5">{w.description}</p>
                                                    {w.line !== undefined && (
                                                        <p className="text-xs text-gray-500 mt-0.5 font-mono">Line {w.line + 1}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {analysis.warnings.length === 0 && (
                                <div className="flex items-center gap-3 bg-green-900/20 border border-green-800 rounded-lg p-3">
                                    <CheckCircle className="text-green-400" size={16} />
                                    <p className="text-sm text-green-300">No dangerous PowerShell patterns detected in this script.</p>
                                </div>
                            )}

                            <div>
                                <h4 className="text-sm font-bold text-gray-400 uppercase mb-2 tracking-wide">Script Preview</h4>
                                <pre className="bg-black rounded-lg border border-gray-800 p-4 text-xs font-mono text-gray-300 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                                    {scriptContent.slice(0, 600)}{scriptContent.length > 600 ? '\n…(truncated)' : ''}
                                </pre>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3 bg-gray-950 rounded-b-xl">
                            <button
                                onClick={onClose}
                                className="px-5 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onApprove}
                                className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
                                    analysis.level === 'high'
                                        ? 'bg-red-700 hover:bg-red-600 text-white'
                                        : 'bg-[#39FF14] hover:bg-[#32e612] text-black'
                                }`}
                            >
                                {analysis.level === 'high' ? 'Proceed Anyway' : 'Run Script'}
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
