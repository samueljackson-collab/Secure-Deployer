

import React, { useState } from 'react';
import type { Device, DeploymentStatus, DeviceFormFactor } from '../types';
import { DeviceIcon, icons } from './DeviceIcon';
// FIX: Import target versions from App.tsx where they are now defined and exported.
import { TARGET_BIOS_VERSION, TARGET_DCU_VERSION, TARGET_WIN_VERSION } from '../App';

const statusColors: Record<DeploymentStatus, string> = {
    Pending: 'text-gray-400',
    'Waking Up': 'text-yellow-400 animate-pulse',
    Connecting: 'text-[#39FF14] animate-pulse',
    'Retrying...': 'text-[#39FF14] animate-pulse',
    Validating: 'text-cyan-400 animate-pulse',
    'Checking Info': 'text-[#39FF14] animate-pulse',
    'Checking BIOS': 'text-[#39FF14] animate-pulse',
    'Checking DCU': 'text-[#39FF14] animate-pulse',
    'Checking Windows': 'text-[#39FF14] animate-pulse',
    'Scan Complete': 'text-yellow-400',
    Updating: 'text-[#39FF14] animate-pulse',
    'Updating BIOS': 'text-[#39FF14] animate-pulse',
    'Updating DCU': 'text-[#39FF14] animate-pulse',
    'Updating Windows': 'text-[#39FF14] animate-pulse',
    'Update Complete (Reboot Pending)': 'text-purple-400',
    'Rebooting...': 'text-teal-400 animate-pulse',
    Success: 'text-[#39FF14]',
    Failed: 'text-red-400',
    Offline: 'text-orange-400',
    Cancelled: 'text-gray-500',
    'Pending File': 'text-blue-400',
    'Ready for Execution': 'text-yellow-400',
    'Executing Script': 'text-[#39FF14] animate-pulse',
    'Execution Complete': 'text-[#39FF14]',
    'Execution Failed': 'text-red-400',
    'Deploying Action': 'text-cyan-400 animate-pulse',
    'Action Complete': 'text-[#39FF14]',
    'Action Failed': 'text-red-400',
};

const StatusBadge: React.FC<{ status: DeploymentStatus; retryAttempt?: number }> = ({ status, retryAttempt }) => {
    const color = statusColors[status] || 'text-gray-400';
    const text = status === 'Retrying...' && retryAttempt ? `Retrying... (${retryAttempt})` : status;
    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full bg-gray-800 ${color}`}>
            {text}
        </span>
    );
};

const ComplianceChecklistItem: React.FC<{
    name: string;
    passed: boolean | undefined;
    details: string;
    hoverText: string;
}> = ({ name, passed, details, hoverText }) => {
    const icon = passed ? (
        <span className="text-xl text-[#39FF14]">✅</span>
    ) : (
        <div className="relative group">
            <span className="text-xl text-red-400 cursor-help">❌</span>
            <div className="absolute bottom-full mb-2 w-max max-w-xs bg-black border border-gray-700 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10 -translate-x-1/2 left-1/2">
                {hoverText}
                <div className="w-2 h-2 bg-black border-r border-b border-gray-700 absolute left-1/2 transform -translate-x-1/2 rotate-45 -bottom-1"></div>
            </div>
        </div>
    );

    return (
         <li className="flex justify-between items-center py-1 border-b border-gray-800/50">
            <span className="flex items-center gap-2">
                {passed === undefined ? <span className="text-xl text-gray-600">⚪</span> : icon}
                <span className="text-sm text-gray-300">{name}</span>
            </span>
            <span className={`font-mono text-sm ${passed ? 'text-gray-400' : 'text-red-400'}`}>{details}</span>
        </li>
    );
};

const MetadataItem: React.FC<{ label: string; value: string | undefined }> = ({ label, value }) => (
    <li className="flex justify-between items-center py-1 border-b border-gray-800/50">
        <span className="text-sm text-gray-400 font-bold">{label}</span>
        <span className="font-mono text-sm text-gray-200">{value || '-'}</span>
    </li>
);

const UpdateResult: React.FC<{ result: Device['lastUpdateResult'] }> = ({ result }) => {
    if (!result || (result.succeeded.length === 0 && result.failed.length === 0)) {
        return null;
    }

    return (
        <div className="text-xs text-gray-400 mt-2 space-y-1 border-t border-gray-700 pt-2">
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
    onValidateDevice: (deviceId: number) => void;
    onSetScriptFile: (deviceId: number, file: File) => void;
    onExecuteScript: (deviceId: number) => void;
    onRemoteIn: (deviceId: number) => void;
    onDeviceSelect: (deviceId: number) => void;
    onSelectAll: (select: boolean) => void;
}

export const DeviceStatusTable: React.FC<DeviceStatusTableProps> = ({ devices, selectedDeviceIds, onUpdateDevice, onRebootDevice, onValidateDevice, onSetScriptFile, onExecuteScript, onRemoteIn, onDeviceSelect, onSelectAll }) => {
    const [showLegend, setShowLegend] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; deviceId: number } | null>(null);
    const allSelected = devices.length > 0 && selectedDeviceIds.size === devices.length;
    const isScanActionable = (status: DeploymentStatus) => ['Success', 'Failed', 'Offline', 'Cancelled', 'Scan Complete'].includes(status);
    const isRunningAction = (status: DeploymentStatus) => !isScanActionable(status) && !['Pending', 'Update Complete (Reboot Pending)', 'Pending File', 'Ready for Execution', 'Execution Complete', 'Execution Failed'].includes(status);

    const handleFileChange = (deviceId: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onSetScriptFile(deviceId, e.target.files[0]);
        }
    };

    return (
        <div className="bg-black/50 rounded-lg overflow-hidden border border-gray-800 h-full flex flex-col relative" onClick={() => setContextMenu(null)}>
            <div className="p-3 bg-black/25 border-b border-gray-800 flex justify-between items-center">
                <h3 className="font-semibold text-gray-200">Device Status</h3>
                <div className="flex items-center" title="Select or deselect all devices in the list">
                    <label htmlFor="selectAll" className="text-xs text-gray-400 mr-2 cursor-pointer font-bold">Select All</label>
                    <input 
                        type="checkbox" 
                        id="selectAll"
                        className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-[#39FF14] cursor-pointer"
                        checked={allSelected}
                        onChange={(e) => onSelectAll(e.target.checked)}
                        disabled={devices.length === 0}
                    />
                </div>
            </div>
            <div className="overflow-y-auto flex-grow p-3 space-y-3">
                {devices.map(device => {
                    const needsUpdate = Object.values(device.updatesNeeded || {}).some(needed => needed);
                    const showScanDetails = !['Pending', 'Waking Up'].includes(device.status);
                    const showDeploymentDetails = ['Pending File', 'Ready for Execution', 'Executing Script', 'Execution Complete', 'Execution Failed'].includes(device.status);
                    const isSelected = selectedDeviceIds.has(device.id);

                    return (
                        <div
                            key={device.id}
                            className={`bg-black/50 border rounded-lg p-3 transition-all duration-200 ${isSelected ? 'border-[#39FF14] shadow-lg' : 'border-gray-800'}`}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY, deviceId: device.id });
                            }}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="checkbox" 
                                        className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-[#39FF14]"
                                        checked={isSelected}
                                        onChange={() => onDeviceSelect(device.id)}
                                        aria-label={`Select device ${device.hostname}`}
                                    />
                                    <DeviceIcon type={device.deviceType} />
                                    <h4 className="font-bold text-gray-100 break-all">{device.hostname}</h4>
                                </div>
                                <StatusBadge status={device.status} retryAttempt={device.retryAttempt} />
                            </div>
                            
                            {(showScanDetails && !showDeploymentDetails) && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-3 border-t border-gray-700 pt-3">
                                        <div>
                                            <h5 className="text-xs font-bold uppercase text-gray-500 mb-1">System Details</h5>
                                            <ul className="space-y-1">
                                                <MetadataItem label="Model" value={device.model} />
                                                <MetadataItem label="Serial #" value={device.serialNumber} />
                                                <MetadataItem label="Asset Tag" value={device.assetTag} />
                                            </ul>
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-bold uppercase text-gray-500 mb-1">Compliance Checklist</h5>
                                            <ul className="space-y-1">
                                                <ComplianceChecklistItem name="BIOS" passed={device.isBiosUpToDate} details={device.biosVersion || '-'} hoverText={`Expected: ${TARGET_BIOS_VERSION}, Found: ${device.biosVersion}`} />
                                                <ComplianceChecklistItem name="DCU" passed={device.isDcuUpToDate} details={device.dcuVersion || '-'} hoverText={`Expected: ${TARGET_DCU_VERSION}, Found: ${device.dcuVersion}`} />
                                                <ComplianceChecklistItem name="Windows" passed={device.isWinUpToDate} details={device.winVersion || '-'} hoverText={`Expected: ${TARGET_WIN_VERSION}, Found: ${device.winVersion}`} />
                                                <ComplianceChecklistItem name="Encryption" passed={device.encryptionStatus === 'Enabled'} details={device.encryptionStatus || '-'} hoverText="BitLocker must be enabled." />
                                                <ComplianceChecklistItem name="CrowdStrike" passed={device.crowdstrikeStatus === 'Running'} details={device.crowdstrikeStatus || '-'} hoverText="Agent must be running." />
                                                <ComplianceChecklistItem name="SCCM Client" passed={device.sccmStatus === 'Healthy'} details={device.sccmStatus || '-'} hoverText="Client must be healthy." />
                                            </ul>
                                        </div>
                                    </div>
                                    
                                    <UpdateResult result={device.lastUpdateResult} />

                                    <div className="mt-3 flex gap-2">
                                        {needsUpdate && device.status === 'Scan Complete' && (
                                            <button 
                                                onClick={() => onUpdateDevice(device.id)}
                                                className="w-full px-4 py-2 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#2ECC10] transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-[#39FF14] focus:ring-opacity-50"
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
                                        {isScanActionable(device.status) && (
                                            <button
                                                onClick={() => onValidateDevice(device.id)}
                                                disabled={isRunningAction(device.status)}
                                                className="w-full px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-lg hover:bg-gray-500 transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 disabled:bg-gray-800 disabled:cursor-not-allowed"
                                                title="Re-run the compliance scan on this device."
                                            >
                                                Re-run Checks
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                            
                            {showDeploymentDetails && (
                                <div className="mt-3 border-t border-gray-700 pt-3">
                                    <h5 className="text-xs font-bold uppercase text-gray-500 mb-2">Post-Imaging Deployment</h5>
                                    <div className="flex flex-col gap-2">
                                        {device.status === 'Pending File' && (
                                            <label className="w-full text-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-500 transition duration-200 cursor-pointer">
                                                Select Script...
                                                <input type="file" className="hidden" onChange={handleFileChange(device.id)} />
                                            </label>
                                        )}
                                        {device.status === 'Ready for Execution' && (
                                            <>
                                                <p className="text-sm text-gray-300 truncate">File: <span className="font-bold text-gray-100">{device.scriptFile?.name}</span></p>
                                                <button
                                                    onClick={() => onExecuteScript(device.id)}
                                                    className="w-full px-4 py-2 bg-yellow-500 text-black text-sm font-semibold rounded-lg hover:bg-yellow-400 transition duration-200 shadow-md"
                                                >
                                                    Execute
                                                </button>
                                            </>
                                        )}
                                        {device.status === 'Executing Script' && (
                                            <p className="text-sm text-center text-[#39FF14] font-bold animate-pulse">Running script...</p>
                                        )}
                                         {device.status === 'Execution Complete' && (
                                            <p className="text-sm text-center text-[#39FF14] font-bold">Deployment successful.</p>
                                        )}
                                        {device.status === 'Execution Failed' && (
                                            <p className="text-sm text-center text-red-400 font-bold">Deployment failed.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                 {devices.length === 0 && (
                    <div className="text-center py-8 text-gray-500 font-bold">No devices loaded</div>
                )}
            </div>
            <div className="p-3 border-t border-gray-800 bg-black/25">
                <button
                    onClick={() => setShowLegend(!showLegend)}
                    className="w-full text-left text-xs font-bold text-gray-400 hover:text-white flex justify-between items-center transition-colors"
                    aria-expanded={showLegend}
                >
                    <span>ICON LEGEND</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform ${showLegend ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
                {showLegend && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                        {Object.entries(icons).map(([key, iconData]) => (
                            <div key={key} className="flex items-center gap-2 p-1 rounded bg-gray-900/50">
                                <DeviceIcon type={key as DeviceFormFactor} />
                                <span className="text-gray-300">{iconData.title}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {contextMenu && (
                <div
                    className="fixed z-50 bg-gray-900 border border-gray-700 rounded-md shadow-lg min-w-[150px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button
                        className="w-full text-left px-3 py-2 text-sm text-gray-100 hover:bg-gray-800"
                        onClick={() => {
                            onRemoteIn(contextMenu.deviceId);
                            setContextMenu(null);
                        }}
                    >
                        Remote-In
                    </button>
                </div>
            )}
        </div>
    );
};
