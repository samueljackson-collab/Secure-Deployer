
import React, { useState } from 'react';
import type { ImagingDevice, ComplianceResult, ChecklistItem } from '../types';

const CheckRow: React.FC<{ item: ChecklistItem }> = ({ item }) => (
    <tr className={`border-b border-gray-800 bg-gray-900/50`}>
        <td className="px-4 py-2 text-sm text-gray-300">{item.description}</td>
        <td className="px-4 py-2 text-sm text-gray-400 font-mono">{item.expected}</td>
        <td className={`px-4 py-2 text-sm font-mono text-gray-300`}>{item.actual}</td>
        <td className="px-4 py-2 text-center">
            <span className="text-xl text-[#39FF14]" title="Passed">✅</span>
        </td>
    </tr>
);

const DeviceReport: React.FC<{ device: ImagingDevice, result: ComplianceResult }> = ({ device, result }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="border border-gray-800 rounded-lg">
            <button 
                className="w-full flex justify-between items-center p-3 bg-gray-900 hover:bg-gray-800/50"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span className="font-bold text-gray-200">{device.hostname}</span>
                <div className="flex items-center gap-4">
                    <span className={`font-bold text-[#39FF14]`}>{result.status}</span>
                    <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </span>
                </div>
            </button>
            {isExpanded && (
                <div className="p-4 bg-black/50 overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left">
                        <thead className="bg-gray-900/50">
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
            )}
        </div>
    );
};

interface PassedComplianceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    devices: ImagingDevice[];
}

export const PassedComplianceDetailsModal: React.FC<PassedComplianceDetailsModalProps> = ({ isOpen, onClose, devices }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" aria-modal="true" role="dialog">
            <div className="bg-gray-950 rounded-lg shadow-2xl border border-gray-700 w-full max-w-5xl m-4 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#39FF14]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <h2 className="text-xl font-bold text-gray-100">Passed Device Compliance Reports</h2>
                    </div>
                </div>
                <div className="p-6 flex-grow overflow-y-auto space-y-3">
                    {devices.length > 0 ? (
                        devices.map(device => (
                            <DeviceReport key={device.id} device={device} result={device.complianceCheck!} />
                        ))
                    ) : (
                        <p className="text-center text-gray-400">No devices have passed compliance checks yet.</p>
                    )}
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
