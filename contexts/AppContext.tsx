

import React, { createContext, useReducer, useContext, useEffect, useCallback } from 'react';
import type { AppState, AppAction, AppDispatch, Device, LogEntry, ImagingDevice, DeploymentTemplate } from '../types';
import * as api from '../services/deploymentService';
import Papa from 'papaparse';

const TEMPLATES_STORAGE_KEY = 'secure_deployer_templates';

const loadTemplatesFromStorage = (): DeploymentTemplate[] => {
    try {
        const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const saveTemplatesToStorage = (templates: DeploymentTemplate[]): void => {
    try {
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    } catch {
        // Storage quota exceeded or unavailable — fail silently
    }
};

const initialState: AppState = {
    runner: {
        devices: [],
        logs: [],
        deploymentState: 'idle',
        selectedDeviceIds: new Set(),
        history: [],
        templates: loadTemplatesFromStorage(),
        settings: {
            maxRetries: 3,
            retryDelay: 2,
            autoRebootEnabled: false,
        },
        isCancelled: false,
    },
    monitor: {
        devices: [],
    },
    ui: {
        activeTab: 'monitor',
        csvFile: null,
        isCredentialModalOpen: false,
        isComplianceModalOpen: false,
        selectedComplianceResult: null,
        isAllComplianceModalOpen: false,
        isPassedComplianceModalOpen: false,
        isRescanModalOpen: false,
    },
};

const AppContext = createContext<{ state: AppState; dispatch: AppDispatch } | undefined>(undefined);

const appReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'SET_ACTIVE_TAB':
            return { ...state, ui: { ...state.ui, activeTab: action.payload } };
        case 'SET_CSV_FILE':
            return { ...state, ui: { ...state.ui, csvFile: action.payload } };
        case 'ADD_LOG':
            return { ...state, runner: { ...state.runner, logs: [...state.runner.logs, action.payload] } };
        case 'SET_SETTINGS':
            return { ...state, runner: { ...state.runner, settings: { ...state.runner.settings, ...action.payload } } };
        case 'START_DEPLOYMENT_PROMPT':
             if (!state.ui.csvFile && state.runner.devices.length === 0) {
                return { ...state, runner: { ...state.runner, logs: [...state.runner.logs, { timestamp: new Date(), message: "Please select a device list or transfer devices from the monitor.", level: 'ERROR' }] } };
            }
            return { ...state, ui: { ...state.ui, isCredentialModalOpen: true } };
        case 'SET_CREDENTIAL_MODAL_OPEN':
            return { ...state, ui: { ...state.ui, isCredentialModalOpen: action.payload } };
        case 'INITIALIZE_DEPLOYMENT':
            return {
                ...state,
                credentials: action.payload.credentials,
                runner: {
                    ...state.runner,
                    devices: action.payload.devices,
                    logs: [
                        { timestamp: new Date(), message: "Deployment process initiated.", level: 'INFO' },
                        { timestamp: new Date(), message: `User: ${action.payload.credentials.username}`, level: 'INFO' }
                    ],
                    deploymentState: 'running',
                    isCancelled: false,
                    selectedDeviceIds: new Set(),
                }
            };
        case 'DEPLOYMENT_STARTED':
            return { ...state, runner: { ...state.runner, deploymentState: 'running' } };
        case 'UPDATE_DEVICE_STATE':
            return {
                ...state,
                runner: {
                    ...state.runner,
                    devices: state.runner.devices.map(d => d.id === action.payload.id ? action.payload : d)
                }
            };
        case 'DEPLOYMENT_FINISHED':
            return { ...state, runner: { ...state.runner, deploymentState: 'complete' } };
        case 'CANCEL_DEPLOYMENT':
             const cancellableStatuses: (Device['status'])[] = ['Connecting', 'Retrying...', 'Updating', 'Waking Up', 'Checking Info', 'Checking BIOS', 'Checking DCU', 'Checking Windows', 'Updating BIOS', 'Updating DCU', 'Updating Windows', 'Rebooting...', 'Executing Script'];
            return {
                ...state,
                runner: {
                    ...state.runner,
                    isCancelled: true,
                    deploymentState: 'idle',
                    devices: state.runner.devices.map(d => cancellableStatuses.includes(d.status) ? { ...d, status: 'Cancelled' } : d)
                }
            };
        case 'ARCHIVE_RUN': {
            const currentDevices = state.runner.devices;
            if (currentDevices.length === 0) return state;
            const newRun = api.generateRunArchive(currentDevices, state.credentials?.username);
            return { ...state, runner: { ...state.runner, history: [newRun, ...state.runner.history].slice(0, 10) } };
        }
        case 'SAVE_TEMPLATE': {
            const newTemplate: DeploymentTemplate = {
                id: `tpl_${Date.now()}`,
                createdAt: new Date().toISOString(),
                ...action.payload,
            };
            const updatedTemplates = [...state.runner.templates, newTemplate];
            saveTemplatesToStorage(updatedTemplates);
            return { ...state, runner: { ...state.runner, templates: updatedTemplates } };
        }
        case 'DELETE_TEMPLATE': {
            const updatedTemplates = state.runner.templates.filter(t => t.id !== action.payload);
            saveTemplatesToStorage(updatedTemplates);
            return { ...state, runner: { ...state.runner, templates: updatedTemplates } };
        }
        case 'LOAD_TEMPLATE': {
            const template = state.runner.templates.find(t => t.id === action.payload);
            if (!template) return state;
            return { ...state, runner: { ...state.runner, settings: { ...template.settings } } };
        }
        
        case 'TOGGLE_DEVICE_SELECTION': {
            const newSet = new Set(state.runner.selectedDeviceIds);
            if (newSet.has(action.payload)) newSet.delete(action.payload);
            else newSet.add(action.payload);
            return { ...state, runner: { ...state.runner, selectedDeviceIds: newSet } };
        }
        case 'SELECT_ALL_DEVICES':
            return { ...state, runner: { ...state.runner, selectedDeviceIds: action.payload ? new Set(state.runner.devices.map(d => d.id)) : new Set() } };
        case 'CLEAR_SELECTIONS':
            return { ...state, runner: { ...state.runner, selectedDeviceIds: new Set() } };
        case 'SET_DEVICES':
            return { ...state, runner: { ...state.runner, devices: action.payload } };
        case 'UPDATE_SINGLE_DEVICE':
            return { ...state, runner: { ...state.runner, devices: state.runner.devices.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d) } };
        
        case 'SET_IMAGING_DEVICES':
            return { ...state, monitor: { ...state.monitor, devices: action.payload } };
        case 'UPDATE_IMAGING_DEVICE_STATE':
            return { ...state, monitor: { ...state.monitor, devices: state.monitor.devices.map(d => d.id === action.payload.id ? action.payload : d) } };
        case 'RENAME_IMAGING_DEVICE':
            return { ...state, monitor: { ...state.monitor, devices: state.monitor.devices.map(d => d.id === action.payload.deviceId ? { ...d, hostname: action.payload.newHostname } : d) } };
        case 'REMOVE_IMAGING_DEVICE':
            return { ...state, monitor: { ...state.monitor, devices: state.monitor.devices.filter(d => d.id !== action.payload) } };
        
        case 'TRANSFER_ALL_COMPLETED_DEVICES': {
            const completed = state.monitor.devices.filter(d => d.status === 'Completed');
            if (completed.length === 0) return state;
            const newRunnerDevices = api.transformImagingToRunnerDevices(completed);
            return {
                ...state,
                runner: { ...state.runner, devices: [...state.runner.devices, ...newRunnerDevices] },
                monitor: { ...state.monitor, devices: state.monitor.devices.filter(d => d.status !== 'Completed') },
                ui: { ...state.ui, activeTab: 'runner' }
            };
        }
        case 'TRANSFER_SELECTED_IMAGING_DEVICES': {
            const toTransfer = state.monitor.devices.filter(d => action.payload.has(d.id) && d.status === 'Completed');
            if (toTransfer.length === 0) return state;
            const newRunnerDevices = api.transformImagingToRunnerDevices(toTransfer);
            return {
                ...state,
                runner: { ...state.runner, devices: [...state.runner.devices, ...newRunnerDevices] },
                monitor: { ...state.monitor, devices: state.monitor.devices.filter(d => !action.payload.has(d.id)) },
                ui: { ...state.ui, activeTab: 'runner' }
            };
        }
        case 'CLEAR_SELECTED_IMAGING_DEVICES': {
             return { ...state, monitor: { ...state.monitor, devices: state.monitor.devices.filter(d => !action.payload.has(d.id)) } };
        }
        case 'SHOW_COMPLIANCE_DETAILS':
            return { ...state, ui: { ...state.ui, selectedComplianceResult: action.payload, isComplianceModalOpen: true } };
        case 'SET_COMPLIANCE_MODAL_OPEN':
             return { ...state, ui: { ...state.ui, isComplianceModalOpen: action.payload } };
        case 'SET_ALL_COMPLIANCE_MODAL_OPEN':
            return { ...state, ui: { ...state.ui, isAllComplianceModalOpen: action.payload } };
        case 'SET_PASSED_COMPLIANCE_MODAL_OPEN':
            return { ...state, ui: { ...state.ui, isPassedComplianceModalOpen: action.payload } };
        case 'SET_RESCAN_MODAL_OPEN':
            return { ...state, ui: { ...state.ui, isRescanModalOpen: action.payload } };
        case 'RESCAN_ALL_DEVICES_PROMPT':
            if (state.runner.devices.length === 0) {
                 return { ...state, runner: { ...state.runner, logs: [...state.runner.logs, { timestamp: new Date(), message: "No devices to re-scan.", level: 'WARNING' }] } };
            }
            return { ...state, ui: { ...state.ui, isRescanModalOpen: true } };
        case 'RESCAN_ALL_DEVICES_CONFIRMED':
            return {
                ...state,
                ui: { ...state.ui, isRescanModalOpen: false },
                runner: {
                    ...state.runner,
                    deploymentState: 'running',
                    isCancelled: false,
                    logs: [...state.runner.logs, { timestamp: new Date(), message: "Initiating re-scan for all devices...", level: 'INFO' }]
                }
            };

        default:
            return state;
    }
};

// FIX: Export AppProvider so it can be used in other files.
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // Effect for handling async operations triggered by actions
    const effectRunner = useCallback(async (state: AppState, action: AppAction) => {
        const { runner, ui, credentials } = state;

        const addLog = (message: string, level: LogEntry['level'] = 'INFO') => {
            dispatch({ type: 'ADD_LOG', payload: { timestamp: new Date(), message, level } });
        };
        const sendNotification = (title: string, body: string) => {
             if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { body, icon: '/favicon.svg' });
            }
        }

        switch (action.type) {
             case 'START_DEPLOYMENT_CONFIRMED': {
                dispatch({ type: 'SET_CREDENTIAL_MODAL_OPEN', payload: false });
                if (ui.csvFile) {
                    Papa.parse<Record<string, string>>(ui.csvFile, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            const { devices, errors } = api.parseDevicesFromCsv(results);
                            errors.forEach(e => addLog(e, 'ERROR'));
                            if (devices.length > 0) {
                                addLog(`Validated and loaded ${devices.length} devices from ${ui.csvFile?.name}.`, 'INFO');
                                dispatch({ type: 'INITIALIZE_DEPLOYMENT', payload: { devices, credentials: action.payload } });
                            }
                        }
                    });
                } else if (runner.devices.length > 0) {
                    dispatch({ type: 'INITIALIZE_DEPLOYMENT', payload: { devices: runner.devices, credentials: action.payload } });
                }
                break;
            }
            
            case 'INITIALIZE_DEPLOYMENT': {
                const onProgress = (device: Device) => dispatch({ type: 'UPDATE_DEVICE_STATE', payload: device });
                try {
                     await api.runDeploymentFlow(action.payload.devices, runner.settings, onProgress, () => state.runner.isCancelled);
                     if (!state.runner.isCancelled) {
                        addLog("Deployment scan complete.", 'INFO');
                        sendNotification('Deployment Complete', `Scan finished.`);
                        dispatch({ type: 'DEPLOYMENT_FINISHED' });
                     }
                } catch (error) {
                    addLog(error instanceof Error ? error.message : String(error), 'ERROR');
                    dispatch({ type: 'DEPLOYMENT_FINISHED' });
                } finally {
                    if (!state.runner.isCancelled) {
                        dispatch({ type: 'ARCHIVE_RUN' });
                    }
                }
                break;
            }
            
            case 'CANCEL_DEPLOYMENT': {
                addLog('Deployment cancelled by user.', 'WARNING');
                sendNotification('Deployment Cancelled', 'The process was stopped.');
                dispatch({ type: 'ARCHIVE_RUN' });
                break;
            }

            case 'UPDATE_DEVICE':
            case 'BULK_UPDATE': {
                const deviceIds = action.type === 'UPDATE_DEVICE' ? [action.payload] : [...runner.selectedDeviceIds];
                if (action.type === 'BULK_UPDATE') addLog(`Initiating bulk update for ${deviceIds.length} devices...`, 'INFO');
                
                const onProgress = (device: Device) => dispatch({ type: 'UPDATE_DEVICE_STATE', payload: device });

                await Promise.all(deviceIds.map(id => {
                    const device = runner.devices.find(d => d.id === id);
                    if(device) return api.updateDevice(device, runner.settings, onProgress, () => state.runner.isCancelled);
                }));

                if (action.type === 'BULK_UPDATE') {
                    addLog('Bulk update complete.', 'SUCCESS');
                    dispatch({ type: 'CLEAR_SELECTIONS' });
                }
                break;
            }

            case 'REBOOT_DEVICE': {
                const device = runner.devices.find(d => d.id === action.payload);
                if (device) {
                    dispatch({ type: 'UPDATE_SINGLE_DEVICE', payload: { id: device.id, status: 'Rebooting...' } });
                    await api.rebootDevice();
                    if (!state.runner.isCancelled) {
                        dispatch({ type: 'UPDATE_SINGLE_DEVICE', payload: { id: device.id, status: 'Success' } });
                        addLog(`[${device.hostname}] Reboot complete.`, 'SUCCESS');
                    }
                }
                break;
            }

            case 'VALIDATE_DEVICES':
            case 'BULK_VALIDATE': {
                const deviceIds = action.type === 'VALIDATE_DEVICES' ? action.payload : runner.selectedDeviceIds;
                addLog(`Initiating validation for ${deviceIds.size} device(s)...`, 'INFO');
                const onProgress = (device: Device) => dispatch({ type: 'UPDATE_DEVICE_STATE', payload: device });
                const devicesToValidate = runner.devices.filter(d => deviceIds.has(d.id));
                await api.validateDevices(devicesToValidate, onProgress, () => state.runner.isCancelled);
                addLog('Manual validation scan complete.', 'INFO');
                dispatch({ type: 'CLEAR_SELECTIONS' });
                break;
            }

            case 'EXECUTE_SCRIPT':
            case 'BULK_EXECUTE': {
                const devicesToExecute = action.type === 'EXECUTE_SCRIPT'
                    ? [runner.devices.find(d => d.id === action.payload)].filter(Boolean) as Device[]
                    : runner.devices.filter(d => runner.selectedDeviceIds.has(d.id) && d.status === 'Ready for Execution');
                
                if (devicesToExecute.length === 0) {
                    addLog('No selected devices are ready for execution.', 'WARNING');
                    break;
                }
                addLog(`Initiating execution for ${devicesToExecute.length} device(s)...`, 'INFO');
                await Promise.all(devicesToExecute.map(async device => {
                    dispatch({ type: 'UPDATE_SINGLE_DEVICE', payload: { id: device.id, status: 'Executing Script' } });
                    const success = await api.executeScript(device);
                    if (!state.runner.isCancelled) {
                        const updatePayload: Partial<Device> & { id: number } = {
                            id: device.id,
                            status: success ? 'Execution Complete' : 'Execution Failed',
                            ...(success ? {} : { failureDetail: api.FAILURE_CATALOG['Execution Failed'] }),
                        };
                        dispatch({ type: 'UPDATE_SINGLE_DEVICE', payload: updatePayload });
                        addLog(`Script execution ${success ? 'succeeded' : 'failed'} on ${device.hostname}.`, success ? 'SUCCESS' : 'ERROR');
                    }
                }));
                 if (action.type === 'BULK_EXECUTE') dispatch({ type: 'CLEAR_SELECTIONS' });
                 break;
            }

            case 'BULK_REMOVE': {
                addLog(`Removing ${runner.selectedDeviceIds.size} selected device(s) from the runner.`, 'WARNING');
                const newDevices = runner.devices.filter(d => !runner.selectedDeviceIds.has(d.id));
                dispatch({ type: 'SET_DEVICES', payload: newDevices });
                dispatch({ type: 'CLEAR_SELECTIONS' });
                break;
            }

             case 'BULK_CANCEL': {
                addLog(`Cancelling tasks for ${runner.selectedDeviceIds.size} devices...`, 'WARNING');
                const cancellable: (Device['status'])[] = ['Connecting', 'Retrying...', 'Updating', 'Waking Up', 'Checking Info', 'Checking BIOS', 'Checking DCU', 'Checking Windows', 'Updating BIOS', 'Updating DCU', 'Updating Windows', 'Executing Script'];
                const newDevices = runner.devices.map(d => runner.selectedDeviceIds.has(d.id) && cancellable.includes(d.status) ? { ...d, status: 'Cancelled' } : d);
                dispatch({ type: 'SET_DEVICES', payload: newDevices });
                dispatch({ type: 'CLEAR_SELECTIONS' });
                break;
            }

            case 'WAKE_ON_LAN': {
                if (action.payload.size === 0) break;
                const newDevices = runner.devices.map(d => action.payload.has(d.id) ? { ...d, status: 'Waking Up' } : d);
                dispatch({ type: 'SET_DEVICES', payload: newDevices });
                addLog(`Sent Wake-on-LAN to ${action.payload.size} device(s).`, 'INFO');
                dispatch({ type: 'CLEAR_SELECTIONS' });
                break;
            }

            case 'SET_SCRIPT_FILE': {
                const device = runner.devices.find(d => d.id === action.payload.deviceId);
                if (device) {
                    addLog(`Script "${action.payload.file.name}" selected for ${device.hostname}.`, 'INFO');
                    dispatch({ type: 'UPDATE_SINGLE_DEVICE', payload: { id: action.payload.deviceId, scriptFile: action.payload.file, status: 'Ready for Execution' } });
                }
                break;
            }

             case 'REVALIDATE_IMAGING_DEVICES': {
                addLog(`Starting re-validation for ${action.payload.size} device(s).`, 'INFO');
                 const onProgress = (device: ImagingDevice) => dispatch({ type: 'UPDATE_IMAGING_DEVICE_STATE', payload: device });
                 const devicesToRevalidate = state.monitor.devices.filter(d => action.payload.has(d.id));
                 await api.revalidateImagingDevices(devicesToRevalidate, onProgress);
                break;
            }

            case 'RESCAN_ALL_DEVICES_CONFIRMED': {
                if (runner.devices.length === 0) break;
                const onProgress = (device: Device) => dispatch({ type: 'UPDATE_DEVICE_STATE', payload: device });
                try {
                    await api.validateDevices(runner.devices, onProgress, () => state.runner.isCancelled);
                    if (!state.runner.isCancelled) {
                        addLog("Full re-scan complete.", 'INFO');
                        sendNotification('Re-Scan Complete', `Scan finished for all devices.`);
                        dispatch({ type: 'DEPLOYMENT_FINISHED' });
                    }
                } catch (error) {
                    addLog(error instanceof Error ? error.message : String(error), 'ERROR');
                    dispatch({ type: 'DEPLOYMENT_FINISHED' });
                } finally {
                    if (!state.runner.isCancelled) {
                        dispatch({ type: 'ARCHIVE_RUN' });
                    }
                }
                break;
            }
        }
    }, [state]); // Rerun effect when state changes if you need to react to state updates for new async calls

    const wrappedDispatch = useCallback((action: AppAction) => {
        dispatch(action);
        effectRunner(state, action);
    }, [state, effectRunner]);


    // Effect to check for new compliance results
    useEffect(() => {
        const checkCompliance = async () => {
            const devicesToCheck = state.monitor.devices.filter(d => d.status === 'Completed' && !d.complianceCheck);
            if (devicesToCheck.length === 0) return;

            const onProgress = (device: ImagingDevice) => dispatch({ type: 'UPDATE_IMAGING_DEVICE_STATE', payload: device });
            await api.runComplianceChecks(devicesToCheck, onProgress);
        };
        checkCompliance();
    }, [state.monitor.devices]);

     // Request notification permission on mount
    useEffect(() => {
      if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }, []);

    return (
        <AppContext.Provider value={{ state, dispatch: wrappedDispatch }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};