
import React, { useState } from 'react';
import type { ImagingDevice, DeploymentRun, ComplianceResult } from '../types';
import { ImageRack } from './ImageRack';
import { ImageTrends } from './ImageTrends';

interface ImageMonitorProps {
    devices: ImagingDevice[];
    history: DeploymentRun[];
    onTransferAllCompleted: () => void;
    onTransferSelected: (ids: Set<string>) => void;
    onClearSelected: (ids: Set<string>) => void;
    onRenameDevice: (deviceId: string, newHostname: string) => void;
    onRemoveDevice: (deviceId: string) => void;
    onShowComplianceDetails: (result: ComplianceResult) => void;
    onShowAllComplianceDetails: () => void;
    onShowPassedComplianceDetails: () => void;
    onRevalidateDevices: (deviceIds: Set<string>) => void;
}

export const ImageMonitor: React.FC<ImageMonitorProps> = ({ devices, history, onTransferAllCompleted, onTransferSelected, onClearSelected, onRenameDevice, onRemoveDevice, onShowComplianceDetails, onShowAllComplianceDetails, onShowPassedComplianceDetails, onRevalidateDevices }) => {
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'rack' | 'trends'>('rack');
    
    const imagingCount = devices.filter(d => d.status === 'Imaging').length;
    const completedCount = devices.filter(d => d.status === 'Completed').length;
    const failedCount = devices.filter(d => d.status === 'Failed').length;
    
    const handleDeviceSelect = (deviceId: string) => {
        setSelectedDeviceIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(deviceId)) {
                newSet.delete(deviceId);
            } else {
                newSet.add(deviceId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (select: boolean) => {
        if (select) {
            setSelectedDeviceIds(new Set(devices.map(d => d.id)));
        } else {
            setSelectedDeviceIds(new Set());
        }
    };

    const handleTransferSelected = () => {
        onTransferSelected(selectedDeviceIds);
        setSelectedDeviceIds(new Set());
    };

    const handleClearSelected = () => {
        onClearSelected(selectedDeviceIds);
        setSelectedDeviceIds(new Set());
    };

    const handleRevalidateSelected = () => {
        onRevalidateDevices(selectedDeviceIds);
        setSelectedDeviceIds(new Set());
    };

    const handleTransferSingleDevice = (deviceId: string) => {
        onTransferSelected(new Set([deviceId]));
        setSelectedDeviceIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(deviceId);
            return newSet;
        });
    };
    
    const TabButton: React.FC<{tabName: 'rack' | 'trends', label: string, icon: React.ReactNode}> = ({ tabName, label, icon }) => (
      <button
        onClick={() => setActiveTab(tabName)}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-colors duration-200 ${
          activeTab === tabName
            ? 'border-[#39FF14] text-[#39FF14]'
            : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
        }`}
      >
        {icon}
        {label}
      </button>
    );

    const completedDevicesWithChecks = devices.filter(d => d.status === 'Completed' && d.complianceCheck).length;
    const passedDevicesCount = devices.filter(d => d.complianceCheck?.status === 'Passed').length;

    return (
        <div className="flex flex-col gap-8">
            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-[#39FF14]">Live Image Monitor</h2>
                        <p className="text-sm text-gray-400 font-bold">
                            Tracking devices from the imaging task sequence. Ready to receive live data from the network share.
                        </p>
                    </div>
                     {completedCount > 0 && activeTab === 'rack' && (
                        <button
                            onClick={onTransferAllCompleted}
                            className="px-6 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#2ECC10] transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-[#39FF14] focus:ring-opacity-50"
                        >
                            Transfer {completedCount} Completed Device(s)
                        </button>
                    )}
                </div>
                 <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-black/50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-gray-100">{devices.length}</div>
                        <div className="text-sm text-gray-400 font-bold">Total Detected</div>
                    </div>
                    <div className="bg-black/50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-[#39FF14] animate-pulse">{imagingCount}</div>
                        <div className="text-sm text-gray-400 font-bold">Imaging</div>
                    </div>
                    <div className="bg-black/50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-gray-100">{completedCount}</div>
                        <div className="text-sm text-gray-400 font-bold">Completed</div>
                    </div>
                    <div className="bg-black/50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-red-400">{failedCount}</div>
                        <div className="text-sm text-gray-400 font-bold">Failed</div>
                    </div>
                </div>
            </div>
            
            {selectedDeviceIds.size > 0 && activeTab === 'rack' && (
                <div className="bg-gray-950 p-4 rounded-lg shadow-lg border border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-4 z-10">
                    <p className="text-sm font-semibold text-[#39FF14]">
                        {selectedDeviceIds.size} device{selectedDeviceIds.size > 1 ? 's' : ''} selected
                    </p>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleRevalidateSelected}
                            className="px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-lg hover:bg-gray-500 transition duration-200 shadow-md"
                            title="Re-run the compliance check on selected devices."
                        >
                            Re-validate Selected
                        </button>
                        <button
                            onClick={handleTransferSelected}
                            className="px-4 py-2 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#2ECC10] transition duration-200 shadow-md"
                            title="Transfer selected completed devices to the runner tab."
                        >
                            Transfer Selected
                        </button>
                        <button
                            onClick={handleClearSelected}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition duration-200 shadow-md"
                             title="Remove selected devices from this view."
                        >
                            Clear Selected
                        </button>
                    </div>
                </div>
            )}

            <div className="flex border-b border-gray-800">
                <TabButton tabName="rack" label="Rack View" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>} />
                <TabButton tabName="trends" label="Trends & Analytics" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11h1.447c.527 0 .949-.422.949-.949V6.447c0-.527-.422-.949-.949-.949H2V11zm1.447-6.553H2V3h1.447c.527 0 .949.422.949.949v1.504c0 .527-.422.949-.949.949zM6 3v2.553c0 .527.422.949.949.949H8.396c.527 0 .949-.422.949-.949V3H6zm.949 6.447H6V17h3.396v-1.504c0-.527-.422-.949-.949-.949H6.949zm4.604-5.5V3h3.396v2.553c0 .527.422.949.949.949h1.447c.527 0 .949-.422.949-.949V3H18v2.553c0 .527-.422-.949-.949.949h-1.447a.949.949 0 01-.949-.949V3h-2.447v2.553c0 .527.422.949.949.949H14.5c.527 0 .949.422.949.949V11h-4.447v-1.504c0-.527.422-.949.949-.949h.001c.527 0 .949.422.949.949V11h-1.447v-1.504c0-.527-.422-.949-.949-.949h-1.447a.949.949 0 00-.949.949V11H6.949V9.447c0-.527.422-.949.949-.949H8.396c.527 0 .949.422.949.949V11h1.155V6.447c0-.527-.422-.949-.949-.949h-1.447a.949.949 0 01-.949-.949zM18 11h-1.447c-.527 0-.949.422-.949.949v1.504c0 .527.422.949.949.949H18V11zm-1.447 5.553H18V17h-1.447c-.527 0-.949-.422-.949-.949v-1.504c0-.527.422.949.949-.949z" /></svg>} />
            </div>

            <div className="mt-6">
                {activeTab === 'rack' && (
                    <>
                    <ImageRack
                        devices={devices} 
                        selectedDeviceIds={selectedDeviceIds}
                        onSelectDevice={handleDeviceSelect}
                        onSelectAll={handleSelectAll}
                        onTransferDevice={handleTransferSingleDevice}
                        onRenameDevice={onRenameDevice}
                        onRemoveDevice={onRemoveDevice}
                        onShowComplianceDetails={onShowComplianceDetails}
                        onRevalidateDevice={(deviceId) => onRevalidateDevices(new Set([deviceId]))}
                    />
                    {completedCount > 0 && (
                        <div className="mt-8 flex justify-center items-center gap-4">
                            <button
                                onClick={onShowAllComplianceDetails}
                                disabled={completedDevicesWithChecks === 0}
                                title={completedDevicesWithChecks === 0 ? "Waiting for compliance checks to complete..." : "View a detailed report of all completed devices"}
                                className="px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-opacity-50 disabled:bg-gray-900 disabled:text-gray-600 disabled:cursor-not-allowed"
                            >
                                View All Reports ({completedDevicesWithChecks}/{completedCount})
                            </button>
                             <button
                                onClick={onShowPassedComplianceDetails}
                                disabled={passedDevicesCount === 0}
                                title={passedDevicesCount === 0 ? "No devices have passed compliance checks yet." : "View a detailed report of all passed devices"}
                                className="px-6 py-3 bg-[#1A4314] text-[#39FF14] font-semibold rounded-lg hover:bg-[#20551A] transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-[#39FF14] focus:ring-opacity-50 disabled:bg-gray-900 disabled:text-gray-600 disabled:cursor-not-allowed"
                            >
                                View Passed Reports ({passedDevicesCount})
                            </button>
                        </div>
                    )}
                    </>
                )}
                {activeTab === 'trends' && (
                    <ImageTrends history={history} />
                )}
            </div>
        </div>
    );
};
