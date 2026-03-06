import React, { useState } from 'react';
import { ImagingDevice } from '../types';
import { FileCode, Play, Save, Terminal } from 'lucide-react';

interface ImagingScriptViewerProps {
    devices: ImagingDevice[];
}

export const ImagingScriptViewer: React.FC<ImagingScriptViewerProps> = ({ devices }) => {
    const [scriptContent, setScriptContent] = useState<string>(`# Default Imaging Script
# This script runs during the imaging process

echo "Starting imaging process..."
ipconfig /all
echo "Checking disk space..."
Get-Disk
echo "Imaging complete."
`);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-12rem)]">
            <div className="lg:col-span-2 flex flex-col gap-4 h-full">
                <div className="bg-gray-950 p-4 rounded-lg shadow-lg border border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileCode className="text-[#39FF14]" />
                        <h2 className="text-xl font-bold text-white">Imaging Script Editor</h2>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 flex items-center gap-2">
                            <Save size={16} /> Save
                        </button>
                        <button className="px-4 py-2 bg-[#39FF14] text-black font-bold rounded hover:bg-[#32e612] flex items-center gap-2">
                            <Play size={16} /> Run on All
                        </button>
                    </div>
                </div>
                <div className="bg-gray-900 flex-grow rounded-lg border border-gray-800 p-4 font-mono text-sm text-gray-300 overflow-auto">
                    <textarea 
                        className="w-full h-full bg-transparent border-none outline-none resize-none"
                        value={scriptContent}
                        onChange={(e) => setScriptContent(e.target.value)}
                    />
                </div>
            </div>

            <div className="lg:col-span-1 bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 flex flex-col h-full">
                <h3 className="text-lg font-bold text-[#39FF14] mb-4 flex items-center gap-2">
                    <Terminal size={20} /> Target Devices ({devices.length})
                </h3>
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {devices.length === 0 ? (
                        <p className="text-gray-500 italic">No devices in monitor.</p>
                    ) : (
                        devices.map(device => (
                            <div key={device.id} className="p-3 bg-gray-900 rounded border border-gray-800 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-white">{device.hostname}</div>
                                    <div className="text-xs text-gray-500">{device.ipAddress}</div>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded ${
                                    device.status === 'Completed' ? 'bg-green-900 text-green-300' :
                                    device.status === 'Failed' ? 'bg-red-900 text-red-300' :
                                    'bg-blue-900 text-blue-300'
                                }`}>
                                    {device.status}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
