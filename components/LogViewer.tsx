

import React, { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../types';

const levelColors: Record<LogEntry['level'], string> = {
    INFO: 'text-slate-400',
    SUCCESS: 'text-green-400',
    WARNING: 'text-yellow-400',
    ERROR: 'text-red-400',
};

const levelBorders: Record<LogEntry['level'], string> = {
    INFO: 'border-slate-600',
    SUCCESS: 'border-green-600',
    WARNING: 'border-yellow-600',
    ERROR: 'border-red-600',
};

const levelButtonClasses: Record<LogEntry['level'], string> = {
    INFO: 'bg-slate-600 hover:bg-slate-500',
    SUCCESS: 'bg-green-600 hover:bg-green-500',
    WARNING: 'bg-yellow-600 hover:bg-yellow-500',
    ERROR: 'bg-red-600 hover:bg-red-500',
};

// Developer note: stable level order keeps button layout predictable and aligns
// with the visual severity progression used across the dashboard.
const LOG_LEVELS: LogEntry['level'][] = ['INFO', 'SUCCESS', 'WARNING', 'ERROR'];

export const LogViewer: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [filters, setFilters] = useState<Set<LogEntry['level']>>(new Set(LOG_LEVELS));

    const handleFilterToggle = (level: LogEntry['level']) => {
        setFilters(prev => {
            const newFilters = new Set(prev);
            if (newFilters.has(level)) {
                newFilters.delete(level);
            } else {
                newFilters.add(level);
            }
            return newFilters;
        });
    };

    // Developer note: filtering is client-side against in-memory logs; this keeps
// toggles instant and avoids coupling log rendering to backend pagination.
    const filteredLogs = logs.filter(log => filters.has(log.level));

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [filteredLogs]); // Scroll on filtered logs change

    return (
        <div className="bg-slate-900/70 rounded-lg overflow-hidden border border-slate-700 h-full flex flex-col">
             <div className="p-3 bg-slate-800 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-2">
                <h3 className="font-semibold text-slate-200">Live Log</h3>
                <div className="flex items-center gap-2">
                    {LOG_LEVELS.map(level => (
                        <button
                            key={level}
                            onClick={() => handleFilterToggle(level)}
                            title={`Click to ${filters.has(level) ? 'hide' : 'show'} ${level} logs`}
                            className={`px-2 py-1 text-xs font-bold text-white rounded-md transition-opacity duration-200 ${levelButtonClasses[level]} ${filters.has(level) ? 'opacity-100' : 'opacity-40'}`}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>
            <div ref={scrollRef} className="overflow-y-auto flex-grow p-3 font-mono text-xs space-y-2">
                {filteredLogs.map((log, index) => (
                    <div key={index} className={`flex items-start border-l-2 ${levelBorders[log.level]} pl-2`}>
                        <span className="text-slate-500 mr-2">{log.timestamp.toLocaleTimeString()}</span>
                        <p className={`${levelColors[log.level]} flex-1`}>{log.message}</p>
                    </div>
                ))}
                 {logs.length > 0 && filteredLogs.length === 0 && (
                    <div className="text-center py-8 text-slate-500">No logs match the current filter.</div>
                )}
                 {logs.length === 0 && (
                    <div className="text-center py-8 text-slate-500">Log empty. Start a deployment to see output.</div>
                )}
            </div>
        </div>
    );
};