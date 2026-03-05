import React, { useState } from 'react';
import type { Device } from '../src/types';
import { DeviceIcon } from './DeviceIcon';
import { Search, Monitor, ArrowRight, Shield } from 'lucide-react';

interface RemoteDesktopProps {
    devices: Device[];
    onRemoteIn: (deviceId: number) => void;
}

export const RemoteDesktop: React.FC<RemoteDesktopProps> = ({ devices, onRemoteIn }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredDevices = devices.filter(device => 
        device.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (device.ipAddress && device.ipAddress.includes(searchTerm))
    );

    return (
        <div className="flex flex-col h-full bg-gray-950 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
            {/* Header Section */}
            <div className="p-6 border-b border-gray-800 bg-gray-900/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Monitor className="text-cyan-400 w-6 h-6" />
                            Remote Desktop Gateway
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">
                            Securely connect to managed devices using RDP over SSL.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">End-to-End Encrypted</span>
                    </div>
                </div>

                <div className="mt-6 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-500" />
                    </div>
                    <input 
                        type="text"
                        placeholder="Search by hostname or IP address..."
                        className="w-full bg-black/40 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Device List Section */}
            <div className="flex-grow overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-800">
                {filteredDevices.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredDevices.map(device => (
                            <div 
                                key={device.id}
                                className="group relative bg-gray-900/40 rounded-xl border border-gray-800 hover:border-cyan-500/50 hover:bg-gray-800/40 transition-all duration-300 p-4 cursor-default"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="p-2 bg-gray-800 rounded-lg group-hover:bg-cyan-500/10 transition-colors">
                                        <DeviceIcon type={device.deviceType} />
                                    </div>
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
                                        device.status === 'Offline' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    }`}>
                                        {device.status}
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 className="font-bold text-gray-100 truncate">{device.hostname}</h3>
                                    <p className="text-xs text-gray-500 font-mono mt-0.5">{device.ipAddress || 'No IP Assigned'}</p>
                                </div>

                                <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-800/50">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Model</span>
                                        <span className="text-xs text-gray-300 truncate max-w-[120px]">{device.model || 'Generic PC'}</span>
                                    </div>
                                    <button 
                                        onClick={() => onRemoteIn(device.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-cyan-900/20 active:scale-95"
                                    >
                                        Connect
                                        <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Monitor className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No devices found matching your search</p>
                        <p className="text-sm">Try adjusting your filters or search term</p>
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="px-6 py-3 bg-black/40 border-t border-gray-800 flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">
                    Showing <span className="text-gray-300">{filteredDevices.length}</span> of <span className="text-gray-300">{devices.length}</span> devices
                </span>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Online</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Offline</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
