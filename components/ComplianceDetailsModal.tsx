
import React from 'react';
import type { ComplianceResult, ChecklistItem } from '../types';

interface ComplianceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: ComplianceResult | null;
}

const CheckRow: React.FC<{ item: ChecklistItem }> = ({ item }) => (
    <tr className={`border-b border-gray-800 ${item.passed ? 'bg-gray-900/50' : 'bg-red-900/20'}`}>
        <td className="px-4 py-2 text-sm text-gray-300">{item.description}</td>
        <td className="px-4 py-2 text-sm text-gray-400 font-mono">{item.expected}</td>
        <td className={`px-4 py-2 text-sm font-mono ${item.passed ? 'text-gray-300' : 'text-red-400 font-bold'}`}>{item.actual}</td>
        <td className="px-4 py-2 text-center">
            {item.passed ? (
                <span className="text-xl text-[#39FF14]" title="Passed">✅</span>
            ) : (
                <span className="text-xl text-red-400" title="Failed">❌</span>
            )}
        </td>
    </tr>
);

export const ComplianceDetailsModal: React.FC<ComplianceDetailsModalProps> = ({ isOpen, onClose, result }) => {
    if (!isOpen || !result) {
        return null;
    }

    const overallStatusColor = result.status === 'Passed' ? 'text-[#39FF14]' : 'text-red-400';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" aria-modal="true" role="dialog">
            <div className="bg-gray-950 rounded-lg shadow-2xl border border-gray-700 w-full max-w-3xl m-4 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#39FF14]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h2 className="text-xl font-bold text-gray-100">Compliance Report</h2>
                    </div>
                    <p className="text-lg font-bold">Overall Status: <span className={overallStatusColor}>{result.status}</span></p>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">
                    <div className="overflow-x-auto">
                         <table className="w-full min-w-[600px] text-left">
                            <thead className="bg-black/50">
                                <tr className="border-b border-gray-700">
                                    <th className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Check Description</th>
                                    <th className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Expected</th>
                                    <th className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Actual</th>
                                    <th className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.details.map((item, index) => (
                                    <CheckRow key={index} item={item} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="p-4 bg-black/50 rounded-b-lg flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-700 text-white text-sm font-semibold rounded-lg hover:bg-gray-600 transition duration-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};