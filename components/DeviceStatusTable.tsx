

import React from 'react';
import type { Device, DeploymentStatus } from '../types';
import { DeviceIcon } from './DeviceIcon';

// Developer note: map every deployment status to a visual severity/phase cue
// so operators can scan a large list without expanding each card.
const statusColors: Record<DeploymentStatus, string> = {
    Pending: 'text-slate-400',
    'Waking Up': 'text-yellow-400 animate-pulse',
    Connecting: 'text-cyan-400 animate-pulse',
    'Retrying...': 'text-cyan-400 animate-pulse',
    'Checking Info': 'text-sky-400 animate-pulse',
    'Checking BIOS': 'text-sky-400 animate-pulse',
    'Checking DCU': 'text-sky-400 animate-pulse',
    'Checking Windows': 'text-sky-400 animate-pulse',
    'Scan Complete': 'text-yellow-400',
    Updating: 'text-blue-400 animate-pulse',
    'Updating BIOS': 'text-blue-400 animate-pulse',
    'Updating DCU': 'text-blue-400 animate-pulse',
    'Updating Windows': 'text-blue-400 animate-pulse',
    'Update Complete (Reboot Pending)': 'text-purple-400',
    'Rebooting...': 'text-teal-400 animate-pulse',
    Success: 'text-green-400',
    Failed: 'text-red-400',
    Offline: 'text-orange-400',
    Cancelled: 'text-gray-500',
};

const StatusBadge: React.FC<{ status: DeploymentStatus; retryAttempt?: number }> = ({ status, retryAttempt }) => {
    const color = statusColors[status] || 'text-slate-400';
    const text = status === 'Retrying...' && retryAttempt ? `Retrying... (${retryAttempt})` : status;
    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full bg-slate-700 ${color}`}>
            {text}
        </span>
    );
};

const DetailItem: React.FC<{ label: string; value?: string | number | React.ReactNode; mono?: boolean }> = ({ label, value, mono = true }) => {
    if (typeof value === 'undefined' || value === null) {
        return <li className="flex justify-between items-center text-slate-500"><span>{label}</span> <span>-</span></li>;
    }
    return (
        <li className="flex justify-between items-center">
            <span>{label}</span>
            <span className={`${mono ? 'font-mono' : ''} text-sm text-right break-all`}>
                {value}
            </span>
        </li>
    );
};

const EncryptionStatus: React.FC<{ status?: 'Enabled' | 'Disabled' | 'Unknown' }> = ({ status }) => {
    if (status === 'Enabled') {
        return (
            <span className="flex items-center gap-1.5 text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
                {status}
            </span>
        );
    }
    if (status === 'Disabled') {
         return (
            <span className="flex items-center gap-1.5 text-red-400">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zm0 8a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1z" /><path d="M9 4.805A3.985 3.985 0 0110 4c1.628 0 3.065.926 3.712 2.254A1 1 0 0113 7.828V9H7V7.828a1 1 0 01-.712-1.723A3.987 3.987 0 019 4.805z" /></svg>
                {status}
            </span>
        );
    }
    return <span>{status || 'Unknown'}</span>;
};


const UpdateResult: React.FC<{ result: Device['lastUpdateResult'] }> = ({ result }) => {
    // Developer note: summarize per-device component outcomes after update flow.
    if (!result || (result.succeeded.length === 0 && result.failed.length === 0)) {
        return null;
    }

    return (
        <div className="text-xs text-slate-400 mt-2 space-y-1 border-t border-slate-700 pt-2">
            {result.succeeded.length > 0 && (
                <p>✅ <span className="font-semibold">Updated:</span> {result.succeeded.join(', ')}</p>
            )}
            {result.failed.length > 0 && (
                <p>❌ <span className="font-semibold text-red-400">Failed:</span> {result.failed.join(', ')}</p>
            )}
        </div>
    );
};

interface DeviceStatusTableProps {
    devices: Device[];
    selectedDeviceIds: Set<number>;
    onUpdateDevice: (deviceId: number) => void;
    onRebootDevice: (deviceId: number) => void;
    onDeviceSelect: (deviceId: number) => void;
    onSelectAll: (select: boolean) => void;
}

export const DeviceStatusTable: React.FC<DeviceStatusTableProps> = ({ devices, selectedDeviceIds, onUpdateDevice, onRebootDevice, onDeviceSelect, onSelectAll }) => {
    const allSelected = devices.length > 0 && selectedDeviceIds.size === devices.length;

    return (
        <div className="bg-slate-900/70 rounded-lg overflow-hidden border border-slate-700 h-full flex flex-col">
            <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-semibold text-slate-200">Device Status</h3>
                <div className="flex items-center" title="Select or deselect all devices in the list">
                    <label htmlFor="selectAll" className="text-xs text-slate-400 mr-2 cursor-pointer">Select All</label>
                    <input 
                        type="checkbox" 
                        id="selectAll"
                        className="h-4 w-4 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-600 cursor-pointer"
                        checked={allSelected}
                        onChange={(e) => onSelectAll(e.target.checked)}
                        disabled={devices.length === 0}
                    />
                </div>
            </div>
            <div className="overflow-y-auto flex-grow p-3 space-y-3">
                {devices.map(device => {
                    // Developer note: card body intentionally gates details/actions by status
                    // to avoid presenting update buttons before scan metadata exists.
                    const needsUpdate = device.isBiosUpToDate === false || device.isDcuUpToDate === false || device.isWinUpToDate === false;
                    const showDetails = !['Pending', 'Waking Up'].includes(device.status);
                    const isSelected = selectedDeviceIds.has(device.id);

                    return (
                        <div key={device.id} className={`bg-slate-800/90 border rounded-lg p-3 transition-all duration-200 ${isSelected ? 'border-cyan-500 shadow-lg' : 'border-slate-700'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="checkbox" 
                                        className="h-4 w-4 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-600"
                                        checked={isSelected}
                                        onChange={() => onDeviceSelect(device.id)}
                                        aria-label={`Select device ${device.hostname}`}
                                    />
                                    {device.deviceType && <DeviceIcon type={device.deviceType} />}
                                    <h4 className="font-bold text-slate-100 break-all">{device.hostname}</h4>
                                </div>
                                <StatusBadge status={device.status} retryAttempt={device.retryAttempt} />
                            </div>
                            
                            {showDetails && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 mt-3 border-t border-slate-700 pt-3">
                                        <div>
                                            <h5 className="text-xs font-bold uppercase text-slate-500 mb-1">Version Info</h5>
                                            <ul className="text-slate-300 text-sm space-y-1">
                                                <DetailItem label="BIOS" value={device.biosVersion} />
                                                <DetailItem label="DCU" value={device.dcuVersion} />
                                                <DetailItem label="Windows" value={device.winVersion} />
                                            </ul>
                                        </div>
                                         <div>
                                            <h5 className="text-xs font-bold uppercase text-slate-500 mb-1">System Details</h5>
                                            <ul className="text-slate-300 text-sm space-y-1">
                                                <DetailItem label="IP Address" value={device.ipAddress} />
                                                <DetailItem label="Model" value={device.model} mono={false} />
                                                <DetailItem label="Serial" value={device.serialNumber} />
                                                <DetailItem label="RAM" value={device.ramAmount ? `${device.ramAmount} GB` : undefined} />
                                                <DetailItem label="Disk" value={device.diskSpace ? `${device.diskSpace.free}GB / ${device.diskSpace.total}GB` : undefined} />
                                                <DetailItem label="Encryption" value={<EncryptionStatus status={device.encryptionStatus} />} mono={false} />
                                            </ul>
                                        </div>
                                    </div>
                                    
                                    <UpdateResult result={device.lastUpdateResult} />

                                    <div className="mt-3">
                                        {needsUpdate && device.status === 'Scan Complete' && (
                                            <button 
                                                onClick={() => onUpdateDevice(device.id)}
                                                className="w-full px-4 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50"
                                                title="Install all required updates on this device."
                                            >
                                                Run Updates
                                            </button>
                                        )}
                                        {device.status === 'Update Complete (Reboot Pending)' && (
                                            <button
                                                onClick={() => onRebootDevice(device.id)}
                                                className="w-full px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50"
                                                title="Reboot this device to apply updates."
                                            >
                                                Reboot Device
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
                 {devices.length === 0 && (
                    <div className="text-center py-8 text-slate-500">No devices loaded</div>
                )}
            </div>
        </div>
    );
};