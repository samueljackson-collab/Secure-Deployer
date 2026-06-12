import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { FileUp, X, FileText, PlayCircle, CheckCircle2, XCircle, Loader2, Server } from 'lucide-react';
import type { Device, Credentials } from '../types';
import { CredentialsForm } from './CredentialsForm';

interface BulkUpdateProps {
    devices: Device[];
}

interface CsvTarget {
    hostname: string;
    ipAddress?: string;
}

type ScriptKey = 'dcu' | 'windowsUpdate';

const SCRIPT_OPTIONS: { key: ScriptKey; label: string }[] = [
    { key: 'dcu', label: 'Dell Command | Update' },
    { key: 'windowsUpdate', label: 'Windows Update' },
];

type TargetStatus = 'pending' | 'connecting' | 'running' | 'success' | 'failed';

interface TargetState {
    target: CsvTarget;
    scripts: Record<ScriptKey, { status: TargetStatus; log?: string; error?: string | null }>;
}

const RELAY_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_BULK_UPDATE_RELAY_URL || 'http://localhost:4001';

export const BulkUpdate: React.FC<BulkUpdateProps> = ({ devices }) => {
    const [csvTargets, setCsvTargets] = useState<CsvTarget[]>([]);
    const [csvFileName, setCsvFileName] = useState<string | null>(null);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<number>>(new Set());
    const [selectedScripts, setSelectedScripts] = useState<Set<ScriptKey>>(new Set(['dcu', 'windowsUpdate']));
    const [credentials, setCredentials] = useState<Credentials>({ username: '', password: '' });
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState<TargetState[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCsvFileName(file.name);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const targets: CsvTarget[] = [];
                results.data.forEach((row: Record<string, string>) => {
                    const hostname = row.hostname || row.Hostname || row.host || row.Host || '';
                    const ipAddress = row.ip || row.IP || row.address || row.Address || row.ipAddress || '';
                    if (hostname || ipAddress) {
                        targets.push({ hostname: String(hostname).trim(), ipAddress: String(ipAddress).trim() || undefined });
                    } else {
                        const firstKey = Object.keys(row)[0];
                        if (firstKey && row[firstKey]) {
                            targets.push({ hostname: String(row[firstKey]).trim() });
                        }
                    }
                });
                setCsvTargets(targets);
            },
        });
    };

    const clearCsv = () => {
        setCsvTargets([]);
        setCsvFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const toggleDevice = (id: number) => {
        setSelectedDeviceIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleScript = (key: ScriptKey) => {
        setSelectedScripts((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const buildTargets = (): CsvTarget[] => {
        const fromDevices: CsvTarget[] = devices
            .filter((d) => selectedDeviceIds.has(d.id))
            .map((d) => ({ hostname: d.hostname, ipAddress: d.ipAddress }));
        return [...fromDevices, ...csvTargets];
    };

    const isFormValid = credentials.username.trim() !== '' && credentials.password.trim() !== '';

    const handleRun = async () => {
        const targets = buildTargets();
        if (targets.length === 0 || selectedScripts.size === 0 || !isFormValid) return;

        const initial: TargetState[] = targets.map((target) => ({
            target,
            scripts: Object.fromEntries(
                Array.from(selectedScripts).map((key) => [key, { status: 'pending' as TargetStatus }])
            ) as TargetState['scripts'],
        }));
        setProgress(initial);
        setRunning(true);

        try {
            const response = await fetch(`${RELAY_URL}/api/bulk-update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targets,
                    credentials: { username: credentials.username, password: credentials.password },
                    scripts: Array.from(selectedScripts),
                }),
            });

            if (!response.ok || !response.body) {
                throw new Error(`Relay returned ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const events = buffer.split('\n\n');
                buffer = events.pop() || '';

                for (const chunk of events) {
                    const lines = chunk.split('\n');
                    const eventLine = lines.find((l) => l.startsWith('event:'));
                    const dataLine = lines.find((l) => l.startsWith('data:'));
                    if (!eventLine || !dataLine) continue;

                    const event = eventLine.replace('event:', '').trim();
                    const data = JSON.parse(dataLine.replace('data:', '').trim());

                    if (event === 'status') {
                        setProgress((prev) =>
                            prev.map((t) => {
                                if (t.target.hostname !== data.target.hostname || t.target.ipAddress !== data.target.ipAddress) {
                                    return t;
                                }
                                if (!data.scriptKey) {
                                    return t;
                                }
                                return {
                                    ...t,
                                    scripts: {
                                        ...t.scripts,
                                        [data.scriptKey]: { status: data.status, log: data.log, error: data.error },
                                    },
                                };
                            })
                        );
                    }
                }
            }
        } catch (err) {
            // Surface a generic failure on every target if the relay is unreachable.
            setProgress((prev) =>
                prev.map((t) => ({
                    ...t,
                    scripts: Object.fromEntries(
                        Object.keys(t.scripts).map((key) => [
                            key,
                            { status: 'failed' as TargetStatus, error: `Relay unreachable: ${(err as Error).message}` },
                        ])
                    ) as TargetState['scripts'],
                }))
            );
        } finally {
            setRunning(false);
            setCredentials({ username: '', password: '' });
        }
    };

    const targetCount = buildTargets().length;

    const statusIcon = (status: TargetStatus) => {
        switch (status) {
            case 'success':
                return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
            case 'failed':
                return <XCircle className="w-4 h-4 text-red-400" />;
            case 'running':
            case 'connecting':
                return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
            default:
                return <div className="w-4 h-4 rounded-full border border-gray-600" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-950 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-800 bg-gray-900/30">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Server className="text-cyan-400 w-6 h-6" />
                    Bulk Device Update
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    Select devices, enter one-time credentials, and run Dell Command | Update and/or Windows Update across the fleet.
                </p>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-6">
                {/* Target selection */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">From Device List</h3>
                        <div className="max-h-64 overflow-y-auto border border-gray-800 rounded-xl divide-y divide-gray-800">
                            {devices.length === 0 && (
                                <p className="p-4 text-sm text-gray-500">No devices in the monitor list.</p>
                            )}
                            {devices.map((device) => (
                                <label
                                    key={device.id}
                                    className="flex items-center gap-3 p-3 hover:bg-gray-800/40 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedDeviceIds.has(device.id)}
                                        onChange={() => toggleDevice(device.id)}
                                        className="accent-cyan-500"
                                    />
                                    <div>
                                        <p className="text-sm font-bold text-gray-100">{device.hostname}</p>
                                        <p className="text-xs text-gray-500 font-mono">{device.ipAddress || 'No IP'}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">From CSV</h3>
                        <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvUpload} />
                        {!csvFileName ? (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 px-6 py-8 bg-gray-900/40 hover:bg-gray-800 border border-dashed border-gray-700 rounded-xl text-sm font-bold text-gray-300 transition-all"
                            >
                                <FileUp className="w-4 h-4 text-cyan-400" />
                                Upload CSV (hostname / ip columns)
                            </button>
                        ) : (
                            <div className="border border-gray-800 rounded-xl p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-cyan-400" />
                                        <span className="text-sm font-medium text-gray-200">{csvFileName}</span>
                                    </div>
                                    <button onClick={clearCsv} className="p-1 hover:bg-gray-800 rounded-full">
                                        <X className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500">{csvTargets.length} target(s) loaded</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Script selection */}
                <div>
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Scripts to Run</h3>
                    <div className="flex gap-3">
                        {SCRIPT_OPTIONS.map((opt) => (
                            <label
                                key={opt.key}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-colors ${
                                    selectedScripts.has(opt.key)
                                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedScripts.has(opt.key)}
                                    onChange={() => toggleScript(opt.key)}
                                    className="accent-cyan-500"
                                />
                                <span className="text-sm font-bold">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Credentials */}
                <div>
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">One-Time Credentials</h3>
                    <p className="text-xs text-gray-500 mb-3">
                        Used once to connect to all {targetCount} selected device(s) and never stored.
                    </p>
                    <div className="max-w-md">
                        <CredentialsForm credentials={credentials} setCredentials={setCredentials} />
                    </div>
                </div>

                <button
                    onClick={handleRun}
                    disabled={running || targetCount === 0 || selectedScripts.size === 0 || !isFormValid}
                    className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-cyan-900/20 active:scale-95"
                >
                    <PlayCircle className="w-4 h-4" />
                    {running ? 'Running...' : `Run on ${targetCount} Device(s)`}
                </button>

                {/* Progress table */}
                {progress.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Progress</h3>
                        <div className="border border-gray-800 rounded-xl divide-y divide-gray-800">
                            {progress.map((t, i) => (
                                <div key={i} className="p-4">
                                    <p className="text-sm font-bold text-gray-100 mb-2">
                                        {t.target.hostname || t.target.ipAddress}
                                        {t.target.ipAddress && t.target.hostname && (
                                            <span className="text-gray-500 font-mono text-xs ml-2">({t.target.ipAddress})</span>
                                        )}
                                    </p>
                                    <div className="space-y-1">
                                        {Object.entries(t.scripts).map(([key, s]) => (
                                            <div key={key} className="flex items-start gap-2 text-xs">
                                                {statusIcon(s.status)}
                                                <span className="text-gray-300 font-medium">
                                                    {SCRIPT_OPTIONS.find((o) => o.key === key)?.label}
                                                </span>
                                                <span className="text-gray-500 capitalize">{s.status}</span>
                                                {s.error && <span className="text-red-400 ml-2">{s.error}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
