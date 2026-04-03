import React, { useState } from 'react';
import type { Device } from '../types';
import { DeviceIcon } from './DeviceIcon';

interface RemoteDesktopProps {
    devices: Device[];
    onRemoteIn: (deviceId: number) => void;
}

const RemoteDesktop: React.FC<RemoteDesktopProps> = ({ devices, onRemoteIn }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredDevices = devices.filter(device => 
        device.hostname.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 bg-gray-900/50 h-full flex flex-col">
            <div className="mb-4">
                <input 
                    type="text"
                    placeholder="Search for a device..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:ring-[#39FF14] focus:border-[#39FF14]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="overflow-y-auto flex-grow">
                <ul className="space-y-2">
                    {filteredDevices.map(device => (
                        <li 
                            key={device.id}
                            className="flex items-center justify-between p-3 bg-black/50 rounded-lg border border-gray-800 hover:border-[#39FF14] transition-colors cursor-pointer"
                            onClick={() => onRemoteIn(device.id)}
                        >
                            <div className="flex items-center gap-3">
                                <DeviceIcon type={device.deviceType} />
                                <span className="font-bold text-gray-100">{device.hostname}</span>
                            </div>
                            <button className="px-3 py-1 bg-[#39FF14] text-black text-xs font-semibold rounded-lg hover:bg-[#2ECC10] transition duration-200">
                                Connect
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default RemoteDesktop;