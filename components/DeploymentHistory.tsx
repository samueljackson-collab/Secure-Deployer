
import React, { useState } from 'react';
import type { DeploymentRun } from '../types';

const HistoryChart: React.FC<{ history: DeploymentRun[] }> = ({ history }) => {
    if (history.length < 2) {
        return <p className="text-slate-500 text-sm text-center py-4">Run at least two deployments to see a trend chart.</p>;
    }

    const reversedHistory = [...history].reverse().slice(-10); // Show last 10 runs, oldest to newest

    return (
        <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-300 mb-2 text-center">Success Rate Trend (Last {reversedHistory.length} runs)</h4>
            <div className="h-40 bg-slate-900/50 p-4 pl-8 rounded-md flex items-end justify-around gap-2 border border-slate-700 relative">
                {/* Y-Axis labels */}
                <div className="absolute top-0 left-0 h-full text-xs text-slate-500 flex flex-col justify-between py-2 pr-2">
                    <span>100%</span>
                    <span>50%</span>
                    <span>0%</span>
                </div>
                {/* Y-Axis lines */}
                <div className="absolute top-0 left-8 right-0 h-full">
                    <div className="h-1/2 w-full border-b border-dashed border-slate-700"></div>
                </div>

                {reversedHistory.map(run => {
                    const barColor = run.successRate >= 90 ? 'bg-green-500' : run.successRate >= 60 ? 'bg-yellow-500' : 'bg-red-500';
                    return (
                        <div key={run.id} className="group relative flex-1 h-full flex items-end justify-center z-10">
                            <div
                                className={`w-3/4 ${barColor} rounded-t-sm hover:opacity-100 opacity-80 transition-all duration-200`}
                                style={{ height: `${run.successRate}%` }}
                                title={`${Math.round(run.successRate)}% Success on ${run.endTime.toLocaleDateString()}`}
                            ></div>
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 w-max bg-slate-900 border border-slate-600 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                                <p className="font-semibold">{run.endTime.toLocaleDateString()}</p>
                                <p>Success: {Math.round(run.successRate)}%</p>
                                <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-600 absolute left-1/2 transform -translate-x-1/2 rotate-45 -bottom-1"></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


const HistoryItem: React.FC<{ run: DeploymentRun }> = ({ run }) => {
    const barColor = run.successRate >= 90 ? 'bg-green-500' : run.successRate >= 60 ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
        <div className="bg-slate-800/60 p-3 rounded-md border border-slate-700">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                <span>{run.endTime.toLocaleString()}</span>
                <span className="font-semibold">{run.totalDevices} Devices</span>
            </div>
            <div>
                <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-slate-300">Success Rate</span>
                    <span className={`text-sm font-medium ${barColor.replace('bg-','text-')}`}>{Math.round(run.successRate)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className={`${barColor} h-2 rounded-full`} style={{ width: `${run.successRate}%` }}></div>
                </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                 <div title="Compliant">
                    <span className="font-bold text-green-400">{run.compliant}</span>
                    <span className="text-slate-400"> ✔</span>
                </div>
                <div title="Needs Action">
                    <span className="font-bold text-yellow-400">{run.needsAction}</span>
                     <span className="text-slate-400"> ❗</span>
                </div>
                 <div title="Failed / Offline / Cancelled">
                    <span className="font-bold text-red-400">{run.failed}</span>
                     <span className="text-slate-400"> ❌</span>
                </div>
            </div>
        </div>
    )
}

export const DeploymentHistory: React.FC<{ history: DeploymentRun[] }> = ({ history }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">
            <button 
                className="w-full text-left"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-cyan-400">Deployment History</h2>
                    <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </span>
                </div>
            </button>
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-600">
                    {history.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-4">No completed runs yet.</p>
                    ) : (
                        <>
                            <HistoryChart history={history} />
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                {history.map(run => (
                                    <HistoryItem key={run.id} run={run} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
