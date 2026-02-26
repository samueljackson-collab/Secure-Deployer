import React, { useState } from 'react';
import type { DeploymentRun } from '../types';
import { HistoryChart, AnalyticsChart, calculateAnalytics } from './DeploymentAnalytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const HistoryItem: React.FC<{ run: DeploymentRun }> = ({ run }) => {
    const barColor = run.successRate >= 90 ? 'bg-[#39FF14]' : run.successRate >= 60 ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
        <div className="bg-black/50 p-3 rounded-md border border-gray-800">
            <div className="flex justify-between items-center text-xs text-gray-400 mb-2 font-bold">
                <span>{run.endTime.toLocaleString()}</span>
                <span className="font-semibold">{run.totalDevices} Devices</span>
            </div>
            <div>
                <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-gray-300">Success Rate</span>
                    <span className={`text-sm font-bold ${barColor.replace('bg-','text-')}`}>{Math.round(run.successRate)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className={`${barColor} h-2 rounded-full`} style={{ width: `${run.successRate}%` }}></div>
                </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                 <div title="Compliant">
                    <span className="font-bold text-[#39FF14]">{run.compliant}</span>
                    <span className="text-gray-400 font-bold"> ✔</span>
                </div>
                <div title="Needs Action">
                    <span className="font-bold text-yellow-400">{run.needsAction}</span>
                     <span className="text-gray-400 font-bold"> ❗</span>
                </div>
                 <div title="Failed / Offline / Cancelled">
                    <span className="font-bold text-red-400">{run.failed}</span>
                     <span className="text-gray-400 font-bold"> ❌</span>
                </div>
            </div>
        </div>
    )
}

export const DeploymentHistory: React.FC<{ history: DeploymentRun[] }> = React.memo(({ history }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const analytics = calculateAnalytics(history) || {
        averageSuccessRate: 0,
        trend: 0,
        mostFrequentUpdate: { key: 'N/A', value: 0 },
        mostFrequentFailure: { key: 'N/A', value: 0 },
    };

    const TrendIndicator = () => {
        if (!analytics || history.length < 2) return <span className="text-gray-400 font-bold">-</span>;

        const trendValue = analytics.trend;
        if (Math.abs(trendValue) < 1) {
            return <span className="text-gray-400 font-bold">~{trendValue.toFixed(1)}% (Stable)</span>;
        }
        if (trendValue > 0) {
            return <span className="text-[#39FF14] font-bold">↑{trendValue.toFixed(1)}% (Improving)</span>;
        }
        return <span className="text-red-400 font-bold">↓{trendValue.toFixed(1)}% (Declining)</span>;
    }


    return (
        <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800">
            <button 
                className="w-full text-left"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-[#39FF14]">Deployment History & Analytics</h2>
                    <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </span>
                </div>
            </button>
            {isExpanded && (
                <>
                    <div className="flex justify-end mt-4">
                        <button 
                            onClick={() => {
                                if (history.length === 0) return;
                                const csv = history.map(run => ({
                                    endTime: run.endTime.toLocaleString(),
                                    totalDevices: run.totalDevices,
                                    compliant: run.compliant,
                                    needsAction: run.needsAction,
                                    failed: run.failed,
                                    successRate: run.successRate.toFixed(2),
                                }));
                                const csvContent = "data:text/csv;charset=utf-8,"
                                    + Object.keys(csv[0]).join(",") + "\n"
                                    + csv.map(e => Object.values(e).join(",")).join("\n");
                                const encodedUri = encodeURI(csvContent);
                                const link = document.createElement("a");
                                link.setAttribute("href", encodedUri);
                                link.setAttribute("download", "deployment_history.csv");
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            disabled={history.length === 0}
                            className="px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-lg hover:bg-gray-500 transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 disabled:bg-gray-800 disabled:cursor-not-allowed"
                        >
                            Export History
                        </button>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-700">
                    {history.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-4 font-bold">No completed runs yet.</p>
                    ) : (
                        <div className="space-y-8">
                            {analytics && (
                                <div className="bg-black/50 p-4 rounded-lg border border-gray-700">
                                    <h3 className="text-base font-bold text-center text-gray-300 mb-3">Analytics Dashboard</h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                                        <div>
                                            <h4 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Success Trend</h4>
                                            <p className="text-2xl font-bold mt-1"><TrendIndicator /></p>
                                        </div>
                                        <div>
                                            <h4 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Avg Success</h4>
                                            <p className="text-2xl font-bold text-[#39FF14] mt-1">{analytics?.averageSuccessRate?.toFixed(1)}%</p>
                                        </div>
                                        <div>
                                            <h4 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Top Update</h4>
                                            <p className="text-xl font-bold text-yellow-400 mt-1 capitalize">{analytics?.mostFrequentUpdate?.key ?? 'N/A'}</p>
                                            {analytics?.mostFrequentUpdate?.value > 0 && (
                                                <p className="text-xs text-gray-500 font-bold">{analytics?.mostFrequentUpdate?.value} occurrences</p>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Top Failure</h4>
                                            <p className="text-xl font-bold text-red-400 mt-1 capitalize">{analytics?.mostFrequentFailure?.key ?? 'N/A'}</p>
                                            {analytics?.mostFrequentFailure?.value > 0 && (
                                                <p className="text-xs text-gray-500 font-bold">{analytics?.mostFrequentFailure?.value} occurrences</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <HistoryChart history={history} />
                            
                            <AnalyticsChart
                                title="Required Updates Trend"
                                data={history}
                                dataKey="updatesNeededCounts"
                                keys={[
                                    { name: 'bios', color: 'bg-[#39FF14]' },
                                    { name: 'dcu', color: 'bg-[#2ECC10]' },
                                    { name: 'windows', color: 'bg-[#20880B]' },
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

                            {analytics && (
                                <div className="grid md:grid-cols-2 gap-8 mt-4">
                                    <div className="bg-black/50 p-4 rounded-lg border border-gray-700">
                                        <h4 className="text-sm font-bold text-gray-300 mb-2 text-center">Updates Needed Breakdown</h4>
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart data={[analytics.mostFrequentUpdate]} layout="vertical">
                                                <XAxis type="number" hide />
                                                <YAxis type="category" dataKey="key" hide />
                                                <Tooltip />
                                                <Bar dataKey="value" fill="#39FF14" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="bg-black/50 p-4 rounded-lg border border-gray-700">
                                        <h4 className="text-sm font-bold text-gray-300 mb-2 text-center">Common Errors</h4>
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart data={[analytics.mostFrequentFailure]} layout="vertical">
                                                <XAxis type="number" hide />
                                                <YAxis type="category" dataKey="key" hide />
                                                <Tooltip />
                                                <Bar dataKey="value" fill="#ef4444" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="text-sm font-bold text-gray-300 mb-2 text-center">Individual Run Details</h4>
                                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                    {history.map(run => (
                                        <HistoryItem key={run.id} run={run} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                </>
            )}
        </div>
    );
});
