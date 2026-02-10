import React from 'react';
import type { DeploymentRun } from '../types';

interface AnalyticsChartProps {
    title: string;
    data: DeploymentRun[];
    keys: { name: string; color: string }[];
    dataKey: 'updatesNeededCounts' | 'failureCounts';
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ title, data, keys, dataKey }) => {
    const reversedData = [...data].reverse();
    const maxValue = Math.max(...reversedData.map(run => {
        const counts = run[dataKey];
        if (!counts) return 0;
        return (Object.values(counts) as number[]).reduce((a, b) => a + b, 0);
    }), 1);

    return (
        <div>
            <h4 className="text-sm font-bold text-gray-300 mb-2 text-center">{title}</h4>
            <div className="h-48 bg-black/50 p-4 rounded-md flex justify-around items-end gap-2 border border-gray-700 relative">
                {reversedData.map((run) => {
                    const countsForRun = run[dataKey];
                    const totalForRun = countsForRun ? (Object.values(countsForRun) as number[]).reduce((a, b) => a + b, 0) : 0;
                    return (
                        <div key={run.id} className="group relative flex-1 h-full flex flex-col-reverse items-center" title={run.endTime.toLocaleDateString()}>
                            {keys.map(key => {
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
                            <div className="absolute bottom-full mb-2 w-max bg-black border border-gray-700 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                                <p className="font-semibold">{run.endTime.toLocaleDateString()}</p>
                                {keys.map(key => {
                                     const value = (countsForRun as any)?.[key.name] ?? 0;
                                     const percentage = totalForRun > 0 ? `(${(value / totalForRun * 100).toFixed(0)}%)` : '';
                                     return <p key={key.name}>{`${key.name.charAt(0).toUpperCase() + key.name.slice(1)}: ${value} ${percentage}`.trim()}</p>;
                                })}
                                {totalForRun > 0 && <p className="border-t border-gray-700 mt-1 pt-1 font-bold">Total: {totalForRun}</p>}
                                <div className="w-2 h-2 bg-black border-r border-b border-gray-700 absolute left-1/2 transform -translate-x-1/2 rotate-45 -bottom-1"></div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-center flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400 font-bold">
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


export const HistoryChart: React.FC<{ history: DeploymentRun[] }> = ({ history }) => {
    if (history.length < 2) {
        return <p className="text-gray-400 text-sm text-center py-4 font-bold">Run at least two deployments to see a trend chart.</p>;
    }

    const reversedHistory = [...history].reverse().slice(-10);

    return (
        <div>
            <h4 className="text-sm font-bold text-gray-300 mb-2 text-center">Success Rate Trend (Last {reversedHistory.length} runs)</h4>
            <div className="h-40 bg-black/50 p-4 pl-8 rounded-md flex items-end justify-around gap-2 border border-gray-700 relative">
                <div className="absolute top-0 left-0 h-full text-xs text-gray-500 font-bold flex flex-col justify-between py-2 pr-2">
                    <span>100%</span>
                    <span>50%</span>
                    <span>0%</span>
                </div>
                <div className="absolute top-0 left-8 right-0 h-full">
                    <div className="h-1/2 w-full border-b border-dashed border-gray-800"></div>
                </div>

                {reversedHistory.map(run => {
                    const barColor = run.successRate >= 90 ? 'bg-[#39FF14]' : run.successRate >= 60 ? 'bg-yellow-500' : 'bg-red-500';
                    return (
                        <div key={run.id} className="group relative flex-1 h-full flex items-end justify-center z-10">
                            <div
                                className={`w-3/4 ${barColor} rounded-t-sm hover:opacity-100 opacity-80 transition-all duration-200`}
                                style={{ height: `${run.successRate}%` }}
                                title={`${Math.round(run.successRate)}% Success on ${run.endTime.toLocaleDateString()}`}
                            ></div>
                            <div className="absolute bottom-full mb-2 w-max bg-black border border-gray-700 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                                <p className="font-semibold">{run.endTime.toLocaleDateString()}</p>
                                <p>Success: {Math.round(run.successRate)}%</p>
                                <p className="text-gray-400 text-xs font-bold">{`${run.compliant} / ${run.totalDevices} Compliant`}</p>
                                <div className="w-2 h-2 bg-black border-r border-b border-gray-700 absolute left-1/2 transform -translate-x-1/2 rotate-45 -bottom-1"></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const calculateAnalytics = (history: DeploymentRun[]) => {
    if (history.length === 0) {
        return null;
    }

    const totalRuns = history.length;
    const totalSuccessRate = history.reduce((acc, run) => acc + run.successRate, 0);
    const averageSuccessRate = totalSuccessRate / totalRuns;

    let trend = 0;
    if (totalRuns > 1) {
        const latestRun = history[0];
        const previousRuns = history.slice(1);
        const previousAverageSuccessRate = previousRuns.reduce((acc, run) => acc + run.successRate, 0) / previousRuns.length;
        trend = latestRun.successRate - previousAverageSuccessRate;
    }

    const updateTotals = { bios: 0, dcu: 0, windows: 0 };
    const failureTotals = { offline: 0, cancelled: 0, failed: 0 };

    for (const run of history) {
        if (run.updatesNeededCounts) {
            updateTotals.bios += run.updatesNeededCounts.bios;
            updateTotals.dcu += run.updatesNeededCounts.dcu;
            updateTotals.windows += run.updatesNeededCounts.windows;
        }
        if (run.failureCounts) {
            failureTotals.offline += run.failureCounts.offline;
            failureTotals.cancelled += run.failureCounts.cancelled;
            failureTotals.failed += run.failureCounts.failed;
        }
    }

    const findMaxKey = (obj: Record<string, number>): { key: string; value: number } => {
        const entry = Object.entries(obj).reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0] as [string, number]);
        return { key: entry[1] > 0 ? entry[0] : 'N/A', value: entry[1] };
    };

    const mostFrequentUpdate = findMaxKey(updateTotals);
    const mostFrequentFailure = findMaxKey(failureTotals);

    return {
        averageSuccessRate,
        trend,
        mostFrequentUpdate,
        mostFrequentFailure,
    };
};
