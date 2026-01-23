
import React from 'react';
import type { Device } from '../types';

interface DeploymentProgressProps {
    devices: Device[];
}

export const DeploymentProgress: React.FC<DeploymentProgressProps> = ({ devices }) => {
    if (devices.length === 0) {
        return <div className="text-center text-slate-400 py-4">Waiting for system scan to start...</div>;
    }

    const total = devices.length;
    const compliant = devices.filter(d => d.status === 'Success').length;
    const needsAction = devices.filter(d => d.status === 'Scan Complete').length;
    const failed = devices.filter(d => ['Failed', 'Offline'].includes(d.status)).length;

    const completedScans = compliant + needsAction + failed;
    const progress = total > 0 ? (completedScans / total) * 100 : 0;

    return (
        <div className="space-y-4">
            <div>
                <div className="flex justify-between mb-1 text-sm font-medium text-slate-300">
                    <span>Scan Progress</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-slate-700/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-slate-100">{total}</div>
                    <div className="text-sm text-slate-400">Total</div>
                </div>
                <div className="bg-slate-700/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-400">{compliant}</div>
                    <div className="text-sm text-slate-400">Compliant</div>
                </div>
                 <div className="bg-slate-700/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-400">{needsAction}</div>
                    <div className="text-sm text-slate-400">Needs Action</div>
                </div>
                <div className="bg-slate-700/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-red-400">{failed}</div>
                    <div className="text-sm text-slate-400">Failed/Offline</div>
                </div>
            </div>
        </div>
    );
};
