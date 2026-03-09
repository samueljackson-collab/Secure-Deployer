
import React, { useState, useCallback } from 'react';
import type { Device, DeploymentStatus } from '../types';
import { DeviceIcon } from './DeviceIcon';
import { Tooltip, InfoIcon } from './Tooltip';
import { buildRemoteDesktopFile, RdpOptions } from '../services/deploymentService';
import { useAppContext } from '../contexts/AppContext';

// --- Constants ---

const MAX_SESSION_LOG = 10;

// --- Types ---

type ConnectionFilter = 'all' | 'online' | 'offline' | 'unknown';

interface SessionLogEntry {
    id: string;
    message: string;
    time: Date;
}

// --- Helpers ---

const ONLINE_STATUSES: DeploymentStatus[] = ['Success', 'Scan Complete', 'Action Complete', 'Update Complete (Reboot Pending)', 'Execution Complete'];
const OFFLINE_STATUSES: DeploymentStatus[] = ['Failed', 'Offline', 'Cancelled'];

function getConnectionCategory(status: DeploymentStatus): 'online' | 'offline' | 'unknown' {
    if (ONLINE_STATUSES.includes(status)) return 'online';
    if (OFFLINE_STATUSES.includes(status)) return 'offline';
    return 'unknown';
}

const statusDotClass: Record<'online' | 'offline' | 'unknown', string> = {
    online:  'bg-[#39FF14] shadow-[0_0_6px_#39FF14]',
    offline: 'bg-red-500',
    unknown: 'bg-yellow-400',
};

const statusLabel: Record<'online' | 'offline' | 'unknown', string> = {
    online:  'Online',
    offline: 'Offline',
    unknown: 'Unknown',
};

// --- Sub-components ---

const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button
            onClick={handleCopy}
            title={`Copy ${label || value}`}
            className="ml-2 px-2 py-0.5 text-xs rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-[#39FF14] hover:border-[#39FF14] transition-colors flex-shrink-0"
        >
            {copied ? 'Copied!' : 'Copy'}
        </button>
    );
};

const DetailRow: React.FC<{ label: string; value: string | undefined; copyable?: boolean }> = ({ label, value, copyable = true }) => {
    const display = value || '—';
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-b-0">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide w-28 flex-shrink-0">{label}</span>
            <div className="flex items-center flex-1 min-w-0">
                <span className="text-sm text-gray-200 font-mono truncate">{display}</span>
                {copyable && value && <CopyButton value={value} label={label} />}
            </div>
        </div>
    );
};

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; tooltip?: string; children: React.ReactNode }> = ({ title, icon, tooltip, children }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-800">
            <span className="text-[#39FF14]">{icon}</span>
            <h3 className="text-sm font-bold text-gray-200">{title}</h3>
            {tooltip && <InfoIcon tooltip={tooltip} />}
        </div>
        {children}
    </div>
);

// --- Icons ---

const MonitorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);
const TerminalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);
const WolIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);
const InfoCardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
);

// --- Main Component ---

interface RemoteConnectProps {
    devices: Device[];
}

export const RemoteConnect: React.FC<RemoteConnectProps> = ({ devices }) => {
    const { state, dispatch } = useAppContext();
    // Persisted remote settings from AppState so choices survive tab switches
    const { rdpResolution, rdpColorDepth, sshPort, sshUsernamename } = state.runner.settings;

    // Device list state
    const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
    const [filter, setFilter] = useState<ConnectionFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // RDP clipboard option — not persisted (session-level preference only)
    const [rdpClipboard, setRdpClipboard] = useState(true);

    // RDP download error state
    const [rdpError, setRdpError] = useState<string | null>(null);

    // Notes state (per device)
    const [notesMap, setNotesMap] = useState<Record<number, string>>({});

    // WoL feedback — tracks which device IDs have had a WoL packet sent this session
    const [wolSent, setWolSent] = useState<Set<number>>(new Set());

    // Session log
    const [sessionLog, setSessionLog] = useState<SessionLogEntry[]>([]);

    const addSessionLog = useCallback((message: string) => {
        setSessionLog(prev => [
            { id: crypto.randomUUID(), message, time: new Date() },
            ...prev,
        ].slice(0, MAX_SESSION_LOG));
    }, []);

    // Filtered + searched devices
    const filteredDevices = devices.filter(d => {
        const cat = getConnectionCategory(d.status);
        if (filter !== 'all' && cat !== filter) return false;
        const q = searchQuery.toLowerCase();
        if (q) {
            return d.hostname.toLowerCase().includes(q) || (d.ipAddress || '').toLowerCase().includes(q);
        }
        return true;
    });

    const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null;

    // RDP download — persisted settings used so resolution/depth survive tab switches
    const handleRdpDownload = () => {
        if (!selectedDevice) return;
        setRdpError(null);
        try {
            const content = buildRemoteDesktopFile(selectedDevice, {
                resolution: rdpResolution,
                colorDepth: rdpColorDepth,
                redirectClipboard: rdpClipboard,
            });
            const blob = new Blob([content], { type: 'application/rdp' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${selectedDevice.hostname}.rdp`;
            link.click();
            URL.revokeObjectURL(url);
            addSessionLog(`Downloaded RDP file for ${selectedDevice.hostname} (${rdpResolution})`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error generating RDP file.';
            setRdpError(message);
        }
    };

    // WoL
    const handleWol = () => {
        if (!selectedDevice) return;
        dispatch({ type: 'WAKE_ON_LAN', payload: new Set([selectedDevice.id]) });
        setWolSent(prev => new Set(prev).add(selectedDevice.id));
        addSessionLog(`Wake-on-LAN sent to ${selectedDevice.hostname} (MAC: ${selectedDevice.mac})`);
        setTimeout(() => {
            setWolSent(prev => {
                const next = new Set(prev);
                next.delete(selectedDevice.id);
                return next;
            });
        }, 3000);
    };

    const formatMac = (mac: string) =>
        mac.match(/.{1,2}/g)?.join(':').toUpperCase() || mac;

    return (
        <div className="flex flex-col gap-4">
            {/* Main layout: 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN: Device List */}
                <div className="lg:col-span-1 bg-gray-950 border border-gray-800 rounded-lg flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-800">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-bold text-[#39FF14]">
                                Devices
                                <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                                    {filteredDevices.length}
                                </span>
                            </h2>
                            <InfoIcon tooltip="Select a device to view its remote connection options." />
                        </div>
                        {/* Search */}
                        <input
                            type="text"
                            aria-label="Search devices by hostname or IP"
                            placeholder="Search hostname or IP..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] mb-3"
                        />
                        {/* Filter pills */}
                        <div className="flex gap-2">
                            {(['all', 'online', 'offline', 'unknown'] as ConnectionFilter[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize transition-colors ${
                                        filter === f
                                            ? 'bg-[#39FF14] text-black'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Device list */}
                    <div className="overflow-y-auto flex-1">
                        {devices.length === 0 ? (
                            <div className="p-6 text-center">
                                <div className="text-gray-600 mb-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-gray-500 font-semibold">No devices loaded.</p>
                                <p className="text-xs text-gray-600 mt-1">Transfer devices from the Deployment Runner tab to use Remote Connect.</p>
                            </div>
                        ) : filteredDevices.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-sm text-gray-500 font-semibold">No devices match the filter.</p>
                            </div>
                        ) : (
                            filteredDevices.map(device => {
                                const cat = getConnectionCategory(device.status);
                                const isSelected = device.id === selectedDeviceId;
                                return (
                                    <button
                                        key={device.id}
                                        onClick={() => setSelectedDeviceId(device.id)}
                                        className={`w-full text-left px-4 py-3 border-b border-gray-800 flex items-center gap-3 transition-colors hover:bg-gray-900 ${
                                            isSelected ? 'bg-gray-900 border-l-2 border-l-[#39FF14]' : ''
                                        }`}
                                    >
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotClass[cat]}`} title={statusLabel[cat]} />
                                        <div className="flex-shrink-0 text-gray-400">
                                            <DeviceIcon type={device.deviceType} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[#39FF14]' : 'text-gray-200'}`}>
                                                {device.hostname}
                                            </p>
                                            <p className="text-xs text-gray-500 font-mono truncate">
                                                {device.ipAddress || 'IP unknown'} · {device.status}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Connection Panel */}
                <div className="lg:col-span-2">
                    {!selectedDevice ? (
                        <div className="h-full min-h-64 bg-gray-950 border border-gray-800 rounded-lg flex flex-col items-center justify-center text-center p-8 gap-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                            </svg>
                            <p className="text-gray-500 font-semibold">Select a device to view connection options</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {/* Device header */}
                            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statusDotClass[getConnectionCategory(selectedDevice.status)]}`} />
                                <div className="text-gray-400 flex-shrink-0">
                                    <DeviceIcon type={selectedDevice.deviceType} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-[#39FF14]">{selectedDevice.hostname}</h2>
                                    <p className="text-xs text-gray-500">{selectedDevice.status} · {selectedDevice.model || 'Model unknown'}</p>
                                </div>
                            </div>

                            {/* Cards grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                {/* Card 1: Device Details */}
                                <SectionCard
                                    title="Device Details"
                                    icon={<InfoCardIcon />}
                                    tooltip="Hardware and identity information gathered during the last compliance scan."
                                >
                                    <DetailRow label="Hostname" value={selectedDevice.hostname} />
                                    <DetailRow label="IP Address" value={selectedDevice.ipAddress} />
                                    <DetailRow label="MAC Address" value={formatMac(selectedDevice.mac)} />
                                    <DetailRow label="Serial No." value={selectedDevice.serialNumber} />
                                    <DetailRow label="Model" value={selectedDevice.model} />
                                    <DetailRow label="Asset Tag" value={selectedDevice.assetTag} />
                                </SectionCard>

                                {/* Card 2: RDP */}
                                <SectionCard
                                    title="Remote Desktop (RDP)"
                                    icon={<MonitorIcon />}
                                    tooltip="Microsoft Remote Desktop Protocol. Downloads a .rdp config file that opens in mstsc.exe on Windows."
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <label className="text-xs text-gray-400">Resolution</label>
                                                <InfoIcon tooltip="Screen resolution for the RDP session. 'Full Screen' uses your display's native resolution." />
                                            </div>
                                            <select
                                                value={rdpResolution}
                                                onChange={e => dispatch({ type: 'SET_SETTINGS', payload: { rdpResolution: e.target.value as typeof rdpResolution } })}
                                                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-[#39FF14]"
                                            >
                                                <option value="1280x720">1280×720</option>
                                                <option value="1600x900">1600×900</option>
                                                <option value="1920x1080">1920×1080</option>
                                                <option value="fullscreen">Full Screen</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <label className="text-xs text-gray-400">Color Depth</label>
                                                <InfoIcon tooltip="32-bit gives better color accuracy. 16-bit uses less bandwidth over slow connections." />
                                            </div>
                                            <div className="flex gap-1">
                                                {([16, 32] as const).map(d => (
                                                    <button
                                                        key={d}
                                                        onClick={() => dispatch({ type: 'SET_SETTINGS', payload: { rdpColorDepth: d } })}
                                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${rdpColorDepth === d ? 'bg-[#39FF14] text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                                    >
                                                        {d}-bit
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <label htmlFor="rdp-clipboard" className="text-xs text-gray-400 cursor-pointer">Redirect Clipboard</label>
                                                <InfoIcon tooltip="Allow copy/paste between your machine and the remote session." />
                                            </div>
                                            <input
                                                id="rdp-clipboard"
                                                type="checkbox"
                                                checked={rdpClipboard}
                                                onChange={e => setRdpClipboard(e.target.checked)}
                                                className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-[#39FF14] cursor-pointer"
                                            />
                                        </div>
                                        <button
                                            onClick={handleRdpDownload}
                                            className="w-full mt-1 px-4 py-2 bg-[#39FF14] text-black text-sm font-bold rounded-lg hover:bg-[#2ECC10] transition-colors"
                                        >
                                            Download .rdp File
                                        </button>
                                        {rdpError && (
                                            <p className="text-xs text-red-400 mt-1 px-1" role="alert">
                                                Error: {rdpError}
                                            </p>
                                        )}
                                        <div className="flex items-center bg-black/30 rounded px-3 py-1.5 mt-1 border border-gray-800">
                                            <span className="text-xs text-gray-500 font-mono flex-1 truncate">
                                                mstsc /v:{selectedDevice.ipAddress || selectedDevice.hostname}
                                            </span>
                                            <CopyButton value={`mstsc /v:${selectedDevice.ipAddress || selectedDevice.hostname}`} label="RDP command" />
                                        </div>
                                    </div>
                                </SectionCard>

                                {/* Card 3: SSH / CLI */}
                                <SectionCard
                                    title="SSH / CLI"
                                    icon={<TerminalIcon />}
                                    tooltip="Secure Shell connection commands. Requires SSH to be enabled and listening on the target device."
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <label className="text-xs text-gray-400">SSH User</label>
                                                <InfoIcon tooltip="The username to authenticate with on the remote device." />
                                            </div>
                                            <input
                                                type="text"
                                                value={sshUsername}
                                                onChange={e => dispatch({ type: 'SET_SETTINGS', payload: { sshUsername: e.target.value } })}
                                                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 w-28 focus:outline-none focus:border-[#39FF14] font-mono"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <label className="text-xs text-gray-400">SSH Port</label>
                                                <InfoIcon tooltip="Default SSH port is 22. Change if the target uses a non-standard port." />
                                            </div>
                                            <input
                                                type="number"
                                                value={sshPort}
                                                onChange={e => dispatch({ type: 'SET_SETTINGS', payload: { sshPort: Math.min(65535, Math.max(1, parseInt(e.target.value, 10) || 22)) } })}
                                                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 w-20 text-center focus:outline-none focus:border-[#39FF14] font-mono"
                                            />
                                        </div>
                                        <div className="bg-black/30 rounded border border-gray-800 p-2">
                                            <p className="text-xs text-gray-500 mb-1 font-semibold">SSH Command</p>
                                            <div className="flex items-center">
                                                <span className="text-xs text-[#39FF14] font-mono flex-1 truncate">
                                                    ssh {sshUsername}@{selectedDevice.ipAddress || selectedDevice.hostname}{sshPort !== 22 ? ` -p ${sshPort}` : ''}
                                                </span>
                                                <CopyButton
                                                    value={`ssh ${sshUsername}@${selectedDevice.ipAddress || selectedDevice.hostname}${sshPort !== 22 ? ` -p ${sshPort}` : ''}`}
                                                    label="SSH command"
                                                />
                                            </div>
                                        </div>
                                        <div className="bg-black/30 rounded border border-gray-800 p-2">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <p className="text-xs text-gray-500 font-semibold">Ping Command</p>
                                                <InfoIcon tooltip="Sends 4 ICMP echo requests to verify basic network reachability." />
                                            </div>
                                            <div className="flex items-center">
                                                <span className="text-xs text-gray-400 font-mono flex-1 truncate">
                                                    ping -n 4 {selectedDevice.hostname}
                                                </span>
                                                <CopyButton value={`ping -n 4 ${selectedDevice.hostname}`} label="Ping command" />
                                            </div>
                                        </div>
                                    </div>
                                </SectionCard>

                                {/* Card 4: Wake-on-LAN */}
                                <SectionCard
                                    title="Wake-on-LAN"
                                    icon={<WolIcon />}
                                    tooltip="Sends a magic packet to the device's MAC address to power it on remotely. Requires WoL to be enabled in BIOS and the NIC to support it."
                                >
                                    <div className="space-y-3">
                                        <div className="bg-black/30 rounded border border-gray-800 p-2">
                                            <p className="text-xs text-gray-500 mb-1 font-semibold">Target MAC</p>
                                            <div className="flex items-center">
                                                <span className="text-xs text-[#39FF14] font-mono flex-1">{formatMac(selectedDevice.mac)}</span>
                                                <CopyButton value={formatMac(selectedDevice.mac)} label="MAC address" />
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            A magic packet (UDP broadcast) will be sent to the MAC address above on the configured WoL broadcast address and port.
                                        </p>
                                        <Tooltip
                                            content={wolSent.has(selectedDevice.id) ? 'Magic packet sent!' : 'Send WoL magic packet to this device.'}
                                            position="top"
                                        >
                                            <button
                                                onClick={handleWol}
                                                className={`w-full px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                                                    wolSent.has(selectedDevice.id)
                                                        ? 'bg-green-700 text-white cursor-default'
                                                        : 'bg-gray-700 text-white hover:bg-gray-600'
                                                }`}
                                            >
                                                {wolSent.has(selectedDevice.id) ? 'Packet Sent!' : 'Send WoL Packet'}
                                            </button>
                                        </Tooltip>
                                    </div>
                                </SectionCard>
                            </div>

                            {/* Technician Notes */}
                            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-sm font-bold text-gray-300">Technician Notes</h3>
                                    <InfoIcon tooltip="Notes are saved per device for this session only. They are not persisted after the page is refreshed." />
                                    <span className="text-xs text-gray-600 ml-auto">Session only · not persisted</span>
                                </div>
                                <textarea
                                    rows={3}
                                    placeholder={`Notes for ${selectedDevice.hostname}...`}
                                    value={notesMap[selectedDevice.id] || ''}
                                    onChange={e => setNotesMap(prev => ({ ...prev, [selectedDevice.id]: e.target.value }))}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] resize-none font-mono"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Session Activity Log */}
            {sessionLog.length > 0 && (
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-800">
                        <h3 className="text-sm font-bold text-gray-300">Session Activity</h3>
                        <InfoIcon tooltip="Actions performed in the Remote Connect tab during this session. Cleared on page refresh." />
                    </div>
                    <div className="space-y-1">
                        {sessionLog.map(entry => (
                            <div key={entry.id} className="flex items-center gap-3 text-xs">
                                <span className="text-gray-600 font-mono flex-shrink-0">{entry.time.toLocaleTimeString()}</span>
                                <span className="text-gray-400">{entry.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
