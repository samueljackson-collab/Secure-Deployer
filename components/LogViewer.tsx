
import React, { useEffect, useRef } from 'react';
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


export const LogViewer: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="bg-slate-900/70 rounded-lg overflow-hidden border border-slate-700 h-full flex flex-col">
             <div className="p-3 bg-slate-800 border-b border-slate-700">
                <h3 className="font-semibold text-slate-200">Live Log</h3>
            </div>
            <div ref={scrollRef} className="overflow-y-auto flex-grow p-3 font-mono text-xs space-y-2">
                {logs.map((log, index) => (
                    <div key={index} className={`flex items-start border-l-2 ${levelBorders[log.level]} pl-2`}>
                        <span className="text-slate-500 mr-2">{log.timestamp.toLocaleTimeString()}</span>
                        <p className={`${levelColors[log.level]} flex-1`}>{log.message}</p>
                    </div>
                ))}
                 {logs.length === 0 && (
                    <div className="text-center py-8 text-slate-500">Log empty. Start a deployment to see output.</div>
                )}
            </div>
        </div>
    );
};
