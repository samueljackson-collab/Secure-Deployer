
import React, { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../types';

const levelColors: Record<LogEntry['level'], string> = {
    INFO: 'text-gray-400',
    SUCCESS: 'text-[#39FF14]',
    WARNING: 'text-yellow-400',
    ERROR: 'text-red-400',
};

const levelBorders: Record<LogEntry['level'], string> = {
    INFO: 'border-gray-700',
    SUCCESS: 'border-[#39FF14]',
    WARNING: 'border-yellow-600',
    ERROR: 'border-red-600',
};

const levelButtonClasses: Record<LogEntry['level'], string> = {
    INFO: 'bg-gray-700 hover:bg-gray-600',
    SUCCESS: 'bg-[#39FF14] hover:bg-[#2ECC10]',
    WARNING: 'bg-yellow-600 hover:bg-yellow-500',
    ERROR: 'bg-red-600 hover:bg-red-500',
};

const LOG_LEVELS: LogEntry['level'][] = ['INFO', 'SUCCESS', 'WARNING', 'ERROR'];

export const LogViewer: React.FC<{ logs: LogEntry[] }> = React.memo(({ logs }) => {
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
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

    const filteredLogs = logs.filter(log => filters.has(log.level));

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [filteredLogs]); // Scroll on filtered logs change

    return (
        <>
            <div className="bg-black/50 rounded-lg overflow-hidden border border-gray-800 h-full flex flex-col">
                <div className="p-3 bg-black/25 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <h3 className="font-semibold text-gray-200">Live Log</h3>
                    <div className="flex items-center gap-2">
                        {LOG_LEVELS.map(level => (
                            <button
                                key={level}
                                onClick={() => handleFilterToggle(level)}
                                title={`Click to ${filters.has(level) ? 'hide' : 'show'} ${level} logs`}
                                className={`px-2 py-1 text-xs font-bold text-black rounded-md transition-opacity duration-200 ${levelButtonClasses[level]} ${filters.has(level) ? 'opacity-100' : 'opacity-40'}`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>
                <div ref={scrollRef} className="overflow-y-auto flex-grow p-3 font-mono text-xs space-y-2">
                    {filteredLogs.map((log, index) => (
                        <div key={index} className={`flex items-start border-l-2 ${levelBorders[log.level]} pl-2`}>
                            <span className="text-gray-500 font-bold mr-2">{log.timestamp.toLocaleTimeString()}</span>
                            <p
                                className={`${levelColors[log.level]} flex-1 ${log.level === 'ERROR' ? 'cursor-pointer hover:underline' : ''}`}
                                onClick={() => log.level === 'ERROR' && setSelectedLog(log)}
                            >
                                {log.message}
                            </p>
                        </div>
                    ))}
                    {logs.length > 0 && filteredLogs.length === 0 && (
                        <div className="text-center py-8 text-gray-400 font-bold">No logs match the current filter.</div>
                    )}
                    {logs.length === 0 && (
                        <div className="text-center py-8 text-gray-400 font-bold">Log empty. Start a deployment to see output.</div>
                    )}
                </div>
            </div>

            {selectedLog && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" onClick={() => setSelectedLog(null)}>
                    <div className="bg-gray-950 rounded-lg shadow-2xl border border-red-500/50 w-full max-w-2xl m-4" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-800 flex items-center space-x-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h2 className="text-lg font-bold text-red-400">Error Details</h2>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-400 font-bold mb-2">{selectedLog.timestamp.toLocaleString()}</p>
                            <pre className="bg-black/50 p-4 rounded-lg border border-gray-800 text-sm text-gray-300 overflow-x-auto max-h-96 whitespace-pre-wrap font-mono">
                                {selectedLog.message}
                            </pre>
                        </div>
                        <div className="p-4 bg-black/50 rounded-b-lg flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 bg-gray-700 text-white text-sm font-semibold rounded-lg hover:bg-gray-600 transition duration-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
});
