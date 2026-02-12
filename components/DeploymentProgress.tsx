
import React from 'react';
import type { Device, DeploymentStatus } from '../types';

interface DeploymentProgressProps {
    devices: Device[];
}

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <div className="flex items-center gap-1.5">
        <div className={`w-3 h-3 ${color} rounded-sm`}></div>
        <span>{label}</span>
    </div>
);

export const DeploymentProgress: React.FC<DeploymentProgressProps> = ({ devices }) => {
    if (devices.length === 0) {
        return <div className="text-center text-gray-400 font-bold py-4">Waiting for system scan to start...</div>;
    }

    const total = devices.length;

    const statusCategories: Record<string, DeploymentStatus[]> = {
        compliant: ['Success', 'Execution Complete'],
        needsAction: ['Scan Complete', 'Update Complete (Reboot Pending)', 'Ready for Execution'],
        failed: ['Failed', 'Offline', 'Cancelled', 'Execution Failed'],
        inProgress: ['Waking Up', 'Connecting', 'Retrying...', 'Checking Info', 'Checking BIOS', 'Checking DCU', 'Checking Windows', 'Updating', 'Updating BIOS', 'Updating DCU', 'Updating Windows', 'Rebooting...', 'Validating', 'Executing Script'],
        pending: ['Pending', 'Pending File'],
    };

    const compliantCount = devices.filter(d => statusCategories.compliant.includes(d.status)).length;
    const needsActionCount = devices.filter(d => statusCategories.needsAction.includes(d.status)).length;
    const failedCount = devices.filter(d => statusCategories.failed.includes(d.status)).length;
    const inProgressCount = devices.filter(d => statusCategories.inProgress.includes(d.status)).length;
    const pendingCount = total - compliantCount - needsActionCount - failedCount - inProgressCount;
    
    const getPercent = (count: number) => (total > 0 ? (count / total) * 100 : 0);

    const compliantPercent = getPercent(compliantCount);
    const needsActionPercent = getPercent(needsActionCount);
    const failedPercent = getPercent(failedCount);
    const inProgressPercent = getPercent(inProgressCount);
    const pendingPercent = getPercent(pendingCount);

    const totalCompleted = compliantCount + needsActionCount + failedCount;
    const overallProgress = getPercent(totalCompleted);

    return (
        <div className="space-y-4">
            <div>
                <div className="flex justify-between mb-2 text-sm font-bold text-gray-300">
                    <span>Overall Progress</span>
                    <span>{Math.round(overallProgress)}%</span>
                </div>
                <div className="flex w-full bg-gray-800 rounded-full h-4 overflow-hidden border border-gray-900" title="Device status breakdown">
                    <div className="bg-[#39FF14] transition-all duration-300" style={{ width: `${compliantPercent}%` }} title={`${compliantCount} Compliant`}></div>
                    <div className="bg-yellow-400 transition-all duration-300" style={{ width: `${needsActionPercent}%` }} title={`${needsActionCount} Need Action`}></div>
                    <div className="bg-red-400 transition-all duration-300" style={{ width: `${failedPercent}%` }} title={`${failedCount} Failed/Offline`}></div>
                    <div className="bg-cyan-400 transition-all duration-300 animate-pulse" style={{ width: `${inProgressPercent}%` }} title={`${inProgressCount} In Progress`}></div>
                    <div className="bg-gray-600 transition-all duration-300" style={{ width: `${pendingPercent}%` }} title={`${pendingCount} Pending`}></div>
                </div>
            </div>

            <div className="flex justify-center flex-wrap gap-x-4 gap-y-2 text-xs text-gray-400 font-bold border-t border-gray-800 pt-4">
                <LegendItem color="bg-[#39FF14]" label="Compliant" />
                <LegendItem color="bg-yellow-400" label="Needs Action" />
                <LegendItem color="bg-red-400" label="Failed/Offline" />
                <LegendItem color="bg-cyan-400" label="In Progress" />
                <LegendItem color="bg-gray-600" label="Pending" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div className="bg-gray-800/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-gray-100">{total}</div>
                    <div className="text-sm text-gray-400 font-bold">Total</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-[#39FF14]">{compliantCount}</div>
                    <div className="text-sm text-gray-400 font-bold">Compliant</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-400">{needsActionCount}</div>
                    <div className="text-sm text-gray-400 font-bold">Needs Action</div>
                </div>
                 <div className="bg-gray-800/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-cyan-400">{inProgressCount}</div>
                    <div className="text-sm text-gray-400 font-bold">In Progress</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-red-400">{failedCount}</div>
                    <div className="text-sm text-gray-400 font-bold">Failed/Offline</div>
                </div>
            </div>
        </div>
    );
};