
import React from 'react';
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
        return Object.values(counts).reduce((a, b) => a + b, 0);
    }), 1); // Use 1 as min to avoid division by zero

    return (
        <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2 text-center">{title}</h4>
            <div className="h-48 bg-slate-900/50 p-4 rounded-md flex justify-around items-end gap-2 border border-slate-700 relative">
                {reversedData.map((run) => (
                    <div key={run.id} className="group relative flex-1 h-full flex flex-col-reverse items-center" title={run.endTime.toLocaleDateString()}>
                        {keys.map(key => {
                            const counts = run[dataKey];
                            const value = counts ? counts[key.name as keyof typeof counts] : 0;
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
                                 const counts = run[dataKey];
                                 const value = counts ? counts[key.name as keyof typeof counts] : 0;
                                 return <p key={key.name}>{`${key.name.charAt(0).toUpperCase() + key.name.slice(1)}: ${value}`}</p>;
                            })}
                            <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-600 absolute left-1/2 transform -translate-x-1/2 rotate-45 -bottom-1"></div>
                        </div>
                    </div>
                ))}
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

export const DeploymentAnalytics: React.FC<{ history: DeploymentRun[] }> = ({ history }) => {
    const analytics = calculateAnalytics(history);

    if (history.length === 0) {
        return (
            <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">
                <h2 className="text-xl font-bold text-cyan-400 mb-4 border-b border-slate-600 pb-2">Deployment Analytics</h2>
                <p className="text-slate-500 text-sm text-center py-4">Complete a deployment to see analytics.</p>
            </div>
        );
    }
    
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
            <h2 className="text-xl font-bold text-cyan-400 mb-4 border-b border-slate-600 pb-2">Deployment Analytics</h2>
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col">
                        <span className="text-slate-300">Success Rate Trend</span>
                        <span className="font-semibold text-lg"><TrendIndicator /></span>
                    </div>
                     <div className="flex flex-col">
                        <span className="text-slate-300">Avg. Success Rate</span>
                        <span className="font-semibold text-lg text-cyan-300">{analytics?.averageSuccessRate.toFixed(1)}%</span>
                    </div>
                </div>

                {history.length > 0 && (
                    <>
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
                    </>
                )}
            </div>
        </div>
    );
};
