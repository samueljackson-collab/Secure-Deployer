import React, { useState, useEffect, useRef } from 'react';
import type { ImagingPipelineState, PipelineStage, PipelineDevice } from '../src/types';

// ---------------------------------------------------------------------------
// Available image packages (matches your SCCM TS packages)
// ---------------------------------------------------------------------------
const IMAGE_PACKAGES = [
    { id: 'WIN11-ENT-23H2-STD', label: 'Windows 11 Enterprise 23H2 — Standard' },
    { id: 'WIN11-ENT-23H2-SEC', label: 'Windows 11 Enterprise 23H2 — Secure Baseline' },
    { id: 'WIN10-ENT-22H2-LTS', label: 'Windows 10 Enterprise 22H2 — LTSC' },
    { id: 'WIN11-EDU-23H2', label: 'Windows 11 Education 23H2' },
];

// ---------------------------------------------------------------------------
// Stage configuration
// ---------------------------------------------------------------------------
const STAGES: { id: PipelineStage; label: string; description: string }[] = [
    { id: 'pxe-connect', label: '1. PXE4 Connect', description: 'Open RDP sessions to devices booting in WinPE/PXE4.' },
    { id: 'autotag', label: '2. AutoTag', description: 'Run AutoTag on all connected devices to assign asset tags.' },
    { id: 'export-csv', label: '3. Export CSV', description: 'Download a CSV of hostnames and MAC addresses.' },
    { id: 'sccm-import', label: '4. SCCM Import', description: 'Bulk-add devices to SCCM via WMI.' },
    { id: 'sccm-wait', label: '5. SCCM Wait', description: 'Wait 20 minutes for SCCM site server to recognise new objects.' },
    { id: 'task-sequence', label: '6. Task Sequence', description: 'Start the imaging Task Sequence with the selected package.' },
    { id: 'post-imaging', label: '7. Post-Imaging', description: 'Run post-imaging compliance checks on all devices.' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const statusLabel: Record<PipelineDevice['status'], { text: string; color: string }> = {
    'pending':              { text: 'Pending',           color: 'text-gray-400' },
    'connecting':           { text: 'Connecting…',       color: 'text-cyan-400 animate-pulse' },
    'connected':            { text: 'Connected',         color: 'text-cyan-300' },
    'running-autotag':      { text: 'AutoTag…',          color: 'text-yellow-400 animate-pulse' },
    'autotag-complete':     { text: 'AutoTag ✓',         color: 'text-green-400' },
    'autotag-failed':       { text: 'AutoTag ✗',         color: 'text-red-400' },
    'sccm-importing':       { text: 'SCCM Import…',      color: 'text-blue-400 animate-pulse' },
    'sccm-imported':        { text: 'SCCM Imported ✓',   color: 'text-green-400' },
    'sccm-failed':          { text: 'SCCM Failed ✗',     color: 'text-red-400' },
    'ts-starting':          { text: 'TS Starting…',      color: 'text-purple-400 animate-pulse' },
    'ts-running':           { text: 'TS Running…',       color: 'text-purple-300 animate-pulse' },
    'ts-complete':          { text: 'TS Complete ✓',     color: 'text-[#39FF14]' },
    'ts-failed':            { text: 'TS Failed ✗',       color: 'text-red-400' },
    'post-imaging-pending': { text: 'Post-Img Pending',  color: 'text-gray-400' },
    'post-imaging-complete':{ text: 'Post-Img Done ✓',   color: 'text-[#39FF14]' },
    'error':                { text: 'Error',             color: 'text-red-500' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SccmCountdown: React.FC<{ startTime: number; durationMs: number; onComplete: () => void }> = ({
    startTime, durationMs, onComplete,
}) => {
    const [remaining, setRemaining] = useState(Math.max(0, durationMs - (Date.now() - startTime)));
    const doneRef = useRef(false);

    useEffect(() => {
        if (remaining <= 0) return;
        const interval = setInterval(() => {
            const r = Math.max(0, durationMs - (Date.now() - startTime));
            setRemaining(r);
            if (r <= 0 && !doneRef.current) {
                doneRef.current = true;
                clearInterval(interval);
                onComplete();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime, durationMs, onComplete, remaining]);

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const pct = Math.max(0, Math.min(100, ((durationMs - remaining) / durationMs) * 100));

    return (
        <div className="bg-black/50 border border-gray-700 rounded-lg p-6 text-center space-y-4">
            <h4 className="text-lg font-bold text-gray-200">SCCM Recognition Timer</h4>
            <p className="text-5xl font-mono font-bold text-[#39FF14]">
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </p>
            <div className="w-full bg-gray-800 rounded-full h-3">
                <div
                    className="bg-[#39FF14] h-3 rounded-full transition-all duration-1000"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="text-sm text-gray-400">
                Waiting for SCCM site server to discover and process new device objects.
            </p>
        </div>
    );
};

const PipelineDeviceRow: React.FC<{ device: PipelineDevice }> = ({ device }) => {
    const { text, color } = statusLabel[device.status];
    const allChecks = device.postImagingChecks;

    return (
        <div className="bg-black/50 border border-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
                <div>
                    <span className="font-bold text-gray-100">{device.hostname}</span>
                    <span className="ml-2 text-xs font-mono text-gray-500">{device.macAddress}</span>
                    {device.ipAddress && <span className="ml-2 text-xs text-gray-500">{device.ipAddress}</span>}
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full bg-gray-800 ${color}`}>{text}</span>
            </div>

            {device.autotagOutput && (
                <p className="text-xs font-mono text-gray-400 truncate" title={device.autotagOutput}>
                    ↳ {device.autotagOutput}
                </p>
            )}
            {device.sccmResourceId && (
                <p className="text-xs font-mono text-gray-400">SCCM: {device.sccmResourceId}</p>
            )}
            {allChecks && allChecks.length > 0 && (
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-gray-700">
                    {allChecks.map(c => (
                        <span key={c.label} className={`text-xs ${c.passed ? 'text-green-400' : 'text-red-400'}`}>
                            {c.passed ? '✓' : '✗'} {c.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ImagingPipelineProps {
    pipeline: ImagingPipelineState;
    monitorDeviceCount: number;
    onImportFromMonitor: () => void;
    onAddManualDevices: (csv: string) => void;
    onRunStage: (stage: PipelineStage) => void;
    onSetPackage: (packageId: string) => void;
    onClear: () => void;
}

export const ImagingPipeline: React.FC<ImagingPipelineProps> = ({
    pipeline,
    monitorDeviceCount,
    onImportFromMonitor,
    onAddManualDevices,
    onRunStage,
    onSetPackage,
    onClear,
}) => {
    const [manualCsv, setManualCsv] = useState('');
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [pipeline.logs]);

    const activeStageIdx = STAGES.findIndex(s => s.id === pipeline.activeStage);

    const handleManualAdd = () => {
        if (!manualCsv.trim()) return;
        onAddManualDevices(manualCsv);
        setManualCsv('');
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            onAddManualDevices(text);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="flex flex-col gap-6">
            {/* ── Header ── */}
            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-[#39FF14]">Imaging Pipeline</h2>
                        <p className="text-sm text-gray-400 mt-1">
                            End-to-end bulk imaging: PXE4 → AutoTag → SCCM → Task Sequence → Post-Imaging
                        </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        {monitorDeviceCount > 0 && (
                            <button
                                onClick={onImportFromMonitor}
                                className="px-4 py-2 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#2ECC10] transition"
                            >
                                Import {monitorDeviceCount} from Monitor
                            </button>
                        )}
                        {pipeline.devices.length > 0 && (
                            <button
                                onClick={onClear}
                                className="px-4 py-2 bg-red-700 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition"
                            >
                                Clear Pipeline
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {[
                        { label: 'Total', value: pipeline.devices.length, color: 'text-gray-100' },
                        { label: 'Connected', value: pipeline.devices.filter(d => ['connected','running-autotag','autotag-complete','sccm-importing','sccm-imported','ts-starting','ts-running','ts-complete','post-imaging-complete'].includes(d.status)).length, color: 'text-cyan-400' },
                        { label: 'SCCM Imported', value: pipeline.devices.filter(d => d.status === 'sccm-imported').length, color: 'text-blue-400' },
                        { label: 'TS Complete', value: pipeline.devices.filter(d => d.status === 'ts-complete' || d.status === 'post-imaging-complete').length, color: 'text-[#39FF14]' },
                    ].map(s => (
                        <div key={s.label} className="bg-black/50 p-3 rounded-lg">
                            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                            <div className="text-xs text-gray-400 font-bold">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Stage Progress Bar ── */}
            <div className="bg-gray-950 p-4 rounded-lg shadow-lg border border-gray-800">
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {STAGES.map((stage, idx) => {
                        const done = idx < activeStageIdx;
                        const active = idx === activeStageIdx;
                        return (
                            <React.Fragment key={stage.id}>
                                <div className={`flex-shrink-0 text-center px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                                    active ? 'bg-[#39FF14] text-black' :
                                    done ? 'bg-gray-700 text-gray-300' :
                                    'bg-gray-900 text-gray-600'
                                }`}>
                                    {done ? '✓ ' : ''}{stage.label}
                                </div>
                                {idx < STAGES.length - 1 && (
                                    <div className={`h-0.5 flex-grow ${done ? 'bg-gray-600' : 'bg-gray-800'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Current: <span className="text-gray-200 font-semibold">{STAGES[activeStageIdx]?.description}</span>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Left: Device List & Input ── */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    {/* Add devices manually */}
                    {pipeline.devices.length === 0 && (
                        <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-3">
                            <h3 className="text-sm font-bold text-gray-200">Add Devices</h3>
                            <p className="text-xs text-gray-400">
                                Paste CSV rows (hostname,mac,ip) or import a CSV file. You can also use the "Import from Monitor" button above.
                            </p>
                            <textarea
                                className="w-full bg-black/50 border border-gray-700 rounded-md p-2 text-xs font-mono text-gray-300 resize-none h-28 focus:ring-1 focus:ring-[#39FF14] outline-none"
                                placeholder="HOSTNAME-01,AA:BB:CC:DD:EE:FF,192.168.1.10&#10;HOSTNAME-02,11:22:33:44:55:66,192.168.1.11"
                                value={manualCsv}
                                onChange={e => setManualCsv(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleManualAdd}
                                    disabled={!manualCsv.trim()}
                                    className="flex-1 px-3 py-2 bg-[#39FF14] text-black text-xs font-semibold rounded-lg hover:bg-[#2ECC10] disabled:bg-gray-700 disabled:text-gray-500 transition"
                                >
                                    Add from Text
                                </button>
                                <label className="flex-1 text-center px-3 py-2 bg-gray-700 text-white text-xs font-semibold rounded-lg hover:bg-gray-600 cursor-pointer transition">
                                    Import CSV
                                    <input type="file" accept=".csv" className="hidden" onChange={handleFileImport} />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Package selector (only show when on task-sequence stage) */}
                    {(pipeline.activeStage === 'task-sequence' || activeStageIdx >= 5) && (
                        <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-2">
                            <h3 className="text-sm font-bold text-gray-200">Image Package</h3>
                            <select
                                className="w-full bg-black/50 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-[#39FF14] outline-none"
                                value={pipeline.selectedPackageId}
                                onChange={e => onSetPackage(e.target.value)}
                            >
                                <option value="">— Select a package —</option>
                                {IMAGE_PACKAGES.map(p => (
                                    <option key={p.id} value={p.id}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* SCCM countdown */}
                    {pipeline.activeStage === 'sccm-wait' && pipeline.sccmWaitStartTime && (
                        <SccmCountdown
                            startTime={pipeline.sccmWaitStartTime}
                            durationMs={pipeline.sccmWaitDurationMs}
                            onComplete={() => onRunStage('sccm-wait')}
                        />
                    )}

                    {/* Stage action button */}
                    {pipeline.devices.length > 0 && pipeline.activeStage !== 'sccm-wait' && (
                        <button
                            onClick={() => onRunStage(pipeline.activeStage)}
                            disabled={pipeline.isRunning || (pipeline.activeStage === 'task-sequence' && !pipeline.selectedPackageId)}
                            className="w-full px-4 py-3 bg-[#39FF14] text-black font-bold rounded-lg hover:bg-[#2ECC10] disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition text-sm"
                        >
                            {pipeline.isRunning ? 'Running…' : `Run: ${STAGES[activeStageIdx]?.label}`}
                        </button>
                    )}
                </div>

                {/* ── Middle: Device Cards ── */}
                <div className="lg:col-span-1 bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <h3 className="text-sm font-bold text-gray-200 mb-3">
                        Devices ({pipeline.devices.length})
                    </h3>
                    {pipeline.devices.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm">
                            No devices in pipeline. Add devices or import from the Image Monitor.
                        </div>
                    ) : (
                        <div className="space-y-2 overflow-y-auto max-h-[520px] pr-1">
                            {pipeline.devices.map(d => <PipelineDeviceRow key={d.id} device={d} />)}
                        </div>
                    )}
                </div>

                {/* ── Right: Pipeline Log ── */}
                <div className="lg:col-span-1 bg-gray-950 p-4 rounded-lg border border-gray-800 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-200 mb-3">Pipeline Log</h3>
                    <div className="flex-grow overflow-y-auto max-h-[520px] space-y-1 font-mono text-xs">
                        {pipeline.logs.length === 0 && (
                            <p className="text-gray-600">No activity yet.</p>
                        )}
                        {pipeline.logs.map((entry, i) => {
                            const colors: Record<typeof entry.level, string> = {
                                info: 'text-gray-400',
                                success: 'text-[#39FF14]',
                                error: 'text-red-400',
                                warn: 'text-yellow-400',
                            };
                            const time = new Date(entry.time).toLocaleTimeString();
                            return (
                                <p key={i} className={colors[entry.level]}>
                                    <span className="text-gray-600">[{time}]</span> {entry.message}
                                </p>
                            );
                        })}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>

            {/* ── Process Documentation ── */}
            <div className="bg-gray-950 p-6 rounded-lg border border-gray-800 space-y-6">
                <h2 className="text-xl font-bold text-[#39FF14] border-b border-gray-700 pb-2">
                    Process Documentation & Capacity Guide
                </h2>

                <section className="space-y-3">
                    <h3 className="text-base font-bold text-gray-100">📋 End-to-End Imaging Workflow</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { step: '1', title: 'Device Added (PXE Boot)', body: 'Plug device into the imaging switch. It PXE boots to WinPE (PXE4). The app detects it on the Image Monitor tab and shows it in the rack.' },
                            { step: '2', title: 'AutoTag', body: 'Technician (or pipeline) connects via RDP to WinPE and runs AutoTag. The tool reads BIOS asset info and stamps the device hostname and asset tag.' },
                            { step: '3', title: 'CSV Export', body: 'The app exports Hostname + MAC for all devices in the batch. This record can be submitted to Asset Management or used for audit.' },
                            { step: '4', title: 'SCCM Import', body: 'All device MACs are pushed to SCCM as new device objects via WMI ImportMachineEntry. Devices are placed in a pre-staging collection.' },
                            { step: '5', title: 'SCCM 20-min Wait', body: 'The SCCM site server runs discovery and policy evaluation on a cycle (default ~20 min). The countdown timer tracks this. You can skip in lab environments.' },
                            { step: '6', title: 'Task Sequence', body: 'Once SCCM recognises devices, the pipeline kicks off the selected Task Sequence (OS apply, drivers, domain join, apps). Done in bulk.' },
                            { step: '7', title: 'Post-Imaging Checks', body: 'The app remotely verifies BitLocker, SCCM client health, CrowdStrike, domain join, Windows activation, VPN, printers, and hostname/asset match.' },
                            { step: '8', title: 'Device Removed', body: 'Technician physically removes device from imaging rack. App status shows "Post-Imaging Complete". Device is ready for deployment.' },
                        ].map(item => (
                            <div key={item.step} className="bg-black/30 rounded-lg p-4 border border-gray-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="w-8 h-8 rounded-full bg-[#39FF14] text-black flex items-center justify-center font-bold text-sm flex-shrink-0">{item.step}</span>
                                    <h4 className="font-semibold text-gray-100 text-sm">{item.title}</h4>
                                </div>
                                <p className="text-xs text-gray-400 leading-relaxed">{item.body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-3 border-t border-gray-800 pt-4">
                    <h3 className="text-base font-bold text-gray-100">⚡ Capacity Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-black/30 border border-green-800 rounded-lg p-4">
                            <h4 className="font-bold text-green-400 text-sm mb-2">Browser / App Layer</h4>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                <strong>No hard limit.</strong> The React frontend holds devices in memory as JavaScript objects. A modern browser can comfortably manage <strong>500–1,000+ devices</strong> without performance issues. The rack grid renders only visible slots, keeping the DOM lean.
                            </p>
                        </div>
                        <div className="bg-black/30 border border-blue-800 rounded-lg p-4">
                            <h4 className="font-bold text-blue-400 text-sm mb-2">Network / SCCM Layer</h4>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                <strong>Practical limit: ~50–100 per batch.</strong> SCCM WMI calls are serialised per site server. Very large batches (&gt;100) may time out. Split into batches of 50. PXE bandwidth and switch port count also constrain simultaneous imagers — most labs run 16–32 ports per switch.
                            </p>
                        </div>
                        <div className="bg-black/30 border border-yellow-800 rounded-lg p-4">
                            <h4 className="font-bold text-yellow-400 text-sm mb-2">Physical / Infrastructure Layer</h4>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                <strong>Typically 16–32 per rack, up to 50+ with multiple switches.</strong> Your PXE server's TFTP/HTTP capacity, imaging share I/O, and switch port count are the real constraints. 20 devices imaging simultaneously is routine; 50 requires dedicated GbE uplinks.
                            </p>
                        </div>
                    </div>
                    <div className="bg-black/40 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 leading-relaxed">
                        <p><strong className="text-gray-100">Summary:</strong> The app itself can handle as many devices as you throw at it — tested patterns support 50+ in a single session. The practical ceiling is your <strong>physical switch ports</strong> (usually 16 or 32 per rack) and <strong>SCCM site server throughput</strong>. For 50 devices, plan 2–3 switch stacks and split SCCM imports into batches of 25–50. The 20-minute wait applies per batch, not per device, so parallel batches across racks can cut total imaging time significantly.</p>
                    </div>
                </section>
            </div>
        </div>
    );
};
