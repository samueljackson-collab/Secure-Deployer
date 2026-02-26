
import React from 'react';
import { useAppContext } from '../contexts/AppContext';

interface HeaderProps {
    selectedDeviceIds: Set<number>;
    onWakeOnLan: (deviceIds: Set<number>) => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({ selectedDeviceIds, onWakeOnLan }) => {
    const { dispatch } = useAppContext();
    const hasSelection = selectedDeviceIds.size > 0;

    return (
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-950 p-4 rounded-lg shadow-lg border border-gray-800 gap-4">
            <div>
                <h1 className="text-2xl font-bold text-[#39FF14]">Secure Deployment Runner</h1>
                <p className="text-sm text-gray-400 font-bold">Hospital Network - Remote Deployment Interface</p>
            </div>
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => onWakeOnLan(selectedDeviceIds)}
                    disabled={!hasSelection}
                    className="px-4 py-2 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#2ECC10] disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-[#39FF14] focus:ring-opacity-50"
                    title={hasSelection ? `Send Wake-on-LAN signal to ${selectedDeviceIds.size} selected device(s)` : 'Select devices to send Wake-on-LAN signal'}
                >
                    Wake-on-LAN ({selectedDeviceIds.size})
                </button>
                <button
                    onClick={() => dispatch({ type: 'SET_SYSTEM_INFO_MODAL_OPEN', payload: true })}
                    className="px-4 py-2 bg-gray-700 text-white text-sm font-semibold rounded-lg hover:bg-gray-600 transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                >
                    System Info
                </button>
                <div className="flex items-center space-x-2" title="The deployment system is online and ready.">
                     <div className="w-3 h-3 bg-[#39FF14] rounded-full animate-pulse"></div>
                     <span className="text-sm font-medium text-[#39FF14]">System Online</span>
                </div>
            </div>
        </header>
    );
});
