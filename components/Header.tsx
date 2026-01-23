
import React from 'react';

interface HeaderProps {
    selectedDeviceIds: Set<number>;
    onWakeOnLan: (deviceIds: Set<number>) => void;
}

export const Header: React.FC<HeaderProps> = ({ selectedDeviceIds, onWakeOnLan }) => {
    const hasSelection = selectedDeviceIds.size > 0;

    return (
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700 gap-4">
            <div>
                <h1 className="text-2xl font-bold text-cyan-400">Secure Deployment Runner</h1>
                <p className="text-sm text-slate-400">Hospital Network - Remote Deployment Interface</p>
            </div>
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => onWakeOnLan(selectedDeviceIds)}
                    disabled={!hasSelection}
                    className="px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                >
                    Wake-on-LAN ({selectedDeviceIds.size})
                </button>
                <div className="flex items-center space-x-2">
                     <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                     <span className="text-sm font-medium text-green-400">System Online</span>
                </div>
            </div>
        </header>
    );
};
