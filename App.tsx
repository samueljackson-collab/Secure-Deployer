

import React from 'react';
import { Header } from './components/Header';
import { StepCard } from './components/StepCard';
import { DeploymentProgress } from './components/DeploymentProgress';
import { DeviceStatusTable } from './components/DeviceStatusTable';
import { LogViewer } from './components/LogViewer';
import { BulkActions } from './components/BulkActions';
import { DeploymentHistory } from './components/DeploymentHistory';
import { SecureCredentialModal } from './components/SecureCredentialModal';
import { ImageMonitor } from './components/ImageMonitor';
import { BuildOutput } from './components/BuildOutput';
import { ImagingScriptViewer } from './components/ImagingScriptViewer';
import { ComplianceDetailsModal } from './components/ComplianceDetailsModal';
import { AllComplianceDetailsModal } from './components/AllComplianceDetailsModal';
import { PassedComplianceDetailsModal } from './components/PassedComplianceDetailsModal';
import { RescanConfirmationModal } from './components/RescanConfirmationModal';
// FIX: Import DeviceFormFactor type
import type { Credentials, Device, ImagingDevice, DeviceFormFactor } from './types';
import { AppProvider, useAppContext } from './contexts/AppContext';

// FIX: Exported constants to be used across the application for compliance checks.
export const TARGET_BIOS_VERSION = 'A24';
export const TARGET_DCU_VERSION = '5.1.0';
export const TARGET_WIN_VERSION = '23H2';

// FIX: Exported function to determine device type from hostname.
export const detectDeviceType = (hostname: string): DeviceFormFactor => {
    const lowerHostname = hostname.toLowerCase();
    if (lowerHostname.includes('l14') || lowerHostname.includes('lap14')) return 'laptop-14';
    if (lowerHostname.includes('l16') || lowerHostname.includes('lap16')) return 'laptop-16';
    if (lowerHostname.includes('lap') || lowerHostname.includes('lt')) return 'laptop';
    if (lowerHostname.includes('sff')) return 'sff';
    if (lowerHostname.includes('micro')) return 'micro';
    if (lowerHostname.includes('twr') || lowerHostname.includes('tower')) return 'tower';
    if (lowerHostname.includes('wyse')) return 'wyse';
    if (lowerHostname.includes('vdi')) return 'vdi';
    if (lowerHostname.includes('detach')) return 'detachable';
    return 'desktop';
};

const AppContent: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { runner, monitor, ui } = state;

    const isReadyToDeploy = ui.csvFile || runner.devices.length > 0;

    const TabButton: React.FC<{tabName: 'monitor' | 'runner' | 'build' | 'script', label: string, icon: React.ReactNode}> = ({ tabName, label, icon }) => (
      <button
        onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tabName })}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-colors duration-200 ${
          ui.activeTab === tabName
            ? 'border-[#39FF14] text-[#39FF14]'
            : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
        }`}
      >
        {icon}
        {label}
      </button>
    );

    return (
        <div className="min-h-screen bg-black text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <Header selectedDeviceIds={runner.selectedDeviceIds} onWakeOnLan={(ids) => dispatch({ type: 'WAKE_ON_LAN', payload: ids })} />
            <div className="mt-6">
                <div className="flex border-b border-gray-800 flex-wrap">
                    <TabButton tabName="monitor" label="Image Monitor" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>} />
                    <TabButton tabName="runner" label="Deployment Runner" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" /></svg>} />
                    <TabButton tabName="script" label="Imaging Script" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>} />
                    <TabButton tabName="build" label="Build Output" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v1H5V4zM5 7h10v9a2 2 0 01-2 2H7a2 2 0 01-2-2V7z" /><path d="M10 11a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z" /></svg>} />
                </div>
            </div>

            <main className="mt-8">
                {ui.activeTab === 'monitor' && (
                    <ImageMonitor 
                        devices={monitor.devices}
                        history={runner.history}
                        onTransferAllCompleted={() => dispatch({ type: 'TRANSFER_ALL_COMPLETED_DEVICES' })}
                        onTransferSelected={(ids) => dispatch({ type: 'TRANSFER_SELECTED_IMAGING_DEVICES', payload: ids })}
                        onClearSelected={(ids) => dispatch({ type: 'CLEAR_SELECTED_IMAGING_DEVICES', payload: ids })}
                        onRenameDevice={(deviceId, newHostname) => dispatch({ type: 'RENAME_IMAGING_DEVICE', payload: { deviceId, newHostname }})}
                        onRemoveDevice={(deviceId) => dispatch({ type: 'REMOVE_IMAGING_DEVICE', payload: deviceId })}
                        onShowComplianceDetails={(result) => dispatch({ type: 'SHOW_COMPLIANCE_DETAILS', payload: result })}
                        onShowAllComplianceDetails={() => dispatch({ type: 'SET_ALL_COMPLIANCE_MODAL_OPEN', payload: true })}
                        onShowPassedComplianceDetails={() => dispatch({ type: 'SET_PASSED_COMPLIANCE_MODAL_OPEN', payload: true })}
                        onRevalidateDevices={(deviceIds) => dispatch({ type: 'REVALIDATE_IMAGING_DEVICES', payload: deviceIds })}
                    />
                )}
                {ui.activeTab === 'runner' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 flex flex-col gap-8">
                            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800">
                                <h2 className="text-xl font-bold text-[#39FF14] mb-4 border-b border-gray-700 pb-2">Configuration</h2>
                                <div className="space-y-6">
                                    <StepCard step="1" title="Select Device List" description="Upload CSV for scanning or use transferred devices.">
                                        <input type="file" accept=".csv" onChange={(e) => dispatch({ type: 'SET_CSV_FILE', payload: e.target.files?.[0] || null })} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-[#39FF14] hover:file:bg-gray-700 w-full text-sm text-gray-400 font-bold"/>
                                        {ui.csvFile && <p className="text-xs text-[#39FF14] mt-2">Selected: {ui.csvFile.name}</p>}
                                        {runner.devices.length > 0 && <p className="text-xs text-gray-400 font-bold mt-2">{runner.devices.filter(d => d.status === 'Pending File' || d.status === 'Ready for Execution').length} device(s) ready for deployment.</p>}
                                    </StepCard>
                                    <StepCard step="2" title="Advanced Settings" description="Configure connection and reboot behavior.">
                                        <div className="space-y-3 pt-2">
                                             <div className="flex items-center justify-between">
                                                <label htmlFor="maxRetries" className="text-sm text-gray-300 font-bold">Max Retries</label>
                                                <input 
                                                    type="number" 
                                                    id="maxRetries" 
                                                    value={runner.settings.maxRetries}
                                                    onChange={(e) => dispatch({ type: 'SET_SETTINGS', payload: { maxRetries: Math.max(1, parseInt(e.target.value, 10)) } })}
                                                    className="w-20 bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-center"
                                                />
                                            </div>
                                             <div className="flex items-center justify-between">
                                                <label htmlFor="retryDelay" className="text-sm text-gray-300 font-bold">Retry Delay (sec)</label>
                                                <input 
                                                    type="number" 
                                                    id="retryDelay"
                                                    value={runner.settings.retryDelay}
                                                    onChange={(e) => dispatch({ type: 'SET_SETTINGS', payload: { retryDelay: Math.max(1, parseInt(e.target.value, 10)) } })}
                                                    className="w-20 bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-center"
                                                />
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    id="autoReboot"
                                                    type="checkbox"
                                                    checked={runner.settings.autoRebootEnabled}
                                                    onChange={(e) => dispatch({ type: 'SET_SETTINGS', payload: { autoRebootEnabled: e.target.checked } })}
                                                    className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-2 focus:ring-[#39FF14] focus:ring-offset-2 focus:ring-offset-gray-950 cursor-pointer"
                                                />
                                                <label htmlFor="autoReboot" className="ml-3 text-sm text-gray-300 cursor-pointer font-bold">
                                                    Automatically reboot when required
                                                </label>
                                            </div>
                                        </div>
                                    </StepCard>
                                </div>
                            </div>
                             <DeploymentHistory history={runner.history} />
                        </div>
                        <div className="lg:col-span-2 flex flex-col gap-8">
                            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-[#39FF14]">Deployment Status</h2>
                                    <div className="flex gap-2">
                                        {runner.deploymentState === 'running' ? (
                                            <button onClick={() => dispatch({ type: 'CANCEL_DEPLOYMENT' })} className="px-4 py-2 bg-red-600 rounded-lg">Cancel</button>
                                        ) : (
                                            <>
                                                <button onClick={() => dispatch({ type: 'RESCAN_ALL_DEVICES_PROMPT' })} disabled={runner.devices.length === 0} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed hover:bg-gray-500">Re-Scan All</button>
                                                <button onClick={() => dispatch({ type: 'START_DEPLOYMENT_PROMPT' })} disabled={!isReadyToDeploy} className="px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg disabled:bg-gray-700">Start Scan</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <DeploymentProgress devices={runner.devices} />
                            </div>
                            <BulkActions selectedCount={runner.selectedDeviceIds.size} onUpdate={() => dispatch({ type: 'BULK_UPDATE' })} onCancel={() => dispatch({ type: 'BULK_CANCEL' })} onValidate={() => dispatch({ type: 'BULK_VALIDATE' })} onExecute={() => dispatch({ type: 'BULK_EXECUTE' })} onRemove={() => dispatch({ type: 'BULK_REMOVE' })} />
                            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 flex-grow min-h-[400px] flex flex-col">
                                <h2 className="text-xl font-bold text-[#39FF14] mb-4 border-b border-gray-700 pb-2">Live Logs & Device Status</h2>
                                <div className="grid xl:grid-cols-2 gap-6 flex-grow min-h-0">
                                     <DeviceStatusTable 
                                        devices={runner.devices} 
                                        onUpdateDevice={(id) => dispatch({ type: 'UPDATE_DEVICE', payload: id })} 
                                        onRebootDevice={(id) => dispatch({ type: 'REBOOT_DEVICE', payload: id })} 
                                        onValidateDevice={(id) => dispatch({ type: 'VALIDATE_DEVICES', payload: new Set([id])})} 
                                        onSetScriptFile={(deviceId, file) => dispatch({ type: 'SET_SCRIPT_FILE', payload: { deviceId, file }})} 
                                        onExecuteScript={(id) => dispatch({ type: 'EXECUTE_SCRIPT', payload: id })} 
                                        selectedDeviceIds={runner.selectedDeviceIds} 
                                        onDeviceSelect={(id) => dispatch({ type: 'TOGGLE_DEVICE_SELECTION', payload: id })} 
                                        onSelectAll={(select) => dispatch({ type: 'SELECT_ALL_DEVICES', payload: select })} 
                                     />
                                     <LogViewer logs={runner.logs} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {ui.activeTab === 'build' && <BuildOutput />}
                {ui.activeTab === 'script' && <ImagingScriptViewer />}
            </main>
            <SecureCredentialModal 
                isOpen={ui.isCredentialModalOpen} 
                onClose={() => dispatch({ type: 'SET_CREDENTIAL_MODAL_OPEN', payload: false })} 
                onConfirm={(credentials: Credentials) => dispatch({ type: 'START_DEPLOYMENT_CONFIRMED', payload: credentials })}
            />
            <ComplianceDetailsModal
                isOpen={ui.isComplianceModalOpen}
                onClose={() => dispatch({ type: 'SET_COMPLIANCE_MODAL_OPEN', payload: false })}
                result={ui.selectedComplianceResult}
            />
            <AllComplianceDetailsModal
                isOpen={ui.isAllComplianceModalOpen}
                onClose={() => dispatch({ type: 'SET_ALL_COMPLIANCE_MODAL_OPEN', payload: false })}
                devices={monitor.devices}
            />
            <PassedComplianceDetailsModal
                isOpen={ui.isPassedComplianceModalOpen}
                onClose={() => dispatch({ type: 'SET_PASSED_COMPLIANCE_MODAL_OPEN', payload: false })}
                devices={monitor.devices.filter(d => d.complianceCheck?.status === 'Passed')}
            />
            <RescanConfirmationModal
                isOpen={ui.isRescanModalOpen}
                onClose={() => dispatch({ type: 'SET_RESCAN_MODAL_OPEN', payload: false })}
                onConfirm={() => dispatch({ type: 'RESCAN_ALL_DEVICES_CONFIRMED' })}
                deviceCount={runner.devices.length}
            />
        </div>
    );
};

const App: React.FC = () => {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};

export default App;