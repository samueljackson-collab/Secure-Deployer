import React from 'react';
import type { BatchFileEntry, BatchDeviceStatus } from '../types';

interface BatchFileQueueProps {
    entries: BatchFileEntry[];
    onRemove: (id: number) => void;
    onMoveUp: (id: number) => void;
    onMoveDown: (id: number) => void;
    disabled?: boolean;
}

const statusLabel: Record<BatchFileEntry['status'], string> = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
};

const statusColor: Record<BatchFileEntry['status'], string> = {
    pending: 'text-slate-400',
    running: 'text-cyan-400 animate-pulse',
    completed: 'text-green-400',
    failed: 'text-red-400',
};

const deviceStatusColor: Record<BatchDeviceStatus, string> = {
    pending: 'bg-slate-600',
    running: 'bg-cyan-500 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
};

export const BatchFileQueue: React.FC<BatchFileQueueProps> = ({
    entries,
    onRemove,
    onMoveUp,
    onMoveDown,
    disabled = false,
}) => {
    if (entries.length === 0) return null;

    return (
        <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase text-slate-500 mb-1">
                Execution Queue ({entries.length} file{entries.length !== 1 ? 's' : ''})
            </h4>
            {entries.map((entry, index) => {
                const deviceIds = Object.keys(entry.deviceProgress).map(Number);
                const totalDevices = deviceIds.length;
                const completedDevices = deviceIds.filter(
                    id => entry.deviceProgress[id] === 'completed'
                ).length;
                const failedDevices = deviceIds.filter(
                    id => entry.deviceProgress[id] === 'failed'
                ).length;
                const runningDevices = deviceIds.filter(
                    id => entry.deviceProgress[id] === 'running'
                ).length;
                const fileProgress =
                    totalDevices > 0
                        ? ((completedDevices + failedDevices) / totalDevices) * 100
                        : 0;
                const isActive = entry.status === 'running' || entry.status === 'completed' || entry.status === 'failed';

                return (
                    <div
                        key={entry.id}
                        className={`bg-slate-800/80 border rounded-lg p-3 transition-all ${
                            entry.status === 'running'
                                ? 'border-cyan-500/60'
                                : entry.status === 'completed'
                                ? 'border-green-500/40'
                                : entry.status === 'failed'
                                ? 'border-red-500/40'
                                : 'border-slate-700'
                        }`}
                    >
                        {/* Header row */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="flex-shrink-0 w-5 h-5 bg-slate-700 rounded text-xs font-bold flex items-center justify-center text-slate-300">
                                    {index + 1}
                                </span>
                                <span className="text-sm text-slate-200 truncate" title={entry.name}>
                                    {entry.name}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <span className={`text-xs font-medium ${statusColor[entry.status]}`}>
                                    {statusLabel[entry.status]}
                                </span>
                                {!disabled && entry.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => onMoveUp(entry.id)}
                                            disabled={index === 0}
                                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Move up"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => onMoveDown(entry.id)}
                                            disabled={index === entries.length - 1}
                                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Move down"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => onRemove(entry.id)}
                                            className="p-1 text-slate-400 hover:text-red-400"
                                            title="Remove from queue"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* File-level progress bar */}
                        {isActive && totalDevices > 0 && (
                            <div className="mt-2">
                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>
                                        {completedDevices}/{totalDevices} devices
                                        {failedDevices > 0 && (
                                            <span className="text-red-400 ml-1">({failedDevices} failed)</span>
                                        )}
                                        {runningDevices > 0 && (
                                            <span className="text-cyan-400 ml-1">({runningDevices} running)</span>
                                        )}
                                    </span>
                                    <span>{Math.round(fileProgress)}%</span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-1.5">
                                    <div
                                        className={`h-1.5 rounded-full transition-all duration-500 ${
                                            entry.status === 'failed'
                                                ? 'bg-red-500'
                                                : entry.status === 'completed'
                                                ? 'bg-green-500'
                                                : 'bg-cyan-500'
                                        }`}
                                        style={{ width: `${fileProgress}%` }}
                                    />
                                </div>

                                {/* Per-device mini progress dots */}
                                {totalDevices <= 50 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {deviceIds.map(deviceId => (
                                            <div
                                                key={deviceId}
                                                className={`w-2 h-2 rounded-full ${deviceStatusColor[entry.deviceProgress[deviceId]]}`}
                                                title={`Device #${deviceId}: ${entry.deviceProgress[deviceId]}`}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Summary for large device counts */}
                                {totalDevices > 50 && (
                                    <div className="flex gap-3 mt-2 text-xs">
                                        <span className="text-green-400">{completedDevices} done</span>
                                        <span className="text-cyan-400">{runningDevices} running</span>
                                        <span className="text-red-400">{failedDevices} failed</span>
                                        <span className="text-slate-500">{totalDevices - completedDevices - failedDevices - runningDevices} pending</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
