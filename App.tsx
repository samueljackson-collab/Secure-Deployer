

import React, { useState } from 'react';
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
import { SystemInfoModal } from './components/SystemInfoModal';
import { RemoteConnect } from './components/RemoteConnect';
import { InfoIcon } from './components/Tooltip';
import type { ActiveTab, Credentials } from './types';
import { AppProvider, useAppContext } from './contexts/AppContext';

// Compliance version targets — imported by deploymentService for consistency
export const TARGET_BIOS_VERSION = 'A24';
export const TARGET_DCU_VERSION = '5.1.0';
export const TARGET_WIN_VERSION = '23H2';

// --- Settings Section ---
// Collapsible settings group for the Advanced Settings panel
const SettingSection: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = true, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-gray-800 rounded-md overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-900 text-xs font-bold text-gray-400 uppercase tracking-wide hover:bg-gray-800 transition-colors"
            >
                {title}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && <div className="p-3 space-y-3 bg-black/20">{children}</div>}
        </div>
    );
};

// Row with label + optional InfoIcon + control aligned right
const SettingRow: React.FC<{ label: string; tooltip: string; children: React.ReactNode }> = ({ label, tooltip, children }) => (
    <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <label className="text-sm text-gray-300 font-bold">{label}</label>
            <InfoIcon tooltip={tooltip} />
        </div>
        <div className="flex-shrink-0">{children}</div>
    </div>
);

// --- Main App Content ---

const AppContent: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { runner, monitor, ui } = state;

    const isReadyToDeploy = ui.csvFile || runner.devices.length > 0;

    const TabButton: React.FC<{ tabName: ActiveTab; label: string; icon: React.ReactNode; tooltip: string }> = ({ tabName, label, icon, tooltip }) => (
        <button
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tabName })}
            title={tooltip}
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

    const numInput = (value: number, min: number, max: number, onChange: (v: number) => void) => (
        <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={e => onChange(Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)))}
            className="w-20 bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-center text-gray-200 focus:outline-none focus:border-[#39FF14]"
        />
    );

    return (
        <div className="min-h-screen bg-black text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <Header selectedDeviceIds={runner.selectedDeviceIds} onWakeOnLan={(ids) => dispatch({ type: 'WAKE_ON_LAN', payload: ids })} />
            <div className="mt-6">
                <div className="flex border-b border-gray-800 flex-wrap">
                    <TabButton
                        tabName="monitor"
                        label="Image Monitor"
                        tooltip="Monitor active imaging devices and transfer completed devices to the Deployment Runner."
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>}
                    />
                    <TabButton
                        tabName="runner"
                        label="Deployment Runner"
                        tooltip="Scan, validate, and push updates to devices. Upload a CSV or transfer devices from Image Monitor."
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" /></svg>}
                    />
                    <TabButton
                        tabName="remote"
                        label="Remote Connect"
                        tooltip="Download RDP files, view SSH commands, and send Wake-on-LAN packets to individual devices."
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                    />
                    <TabButton
                        tabName="script"
                        label="Imaging Script"
                        tooltip="View and export the PowerShell imaging script used to provision new devices."
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>}
                    />
                    <TabButton
                        tabName="build"
                        label="Build Output"
                        tooltip="Review the current application build configuration and output."
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v1H5V4zM5 7h10v9a2 2 0 01-2 2H7a2 2 0 01-2-2V7z" /><path d="M10 11a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z" /></svg>}
                    />
                </div>
            </div>

            <main className="mt-8">
                {ui.activeTab === 'monitor' && (
                    <ImageMonitor
                        devices={monitor.devices}
                        history={runner.history}
                        rackConfig={monitor.rackConfig}
                        onTransferAllCompleted={() => dispatch({ type: 'TRANSFER_ALL_COMPLETED_DEVICES' })}
                        onTransferSelected={(ids) => dispatch({ type: 'TRANSFER_SELECTED_IMAGING_DEVICES', payload: ids })}
                        onClearSelected={(ids) => dispatch({ type: 'CLEAR_SELECTED_IMAGING_DEVICES', payload: ids })}
                        onRenameDevice={(deviceId, newHostname) => dispatch({ type: 'RENAME_IMAGING_DEVICE', payload: { deviceId, newHostname } })}
                        onRemoveDevice={(deviceId) => dispatch({ type: 'REMOVE_IMAGING_DEVICE', payload: deviceId })}
                        onShowComplianceDetails={(result) => dispatch({ type: 'SHOW_COMPLIANCE_DETAILS', payload: result })}
                        onShowAllComplianceDetails={() => dispatch({ type: 'SET_ALL_COMPLIANCE_MODAL_OPEN', payload: true })}
                        onShowPassedComplianceDetails={() => dispatch({ type: 'SET_PASSED_COMPLIANCE_MODAL_OPEN', payload: true })}
                        onRevalidateDevices={(deviceIds) => dispatch({ type: 'REVALIDATE_IMAGING_DEVICES', payload: deviceIds })}
                        onAddRack={() => dispatch({ type: 'ADD_RACK' })}
                        onRemoveRack={(rackId) => dispatch({ type: 'REMOVE_RACK', payload: rackId })}
                        onSetSlotsPerRack={(rackId, slotsPerRack) => dispatch({ type: 'SET_SLOTS_PER_RACK', payload: { rackId, slotsPerRack } })}
                    />
                )}

                {ui.activeTab === 'runner' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 flex flex-col gap-8">
                            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800">
                                <h2 className="text-xl font-bold text-[#39FF14] mb-4 border-b border-gray-700 pb-2">Configuration</h2>
                                <div className="space-y-6">
                                    <StepCard step="1" title="Select Device List" description="Upload CSV for scanning or use transferred devices.">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => dispatch({ type: 'SET_CSV_FILE', payload: e.target.files?.[0] || null })}
                                            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-[#39FF14] hover:file:bg-gray-700 w-full text-sm text-gray-400 font-bold"
                                        />
                                        {ui.csvFile && <p className="text-xs text-[#39FF14] mt-2">Selected: {ui.csvFile.name}</p>}
                                        {runner.devices.length > 0 && (
                                            <p className="text-xs text-gray-400 font-bold mt-2">
                                                {runner.devices.filter(d => d.status === 'Pending File' || d.status === 'Ready for Execution').length} device(s) ready for deployment.
                                            </p>
                                        )}
                                    </StepCard>

                                    <StepCard step="2" title="Advanced Settings" description="Configure scan, reboot, WoL, and display behavior.">
                                        <div className="space-y-3 pt-2">
                                            {/* Scan Settings */}
                                            <SettingSection title="Scan" defaultOpen={true}>
                                                <SettingRow label="Max Retries" tooltip="Number of times to retry connecting to an unreachable device before marking it as Failed.">
                                                    {numInput(runner.settings.maxRetries, 1, 10, v => dispatch({ type: 'SET_SETTINGS', payload: { maxRetries: v } }))}
                                                </SettingRow>
                                                <SettingRow label="Retry Delay (sec)" tooltip="Seconds to wait between each connection retry attempt. Increase on slow networks.">
                                                    {numInput(runner.settings.retryDelay, 1, 60, v => dispatch({ type: 'SET_SETTINGS', payload: { retryDelay: v } }))}
                                                </SettingRow>
                                                <SettingRow label="Conn. Timeout (sec)" tooltip="Seconds to wait for an initial connection response before considering the device unreachable.">
                                                    {numInput(runner.settings.connectionTimeout, 5, 120, v => dispatch({ type: 'SET_SETTINGS', payload: { connectionTimeout: v } }))}
                                                </SettingRow>
                                                <SettingRow label="Parallel Scans" tooltip="How many devices to scan simultaneously. Higher values finish faster but increase network load. Start with 1 on congested networks.">
                                                    {numInput(runner.settings.parallelScanCount, 1, 10, v => dispatch({ type: 'SET_SETTINGS', payload: { parallelScanCount: v } }))}
                                                </SettingRow>
                                            </SettingSection>

                                            {/* Reboot Settings */}
                                            <SettingSection title="Reboot" defaultOpen={false}>
                                                <SettingRow
                                                    label="Auto Reboot"
                                                    tooltip="Automatically reboot devices after applying BIOS, DCU, or Windows updates that require a restart."
                                                >
                                                    <input
                                                        id="autoReboot"
                                                        type="checkbox"
                                                        checked={runner.settings.autoRebootEnabled}
                                                        onChange={e => dispatch({ type: 'SET_SETTINGS', payload: { autoRebootEnabled: e.target.checked } })}
                                                        className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-2 focus:ring-[#39FF14] focus:ring-offset-2 focus:ring-offset-gray-950 cursor-pointer"
                                                    />
                                                </SettingRow>
                                                <SettingRow label="Reboot Delay (sec)" tooltip="Seconds to wait after issuing the reboot command before the runner proceeds to the next step.">
                                                    {numInput(runner.settings.rebootDelay, 10, 300, v => dispatch({ type: 'SET_SETTINGS', payload: { rebootDelay: v } }))}
                                                </SettingRow>
                                                <SettingRow label="Max Reboot Wait (sec)" tooltip="Maximum seconds to wait for a device to come back online after a reboot before marking it as timed out.">
                                                    {numInput(runner.settings.maxRebootWait, 30, 600, v => dispatch({ type: 'SET_SETTINGS', payload: { maxRebootWait: v } }))}
                                                </SettingRow>
                                            </SettingSection>

                                            {/* WoL Settings */}
                                            <SettingSection title="Wake-on-LAN" defaultOpen={false}>
                                                <SettingRow
                                                    label="Broadcast Address"
                                                    tooltip="Network broadcast address for WoL magic packets. Use 255.255.255.255 for all subnets, or a subnet-specific address like 192.168.1.255 for directed broadcasts."
                                                >
                                                    <input
                                                        type="text"
                                                        value={runner.settings.wolBroadcastAddress}
                                                        onChange={e => dispatch({ type: 'SET_SETTINGS', payload: { wolBroadcastAddress: e.target.value } })}
                                                        className="w-36 bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-[#39FF14]"
                                                        placeholder="255.255.255.255"
                                                    />
                                                </SettingRow>
                                                <SettingRow
                                                    label="WoL Port"
                                                    tooltip="UDP port for WoL magic packets. Standard ports are 7 (echo) and 9 (discard). Port 9 is recommended."
                                                >
                                                    {numInput(runner.settings.wolPort, 1, 65535, v => dispatch({ type: 'SET_SETTINGS', payload: { wolPort: v } }))}
                                                </SettingRow>
                                            </SettingSection>

                                            {/* Display Settings */}
                                            <SettingSection title="Display" defaultOpen={false}>
                                                <SettingRow
                                                    label="Compact View"
                                                    tooltip="Reduces device card height and spacing to fit more devices on screen at once."
                                                >
                                                    <input
                                                        id="compactView"
                                                        type="checkbox"
                                                        checked={runner.settings.compactView}
                                                        onChange={e => dispatch({ type: 'SET_SETTINGS', payload: { compactView: e.target.checked } })}
                                                        className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-2 focus:ring-[#39FF14] focus:ring-offset-2 focus:ring-offset-gray-950 cursor-pointer"
                                                    />
                                                </SettingRow>
                                                <SettingRow
                                                    label="Show Offline Devices"
                                                    tooltip="When disabled, devices marked as Offline or Failed are hidden from the device table to reduce clutter."
                                                >
                                                    <input
                                                        id="showOfflineDevices"
                                                        type="checkbox"
                                                        checked={runner.settings.showOfflineDevices}
                                                        onChange={e => dispatch({ type: 'SET_SETTINGS', payload: { showOfflineDevices: e.target.checked } })}
                                                        className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-2 focus:ring-[#39FF14] focus:ring-offset-2 focus:ring-offset-gray-950 cursor-pointer"
                                                    />
                                                </SettingRow>
                                                <SettingRow
                                                    label="Log Level Filter"
                                                    tooltip="Minimum severity of log messages shown in the Live Log. ERROR shows only errors; ALL shows every message."
                                                >
                                                    <select
                                                        value={runner.settings.logLevelFilter}
                                                        onChange={e => dispatch({ type: 'SET_SETTINGS', payload: { logLevelFilter: e.target.value as typeof runner.settings.logLevelFilter } })}
                                                        className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-[#39FF14]"
                                                    >
                                                        <option value="ALL">All</option>
                                                        <option value="INFO">Info+</option>
                                                        <option value="WARNING">Warning+</option>
                                                        <option value="ERROR">Error only</option>
                                                    </select>
                                                </SettingRow>
                                            </SettingSection>
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
                                            <button onClick={() => dispatch({ type: 'CANCEL_DEPLOYMENT' })} className="px-4 py-2 bg-red-600 rounded-lg text-white font-semibold text-sm hover:bg-red-500 transition-colors">Cancel</button>
                                        ) : (
                                            <>
                                                <button onClick={() => dispatch({ type: 'RESCAN_ALL_DEVICES_PROMPT' })} disabled={runner.devices.length === 0} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed hover:bg-gray-500 text-sm">Re-Scan All</button>
                                                <button onClick={() => dispatch({ type: 'START_DEPLOYMENT_PROMPT' })} disabled={!isReadyToDeploy} className="px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-sm">Start Scan</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <DeploymentProgress devices={runner.devices} />
                            </div>
                            <BulkActions
                                selectedCount={runner.selectedDeviceIds.size}
                                onUpdate={() => dispatch({ type: 'BULK_UPDATE' })}
                                onCancel={() => dispatch({ type: 'BULK_CANCEL' })}
                                onValidate={() => dispatch({ type: 'BULK_VALIDATE' })}
                                onExecute={() => dispatch({ type: 'BULK_EXECUTE' })}
                                onRemove={() => dispatch({ type: 'BULK_REMOVE' })}
                                onDeployOperation={(payload) => dispatch({ type: 'BULK_DEPLOY_OPERATION', payload })}
                            />
                            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 flex-grow min-h-[400px] flex flex-col">
                                <h2 className="text-xl font-bold text-[#39FF14] mb-4 border-b border-gray-700 pb-2">Live Logs & Device Status</h2>
                                <div className="grid xl:grid-cols-2 gap-6 flex-grow min-h-0">
                                    <DeviceStatusTable
                                        devices={runner.devices}
                                        onUpdateDevice={(id) => dispatch({ type: 'UPDATE_DEVICE', payload: id })}
                                        onRebootDevice={(id) => dispatch({ type: 'REBOOT_DEVICE', payload: id })}
                                        onValidateDevice={(id) => dispatch({ type: 'VALIDATE_DEVICES', payload: new Set([id]) })}
                                        onSetScriptFile={(deviceId, file) => dispatch({ type: 'SET_SCRIPT_FILE', payload: { deviceId, file } })}
                                        onExecuteScript={(id) => dispatch({ type: 'EXECUTE_SCRIPT', payload: id })}
                                        onRemoteIn={(id) => dispatch({ type: 'REMOTE_IN_DEVICE', payload: id })}
                                        selectedDeviceIds={runner.selectedDeviceIds}
                                        onDeviceSelect={(id) => dispatch({ type: 'TOGGLE_DEVICE_SELECTION', payload: id })}
                                        onSelectAll={(select) => dispatch({ type: 'SELECT_ALL_DEVICES', payload: select })}
                                        deploymentState={runner.deploymentState}
                                        compactView={runner.settings.compactView}
                                        showOfflineDevices={runner.settings.showOfflineDevices}
                                    />
                                    <LogViewer logs={runner.logs} globalLevelFilter={runner.settings.logLevelFilter} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {ui.activeTab === 'remote' && (
                    <RemoteConnect devices={runner.devices} />
                )}

                {ui.activeTab === 'build' && <BuildOutput />}
                {ui.activeTab === 'script' && <ImagingScriptViewer />}
            </main>

            {/* Modals */}
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
            {ui.isSystemInfoModalOpen && <SystemInfoModal />}
        </div>
    );
};

const App: React.FC = () => (
    <AppProvider>
        <AppContent />
    </AppProvider>
);

export default App;
