import React, { useState } from 'react';
import type { DeploymentRun } from '../types';

interface AnalyticsChartProps {
    title: string;
    data: DeploymentRun[];
    keys: { name: string; color: string }[];
    dataKey: 'updatesNeededCounts' | 'failureCounts';
}

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ title, data, keys, dataKey }) => {
    const reversedData = [...data].reverse();
    const maxValue = Math.max(...reversedData.map(run => {
        const counts = run[dataKey];
        if (!counts) return 0;
        // FIX: Cast Object.values to number[] to ensure correct type for reduce, which resolves multiple downstream errors.
        return (Object.values(counts) as number[]).reduce((a, b) => a + b, 0);
    }), 1); // Use 1 as min to avoid division by zero

    return (
        <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2 text-center">{title}</h4>
            <div className="h-48 bg-slate-900/50 p-4 rounded-md flex justify-around items-end gap-2 border border-slate-700 relative">
                {reversedData.map((run) => {
                    const countsForRun = run[dataKey];
                    // FIX: Cast Object.values to number[] to ensure correct type for reduce.
                    const totalForRun = countsForRun ? (Object.values(countsForRun) as number[]).reduce((a, b) => a + b, 0) : 0;
                    return (
                        <div key={run.id} className="group relative flex-1 h-full flex flex-col-reverse items-center" title={run.endTime.toLocaleDateString()}>
                            {keys.map(key => {
                                // FIX: Cast countsForRun to `any` to allow dynamic key access without type errors on the union type.
                                const value = (countsForRun as any)?.[key.name] ?? 0;
                                const height = (value / maxValue) * 100;
                                return (
                                    <div
                                        key={key.name}
                                        className={`w-3/4 ${key.color} transition-all duration-200`}
                                        style={{ height: `${height}%` }}
                                    ></div>
                                );
                            })}
                            <div className="absolute bottom-full mb-2 w-max bg-slate-900 border border-slate-600 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                                <p className="font-semibold">{run.endTime.toLocaleDateString()}</p>
                                {keys.map(key => {
                                     // FIX: Cast countsForRun to `any` to allow dynamic key access without type errors on the union type.
                                     const value = (countsForRun as any)?.[key.name] ?? 0;
                                     const percentage = totalForRun > 0 ? `(${(value / totalForRun * 100).toFixed(0)}%)` : '';
                                     return <p key={key.name}>{`${key.name.charAt(0).toUpperCase() + key.name.slice(1)}: ${value} ${percentage}`.trim()}</p>;
                                })}
                                {totalForRun > 0 && <p className="border-t border-slate-700 mt-1 pt-1 font-bold">Total: {totalForRun}</p>}
                                <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-600 absolute left-1/2 transform -translate-x-1/2 rotate-45 -bottom-1"></div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-center flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                {keys.map(key => (
                    <div key={key.name} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded-sm ${key.color}`}></div>
                        <span>{key.name.charAt(0).toUpperCase() + key.name.slice(1)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


const HistoryChart: React.FC<{ history: DeploymentRun[] }> = ({ history }) => {
    if (history.length < 2) {
        return <p className="text-slate-500 text-sm text-center py-4">Run at least two deployments to see a trend chart.</p>;
    }

    const reversedHistory = [...history].reverse().slice(-10); // Show last 10 runs, oldest to newest

    return (
        <div>
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
                                <p className="text-slate-400 text-xs">{`${run.compliant} / ${run.totalDevices} Compliant`}</p>
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

const calculateAnalytics = (history: DeploymentRun[]) => {
    if (history.length === 0) {
        return null;
    }
    if (history.length === 1) {
         return {
            averageSuccessRate: history[0].successRate,
            trend: 0, // No trend with one run
        };
    }

    const totalRuns = history.length;
    const latestRun = history[0];
    const previousRuns = history.slice(1);

    const totalSuccessRate = history.reduce((acc, run) => acc + run.successRate, 0);
    const averageSuccessRate = totalSuccessRate / totalRuns;
    
    const previousAverageSuccessRate = previousRuns.reduce((acc, run) => acc + run.successRate, 0) / previousRuns.length;

    const trend = latestRun.successRate - previousAverageSuccessRate;
    
    return {
        averageSuccessRate,
        trend,
    };
};


export const DeploymentHistory: React.FC<{ history: DeploymentRun[] }> = ({ history }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const analytics = calculateAnalytics(history);

    const TrendIndicator = () => {
         if (!analytics || history.length < 2) return <span className="text-slate-400">-</span>;
         if (Math.abs(analytics.trend) < 1) {
            return <span className="text-slate-400">~{analytics.trend.toFixed(1)}% (Stable)</span>;
        }
        if (analytics.trend > 0) {
            return <span className="text-green-400">↑{analytics.trend.toFixed(1)}% (Improving)</span>;
        }
        return <span className="text-red-400">↓{analytics.trend.toFixed(1)}% (Declining)</span>;
    }


    return (
        <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">
            <button 
                className="w-full text-left"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-cyan-400">Deployment History & Analytics</h2>
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
                        <div className="space-y-8">
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <h3 className="text-base font-semibold text-center text-slate-300 mb-3">Analytics Dashboard</h3>
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div>
                                        <h4 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Success Trend</h4>
                                        <p className="text-2xl font-bold mt-1"><TrendIndicator /></p>
                                    </div>
                                    <div>
                                        <h4 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Average Success</h4>
                                        <p className="text-2xl font-bold text-cyan-300 mt-1">{analytics?.averageSuccessRate.toFixed(1)}%</p>
                                    </div>
                                </div>
                            </div>
                            
                            <HistoryChart history={history} />
                            
                            <AnalyticsChart
                                title="Required Updates Trend"
                                data={history}
                                dataKey="updatesNeededCounts"
                                keys={[
                                    { name: 'bios', color: 'bg-sky-500' },
                                    { name: 'dcu', color: 'bg-indigo-500' },
                                    { name: 'windows', color: 'bg-purple-500' },
                                ]}
                            />

                            <AnalyticsChart
                                title="Failure Reasons Trend"
                                data={history}
                                dataKey="failureCounts"
                                keys={[
                                    { name: 'offline', color: 'bg-orange-500' },
                                    { name: 'cancelled', color: 'bg-gray-500' },
                                    { name: 'failed', color: 'bg-red-500' },
                                ]}
                            />

                            <div>
                                <h4 className="text-sm font-semibold text-slate-300 mb-2 text-center">Individual Run Details</h4>
                                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                    {history.map(run => (
                                        <HistoryItem key={run.id} run={run} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};