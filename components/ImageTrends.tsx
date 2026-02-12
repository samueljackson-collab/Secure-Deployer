
import React from 'react';
import type { DeploymentRun } from '../types';
import { HistoryChart, AnalyticsChart } from './DeploymentAnalytics';

interface ImageTrendsProps {
    history: DeploymentRun[];
}

export const ImageTrends: React.FC<ImageTrendsProps> = ({ history }) => {
    if (history.length === 0) {
        return (
            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 text-center">
                <h3 className="text-lg font-bold text-gray-400">No Deployment History</h3>
                <p className="text-sm text-gray-500">
                    Complete at least one deployment run from the "Deployment Runner" tab to see historical trends and analytics.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 space-y-8">
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
        </div>
    );
};