
import React, { useState } from 'react';
import type { Device } from '../types';

const FAILED_STATUSES: Device['status'][] = ['Failed', 'Offline', 'Execution Failed', 'Cancelled'];

const STATUS_STYLE: Record<string, { label: string; border: string; badge: string }> = {
    Failed:           { label: 'Failed',           border: 'border-red-900/60',    badge: 'bg-red-900/50 text-red-400' },
    Offline:          { label: 'Offline',           border: 'border-orange-900/60', badge: 'bg-orange-900/50 text-orange-400' },
    'Execution Failed':{ label: 'Exec Failed',      border: 'border-red-900/60',    badge: 'bg-red-900/50 text-red-400' },
    Cancelled:        { label: 'Cancelled',          border: 'border-gray-700',      badge: 'bg-gray-800 text-gray-400' },
};

export const FailedDeviceReport: React.FC<{ devices: Device[] }> = ({ devices }) => {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const failedDevices = devices.filter(d => FAILED_STATUSES.includes(d.status));
    if (failedDevices.length === 0) return null;

    const toggle = (id: number) =>
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    return (
        <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-red-900/40">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <h2 className="text-xl font-bold text-red-400">
                    Failed Device Report
                </h2>
                <span className="ml-auto text-sm font-bold text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">
                    {failedDevices.length} device{failedDevices.length !== 1 ? 's' : ''}
                </span>
            </div>
            <div className="space-y-2">
                {failedDevices.map(device => {
                    const isOpen = expanded.has(device.id);
                    const style = STATUS_STYLE[device.status] ?? STATUS_STYLE['Failed'];
                    return (
                        <div key={device.id} className={`border rounded-lg overflow-hidden ${style.border}`}>
                            <button
                                onClick={() => toggle(device.id)}
                                className="w-full flex justify-between items-center p-3 bg-black/50 hover:bg-black/70 transition-colors text-left"
                                aria-expanded={isOpen}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}>
                                        {style.label}
                                    </span>
                                    <span className="font-bold text-gray-200 truncate">{device.hostname}</span>
                                    {device.failureDetail && (
                                        <span className="text-xs text-gray-600 font-mono shrink-0 hidden sm:inline">
                                            [{device.failureDetail.errorCode}]
                                        </span>
                                    )}
                                </div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-4 w-4 text-gray-500 shrink-0 ml-2 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>

                            {isOpen && (
                                <div className="bg-black/30 border-t border-gray-800 p-4 space-y-4">
                                    {device.failureDetail ? (
                                        <>
                                            {/* Error summary */}
                                            <div className="flex gap-3">
                                                <div className="shrink-0 mt-0.5">
                                                    <span className="font-mono text-xs bg-gray-900 border border-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                                                        {device.failureDetail.errorCode}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-300">{device.failureDetail.reason}</p>
                                            </div>

                                            {/* Update result (if any) */}
                                            {device.lastUpdateResult && (device.lastUpdateResult.succeeded.length > 0 || device.lastUpdateResult.failed.length > 0) && (
                                                <div className="bg-black/40 rounded p-3 text-xs space-y-1">
                                                    <p className="font-bold text-gray-500 uppercase tracking-wider mb-1">Update Result</p>
                                                    {device.lastUpdateResult.succeeded.length > 0 && (
                                                        <p className="text-[#39FF14]">✓ Updated: {device.lastUpdateResult.succeeded.join(', ')}</p>
                                                    )}
                                                    {device.lastUpdateResult.failed.length > 0 && (
                                                        <p className="text-red-400">✗ Failed: {device.lastUpdateResult.failed.join(', ')}</p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Troubleshooting steps */}
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                    Troubleshooting Steps
                                                </p>
                                                <ol className="space-y-2">
                                                    {device.failureDetail.troubleshootingSteps.map((step, i) => (
                                                        <li key={i} className="flex gap-2 text-sm text-gray-400">
                                                            <span className="text-gray-600 font-bold font-mono shrink-0">{i + 1}.</span>
                                                            <span>{step}</span>
                                                        </li>
                                                    ))}
                                                </ol>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">
                                            {device.status === 'Cancelled'
                                                ? 'This device was manually cancelled during the deployment run.'
                                                : 'No additional error details available for this device.'}
                                        </p>
                                    )}

                                    {/* Device identifiers footer */}
                                    <div className="border-t border-gray-800 pt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700 font-mono">
                                        <span>MAC: {device.mac}</span>
                                        {device.ipAddress && <span>IP: {device.ipAddress}</span>}
                                        {device.serialNumber && <span>S/N: {device.serialNumber}</span>}
                                        {device.model && <span>Model: {device.model}</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
