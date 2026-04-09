import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { calculateAnalytics } from './DeploymentAnalytics';

export const SystemInfoModal: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { runner } = state;
    const analytics = calculateAnalytics(runner.history);

    const totalDevicesScanned = runner.history.reduce((acc, run) => acc + run.totalDevices, 0);

    const handleClose = () => {
        dispatch({ type: 'SET_SYSTEM_INFO_MODAL_OPEN', payload: false });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-2xl text-white">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-[#39FF14]">System-Wide Information</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="bg-black/50 p-4 rounded-lg">
                        <h3 className="text-sm font-bold uppercase text-gray-400">Total Devices Scanned</h3>
                        <p className="text-3xl font-bold mt-2">{totalDevicesScanned}</p>
                    </div>
                    <div className="bg-black/50 p-4 rounded-lg">
                        <h3 className="text-sm font-bold uppercase text-gray-400">Overall Success Rate</h3>
                        <p className="text-3xl font-bold text-[#39FF14] mt-2">{analytics.averageSuccessRate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-black/50 p-4 rounded-lg">
                        <h3 className="text-sm font-bold uppercase text-gray-400">Total Deployment Runs</h3>
                        <p className="text-3xl font-bold mt-2">{runner.history.length}</p>
                    </div>
                </div>
                <div className="mt-6">
                    <h3 className="text-lg font-bold text-gray-300 mb-2">Deployment History Summary</h3>
                    <div className="bg-black/50 p-4 rounded-lg max-h-64 overflow-y-auto">
                        {runner.history.length > 0 ? (
                            <ul className="space-y-2">
                                {runner.history.map(run => (
                                    <li key={run.id} className="text-sm text-gray-400 flex justify-between">
                                        <span>{run.endTime.toLocaleString()}</span>
                                        <span className="font-semibold">{run.totalDevices} devices - {run.successRate.toFixed(1)}% success</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 text-center">No deployment history available.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
