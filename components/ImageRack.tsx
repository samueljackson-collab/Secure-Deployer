

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ImagingDevice, ImagingStatus, ComplianceResult } from '../types';
import { DeviceIcon } from './DeviceIcon';
// FIX: Import detectDeviceType from its new centralized location in utils/helpers.
import { detectDeviceType } from '../utils/helpers';

const statusColors: Record<ImagingStatus, { text: string; bg: string; }> = {
    Imaging: { text: 'text-[#39FF14]', bg: 'bg-[#39FF14]' },
    Completed: { text: 'text-gray-300', bg: 'bg-gray-500' },
    Failed: { text: 'text-red-400', bg: 'bg-red-500' },
    'Checking Compliance': { text: 'text-cyan-400', bg: 'bg-cyan-400' },
};

const ComplianceStatusIcon: React.FC<{
    result: ComplianceResult;
    onShowDetails: () => void;
    onRevalidate: () => void;
}> = ({ result, onShowDetails, onRevalidate }) => {
    const statusIcon = result.status === 'Passed'
        ? <span title="Compliance Check Passed" className="text-xl">✅</span>
        : <span title="Compliance Check Failed" className="text-xl">❌</span>;

    const failedItems = result.details.filter(d => !d.passed).map(d => d.description);
    const tooltipText = result.status === 'Passed' ? 'All checks passed.' : `Failed Checks: ${failedItems.join(', ')}`;

    return (
        <div className="flex items-center gap-1">
            <div className="relative group">
                <button
                    onClick={(e) => { e.stopPropagation(); onShowDetails(); }}
                    aria-label="Compliance Check Status. Click to see details."
                >
                    {statusIcon}
                </button>
                <div className="absolute bottom-full mb-2 w-max max-w-xs bg-black border border-gray-700 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10 -translate-x-1/2 left-1/2">
                    {tooltipText}
                     <div className="w-2 h-2 bg-black border-r border-b border-gray-700 absolute left-1/2 transform -translate-x-1/2 rotate-45 -bottom-1"></div>
                </div>
            </div>
             <button 
                onClick={(e) => { e.stopPropagation(); onRevalidate(); }}
                className="text-gray-500 hover:text-[#39FF14] transition-colors"
                title="Re-run compliance check"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 10M20 20l-1.5-1.5A9 9 0 013.5 14" />
                </svg>
            </button>
        </div>
    );
};

const DetailItemWithCopy: React.FC<{ label: string; value: string; isMono?: boolean }> = ({ label, value, isMono = true }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card from expanding/collapsing
        if (!value) return;
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <li 
            className="flex justify-between items-center group rounded-md -mx-1 px-1 py-0.5 hover:bg-gray-800/50 cursor-pointer"
            onClick={handleCopy}
            title={`Click to copy ${label}`}
        >
            <span className="font-sans font-semibold text-gray-500">{label}:</span>
            <div className="flex items-center gap-2 text-left">
                <span className={`${isMono ? 'font-mono' : 'font-sans'} text-gray-300 group-hover:text-[#39FF14] transition-colors truncate max-w-[120px]`}>{value}</span>
                <div className="w-14 text-right">
                    {copied ? (
                        <span className="text-xs font-bold text-[#39FF14]">Copied!</span>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block text-gray-600 group-hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    )}
                </div>
            </div>
        </li>
    );
};

const DeviceCard: React.FC<{ 
    device: ImagingDevice; 
    isExpanded: boolean; 
    isSelected: boolean;
    onToggleExpand: () => void;
    onSelect: () => void;
    onTransfer: () => void;
    onRename: (newHostname: string) => void;
    onRemove: () => void;
    onShowComplianceDetails: (result: ComplianceResult) => void;
    onRevalidateDevice: () => void;
}> = ({ device, isExpanded, isSelected, onToggleExpand, onSelect, onTransfer, onRename, onRemove, onShowComplianceDetails, onRevalidateDevice }) => {
    const { text, bg } = statusColors[device.status];
    const [isEditing, setIsEditing] = useState(false);
    const [hostname, setHostname] = useState(device.hostname);
    const inputRef = useRef<HTMLInputElement>(null);
    const [currentProgress, setCurrentProgress] = useState(device.progress);

    useEffect(() => {
        if (device.status === 'Imaging') {
            const calculateProgress = () => {
                const elapsed = Date.now() - device.startTime;
                const totalDuration = device.duration * 1000;
                if (totalDuration <= 0) return 100;
                const progress = Math.min(100, (elapsed / totalDuration) * 100);
                return progress;
            };

            setCurrentProgress(calculateProgress()); // Initial calculation

            const interval = setInterval(() => {
                const progress = calculateProgress();
                setCurrentProgress(progress);
                if (progress >= 100) {
                    clearInterval(interval);
                }
            }, 1000); // Update every second

            return () => clearInterval(interval);
        } else {
            // When status is not imaging, just use the device's progress value
            setCurrentProgress(device.progress);
        }
    }, [device.status, device.startTime, device.duration, device.progress]);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleRename = () => {
        if (hostname.trim() && hostname.trim() !== device.hostname) {
            onRename(hostname.trim());
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleRename();
        } else if (e.key === 'Escape') {
            setHostname(device.hostname);
            setIsEditing(false);
        }
    };

    return (
        <div
            className={`bg-black/50 border rounded-lg p-1 w-full text-left flex flex-col justify-between transition-all duration-300 hover:border-[#39FF14] ${isExpanded ? 'min-h-[280px]' : 'min-h-[96px]'} ${isSelected ? 'border-[#39FF14] shadow-lg' : 'border-gray-800'}`}
        >
            <div>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                         <input 
                            type="checkbox" 
                            className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-[#39FF14] flex-shrink-0"
                            checked={isSelected}
                            onChange={onSelect}
                            aria-label={`Select device ${device.hostname}`}
                        />
                        <button onClick={onToggleExpand} className="font-bold text-lg text-gray-200">{device.slot}</button>
                    </div>
                     <div className="flex items-center gap-2">
                        {device.status === 'Completed' && device.complianceCheck && (
                            <ComplianceStatusIcon 
                                result={device.complianceCheck} 
                                onShowDetails={() => onShowComplianceDetails(device.complianceCheck!)} 
                                onRevalidate={onRevalidateDevice}
                            />
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full bg-gray-800 ${text}`}>
                            {device.status}
                        </span>
                    </div>
                </div>
                <div className="w-full text-left">
                    <div className="flex items-center gap-2 mt-2">
                        <DeviceIcon type={detectDeviceType(device.hostname)} />
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={hostname}
                                onChange={(e) => setHostname(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm"
                            />
                        ) : (
                             <h3 className="font-bold text-base text-gray-100 truncate" onClick={onToggleExpand} >{device.hostname}</h3>
                        )}
                    </div>
                    {isExpanded && (
                        <>
                            <ul className="text-gray-400 text-xs space-y-1 mt-3">
                                <DetailItemWithCopy label="Model" value={device.model} isMono={false} />
                                <DetailItemWithCopy label="Serial" value={device.serialNumber} />
                                <DetailItemWithCopy label="MAC" value={device.macAddress} />
                                <DetailItemWithCopy label="IP" value={device.ipAddress} />
                                <DetailItemWithCopy label="Tech" value={device.tech} isMono={false} />
                            </ul>
                             <div className="mt-3 border-t border-gray-700 pt-3 space-y-2">
                                {device.status === 'Completed' ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onTransfer(); }}
                                        className="w-full px-4 py-2 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#2ECC10] transition duration-200 shadow-md"
                                    >
                                        Transfer to Runner
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                         <button onClick={() => setIsEditing(true)} className="w-full px-3 py-1.5 bg-gray-600 text-white text-xs font-semibold rounded-md hover:bg-gray-500 transition duration-200 shadow-md">
                                            Edit
                                        </button>
                                         <button onClick={onRemove} className="w-full px-3 py-1.5 bg-red-800 text-white text-xs font-semibold rounded-md hover:bg-red-700 transition duration-200 shadow-md">
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <div className="mt-2">
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div className={`${bg} h-2.5 rounded-full transition-all duration-500 ease-linear`} style={{ width: `${currentProgress}%` }}></div>
                </div>
            </div>
        </div>
    );
};

const EmptySlotCard: React.FC<{ slotId: string }> = ({ slotId }) => (
    <div className="bg-gray-950/50 border-2 border-dashed border-gray-800 rounded-lg flex flex-col items-center justify-center h-full min-h-[96px] transition-colors duration-300">
        <div className="text-gray-700 font-bold text-2xl">{slotId}</div>
        <div className="text-gray-600 text-xs font-bold uppercase mt-1">Empty</div>
    </div>
);

interface ImageRackProps {
    devices: ImagingDevice[];
    selectedDeviceIds: Set<string>;
    onSelectDevice: (deviceId: string) => void;
    onSelectAll: (select: boolean) => void;
    onTransferDevice: (deviceId: string) => void;
    onRenameDevice: (deviceId: string, newHostname: string) => void;
    onRemoveDevice: (deviceId: string) => void;
    onShowComplianceDetails: (result: ComplianceResult) => void;
    onRevalidateDevice: (deviceId: string) => void;
}

export const ImageRack: React.FC<ImageRackProps> = ({ devices, selectedDeviceIds, onSelectDevice, onSelectAll, onTransferDevice, onRenameDevice, onRemoveDevice, onShowComplianceDetails, onRevalidateDevice }) => {
    const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());
    const discoveredSlotsRef = useRef<Set<string>>(new Set());
    
    const deviceMap = useMemo(() => {
        const map = new Map<string, ImagingDevice>();
        devices.forEach(device => {
            map.set(device.slot, device);
        });
        return map;
    }, [devices]);

    const maxRack = useMemo(() => {
        const highestRack = devices.reduce((max, device) => {
            const rackNum = parseInt(device.slot.split('-')[0], 10);
            return isNaN(rackNum) ? max : Math.max(max, rackNum);
        }, 0);
        return Math.max(2, highestRack); // Always show at least 2 racks.
    }, [devices]);

    const slots = useMemo(() => {
        const TOTAL_RACK_SLOTS = maxRack * 16;
        return Array.from({ length: TOTAL_RACK_SLOTS }, (_, i) => {
            const rack = Math.floor(i / 16) + 1;
            const pos = (i % 16) + 1;
            return `${rack}-${pos}`;
        });
    }, [maxRack]);


    useEffect(() => {
        const currentDeviceSlots = new Set(devices.map(d => d.slot));
        const newDevices = new Set<string>();
        currentDeviceSlots.forEach((slot: string) => {
            if (!discoveredSlotsRef.current.has(slot)) {
                newDevices.add(slot);
            }
        });

        if (newDevices.size > 0) {
            setExpandedSlots(prev => new Set([...prev, ...newDevices]));
            discoveredSlotsRef.current = new Set([...discoveredSlotsRef.current, ...newDevices]);
        }
    }, [devices]);

    const handleToggleExpand = (slotId: string) => {
        setExpandedSlots(prev => {
            const newSet = new Set(prev);
            if (newSet.has(slotId)) {
                newSet.delete(slotId);
            } else {
                newSet.add(slotId);
            }
            return newSet;
        });
    };

    const gridClasses = "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-px items-start";
    const allSelected = devices.length > 0 && selectedDeviceIds.size === devices.length;

    if (devices.length === 0 && expandedSlots.size === 0 && discoveredSlotsRef.current.size === 0) {
        return (
            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 text-center">
                <h3 className="text-lg font-bold text-gray-400">Awaiting Devices...</h3>
                <p className="text-sm text-gray-500">No imaging processes have been detected. The rack will populate as devices come online.</p>
                <div className={`${gridClasses} mt-4`}>
                    {slots.map(slotId => <EmptySlotCard key={slotId} slotId={slotId} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg border border-gray-800">
             <div className="p-2 mb-4 bg-black/25 border-b border-gray-800 flex justify-between items-center">
                <h3 className="font-semibold text-gray-200">Image Rack</h3>
                <div className="flex items-center" title="Select or deselect all devices in the list">
                    <label htmlFor="selectAllImaging" className="text-xs text-gray-400 mr-2 cursor-pointer font-bold">Select All</label>
                    <input 
                        type="checkbox" 
                        id="selectAllImaging"
                        className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-[#39FF14] cursor-pointer"
                        checked={allSelected}
                        onChange={(e) => onSelectAll(e.target.checked)}
                        disabled={devices.length === 0}
                    />
                </div>
            </div>
            <div className={gridClasses}>
                {slots.map(slotId => {
                    const device = deviceMap.get(slotId);
                    if (device) {
                        const isExpanded = expandedSlots.has(slotId);
                        const isSelected = selectedDeviceIds.has(device.id);
                        return (
                             <DeviceCard 
                                key={slotId} 
                                device={device} 
                                isExpanded={isExpanded}
                                isSelected={isSelected}
                                onToggleExpand={() => handleToggleExpand(slotId)}
                                onSelect={() => onSelectDevice(device.id)}
                                onTransfer={() => onTransferDevice(device.id)}
                                onRename={(newHostname) => onRenameDevice(device.id, newHostname)}
                                onRemove={() => onRemoveDevice(device.id)}
                                onShowComplianceDetails={onShowComplianceDetails}
                                onRevalidateDevice={() => onRevalidateDevice(device.id)}
                            />
                        );
                    }
                    return <EmptySlotCard key={slotId} slotId={slotId} />;
                })}
            </div>
        </div>
    );
};
