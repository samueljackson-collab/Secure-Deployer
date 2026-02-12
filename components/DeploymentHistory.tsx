
import React, { useState } from 'react';
import type { DeploymentRun } from '../types';
import { HistoryChart, AnalyticsChart, calculateAnalytics } from './DeploymentAnalytics';

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
    const analytics = calculateAnalytics(history);

    const TrendIndicator = () => {
         if (!analytics || history.length < 2) return <span className="text-gray-400 font-bold">-</span>;
         if (Math.abs(analytics.trend) < 1) {
            return <span className="text-gray-400 font-bold">~{analytics.trend.toFixed(1)}% (Stable)</span>;
        }
        if (analytics.trend > 0) {
            return <span className="text-[#39FF14] font-bold">↑{analytics.trend.toFixed(1)}% (Improving)</span>;
        }
        return <span className="text-red-400 font-bold">↓{analytics.trend.toFixed(1)}% (Declining)</span>;
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
                <div className="mt-4 pt-4 border-t border-gray-700">
                    {history.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-4 font-bold">No completed runs yet.</p>
                    ) : (
                        <div className="space-y-8">
                            <div className="bg-black/50 p-4 rounded-lg border border-gray-700">
                                <h3 className="text-base font-bold text-center text-gray-300 mb-3">Analytics Dashboard</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <h4 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Success Trend</h4>
                                        <p className="text-2xl font-bold mt-1"><TrendIndicator /></p>
                                    </div>
                                    <div>
                                        <h4 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Avg Success</h4>
                                        <p className="text-2xl font-bold text-[#39FF14] mt-1">{analytics?.averageSuccessRate.toFixed(1)}%</p>
                                    </div>
                                     <div>
                                        <h4 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Top Update</h4>
                                        <p className="text-xl font-bold text-yellow-400 mt-1 capitalize">{analytics?.mostFrequentUpdate.key ?? 'N/A'}</p>
                                        {analytics?.mostFrequentUpdate && analytics.mostFrequentUpdate.value > 0 && (
                                            <p className="text-xs text-gray-500 font-bold">{analytics.mostFrequentUpdate.value} occurrences</p>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Top Failure</h4>
                                        <p className="text-xl font-bold text-red-400 mt-1 capitalize">{analytics?.mostFrequentFailure.key ?? 'N/A'}</p>
                                        {analytics?.mostFrequentFailure && analytics.mostFrequentFailure.value > 0 && (
                                            <p className="text-xs text-gray-500 font-bold">{analytics.mostFrequentFailure.value} occurrences</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
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
            )}
        </div>
    );
});
