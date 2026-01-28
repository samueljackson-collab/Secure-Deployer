

import React from 'react';
import type { Device, DeploymentStatus } from '../types';
import { DeviceIcon } from './DeviceIcon';

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

const VersionDetail: React.FC<{ label: string; version?: string; isUpToDate?: boolean; }> = ({ label, version, isUpToDate }) => {
    if (typeof version === 'undefined') {
        return <li className="flex justify-between items-center text-slate-500"><span>{label}</span> <span>-</span></li>;
    }
    return (
        <li className="flex justify-between items-center">
            <span>{label}</span>
            <span className="font-mono text-sm">
                {version}
                {isUpToDate === true && <span className="ml-2 text-green-400" title="Up to date" aria-label="Up to date">✔</span>}
                {isUpToDate === false && <span className="ml-2 text-red-400" title="Out of date" aria-label="Out of date">❌</span>}
            </span>
        </li>
    );
};

interface DeviceStatusTableProps {
    devices: Device[];
    selectedDeviceIds: Set<number>;
    onUpdateDevice: (deviceId: number) => void;
    onDeviceSelect: (deviceId: number) => void;
    onSelectAll: (select: boolean) => void;
}

export const DeviceStatusTable: React.FC<DeviceStatusTableProps> = ({ devices, selectedDeviceIds, onUpdateDevice, onDeviceSelect, onSelectAll }) => {
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
                                    <ul className="text-slate-300 text-sm space-y-1 my-3 border-t border-slate-700 pt-3">
                                        <VersionDetail label="BIOS Version" version={device.biosVersion} isUpToDate={device.isBiosUpToDate} />
                                        <VersionDetail label="DCU Version" version={device.dcuVersion} isUpToDate={device.isDcuUpToDate} />
                                        <VersionDetail label="Windows Version" version={device.winVersion} isUpToDate={device.isWinUpToDate} />
                                    </ul>
                                    
                                    {needsUpdate && device.status === 'Scan Complete' && (
                                        <button 
                                            onClick={() => onUpdateDevice(device.id)}
                                            className="w-full mt-2 px-4 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50"
                                            title="Install all required updates on this device."
                                        >
                                            Run Updates
                                        </button>
                                    )}
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