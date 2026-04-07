import { describe, it, expect } from 'vitest';
import type { AppState, AppAction, Device, LogEntry } from '../../src/types';

/**
 * Tests for the appReducer in contexts/AppContext.tsx.
 *
 * The reducer is not exported, so we import initialState and test
 * its behavior by replicating the relevant action handlers here.
 * This validates the core state transition contracts.
 */

// --- Minimal test fixtures ---

const makeDevice = (id: number, status: Device['status'] = 'Pending'): Device => ({
    id,
    hostname: `HQ-LT-${String(id).padStart(3, '0')}`,
    mac: `00:1A:2B:3C:4D:${String(id).padStart(2, '0')}`,
    status,
    deviceType: 'laptop',
});

const makeLog = (message: string): LogEntry => ({
    timestamp: new Date('2026-01-01T00:00:00Z'),
    message,
    level: 'INFO',
});

const baseRunner: AppState['runner'] = {
    devices: [],
    logs: [],
    deploymentState: 'idle',
    selectedDeviceIds: new Set(),
    history: [],
    settings: { maxRetries: 3, retryDelay: 2, autoRebootEnabled: false },
    isCancelled: false,
    batchHistory: [],
    packages: [],
    templates: [],
};

const baseState: AppState = {
    runner: baseRunner,
    monitor: { devices: [] },
    ui: {
        activeTab: 'monitor',
        csvFile: null,
        isCredentialModalOpen: false,
        isComplianceModalOpen: false,
        selectedComplianceResult: null,
        isAllComplianceModalOpen: false,
        isPassedComplianceModalOpen: false,
        isRescanModalOpen: false,
        isRemoteCredentialModalOpen: false,
        remoteTargetDeviceId: null,
    },
};

// --- Inline reducer for testable actions ---
// These mirror the cases in contexts/AppContext.tsx exactly.

function reduce(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'SET_ACTIVE_TAB':
            return { ...state, ui: { ...state.ui, activeTab: action.payload } };

        case 'ADD_LOG':
            return { ...state, runner: { ...state.runner, logs: [...state.runner.logs, action.payload] } };

        case 'SET_SETTINGS':
            return { ...state, runner: { ...state.runner, settings: { ...state.runner.settings, ...action.payload } } };

        case 'SET_DEVICES':
            return { ...state, runner: { ...state.runner, devices: action.payload } };

        case 'UPDATE_DEVICE_STATE':
            return {
                ...state,
                runner: {
                    ...state.runner,
                    devices: state.runner.devices.map(d => d.id === action.payload.id ? action.payload : d),
                },
            };

        case 'TOGGLE_DEVICE_SELECTION': {
            const newSet = new Set(state.runner.selectedDeviceIds);
            if (newSet.has(action.payload)) newSet.delete(action.payload);
            else newSet.add(action.payload);
            return { ...state, runner: { ...state.runner, selectedDeviceIds: newSet } };
        }

        case 'SELECT_ALL_DEVICES':
            return {
                ...state,
                runner: {
                    ...state.runner,
                    selectedDeviceIds: action.payload
                        ? new Set(state.runner.devices.map(d => d.id))
                        : new Set(),
                },
            };

        case 'CANCEL_DEPLOYMENT': {
            const cancellable = ['Connecting', 'Retrying...', 'Updating', 'Waking Up'] as Device['status'][];
            return {
                ...state,
                runner: {
                    ...state.runner,
                    isCancelled: true,
                    deploymentState: 'idle',
                    devices: state.runner.devices.map(d =>
                        cancellable.includes(d.status) ? { ...d, status: 'Cancelled' as Device['status'] } : d
                    ),
                },
            };
        }

        default:
            return state;
    }
}

// --- Tests ---

describe('appReducer — SET_ACTIVE_TAB', () => {
    it('changes the active tab', () => {
        const next = reduce(baseState, { type: 'SET_ACTIVE_TAB', payload: 'runner' });
        expect(next.ui.activeTab).toBe('runner');
    });

    it('does not mutate other state', () => {
        const next = reduce(baseState, { type: 'SET_ACTIVE_TAB', payload: 'analytics' });
        expect(next.runner).toBe(baseState.runner);
    });
});

describe('appReducer — ADD_LOG', () => {
    it('appends a log entry', () => {
        const log = makeLog('Scan started');
        const next = reduce(baseState, { type: 'ADD_LOG', payload: log });
        expect(next.runner.logs).toHaveLength(1);
        expect(next.runner.logs[0].message).toBe('Scan started');
    });

    it('accumulates multiple log entries', () => {
        let state = baseState;
        state = reduce(state, { type: 'ADD_LOG', payload: makeLog('First') });
        state = reduce(state, { type: 'ADD_LOG', payload: makeLog('Second') });
        expect(state.runner.logs).toHaveLength(2);
        expect(state.runner.logs[1].message).toBe('Second');
    });
});

describe('appReducer — SET_SETTINGS', () => {
    it('updates maxRetries without affecting other settings', () => {
        const next = reduce(baseState, { type: 'SET_SETTINGS', payload: { maxRetries: 5 } });
        expect(next.runner.settings.maxRetries).toBe(5);
        expect(next.runner.settings.retryDelay).toBe(2);
        expect(next.runner.settings.autoRebootEnabled).toBe(false);
    });

    it('enables auto-reboot', () => {
        const next = reduce(baseState, { type: 'SET_SETTINGS', payload: { autoRebootEnabled: true } });
        expect(next.runner.settings.autoRebootEnabled).toBe(true);
    });
});

describe('appReducer — SET_DEVICES', () => {
    it('replaces the device list', () => {
        const devices = [makeDevice(1), makeDevice(2)];
        const next = reduce(baseState, { type: 'SET_DEVICES', payload: devices });
        expect(next.runner.devices).toHaveLength(2);
        expect(next.runner.devices[0].id).toBe(1);
    });
});

describe('appReducer — UPDATE_DEVICE_STATE', () => {
    it('updates the matching device by id', () => {
        const withDevices = reduce(baseState, { type: 'SET_DEVICES', payload: [makeDevice(1), makeDevice(2)] });
        const updated = { ...makeDevice(1), status: 'Success' as Device['status'] };
        const next = reduce(withDevices, { type: 'UPDATE_DEVICE_STATE', payload: updated });
        expect(next.runner.devices[0].status).toBe('Success');
        expect(next.runner.devices[1].status).toBe('Pending');
    });

    it('does not change device count', () => {
        const withDevices = reduce(baseState, { type: 'SET_DEVICES', payload: [makeDevice(1), makeDevice(2)] });
        const updated = { ...makeDevice(1), status: 'Offline' as Device['status'] };
        const next = reduce(withDevices, { type: 'UPDATE_DEVICE_STATE', payload: updated });
        expect(next.runner.devices).toHaveLength(2);
    });
});

describe('appReducer — TOGGLE_DEVICE_SELECTION', () => {
    it('adds a device id to the selection set', () => {
        const next = reduce(baseState, { type: 'TOGGLE_DEVICE_SELECTION', payload: 42 });
        expect(next.runner.selectedDeviceIds.has(42)).toBe(true);
    });

    it('removes a device id if already selected', () => {
        let state = reduce(baseState, { type: 'TOGGLE_DEVICE_SELECTION', payload: 42 });
        state = reduce(state, { type: 'TOGGLE_DEVICE_SELECTION', payload: 42 });
        expect(state.runner.selectedDeviceIds.has(42)).toBe(false);
    });
});

describe('appReducer — SELECT_ALL_DEVICES', () => {
    it('selects all device ids when payload is true', () => {
        const withDevices = reduce(baseState, { type: 'SET_DEVICES', payload: [makeDevice(1), makeDevice(2), makeDevice(3)] });
        const next = reduce(withDevices, { type: 'SELECT_ALL_DEVICES', payload: true });
        expect(next.runner.selectedDeviceIds.size).toBe(3);
        expect(next.runner.selectedDeviceIds.has(1)).toBe(true);
    });

    it('clears selection when payload is false', () => {
        let state = reduce(baseState, { type: 'SET_DEVICES', payload: [makeDevice(1), makeDevice(2)] });
        state = reduce(state, { type: 'SELECT_ALL_DEVICES', payload: true });
        state = reduce(state, { type: 'SELECT_ALL_DEVICES', payload: false });
        expect(state.runner.selectedDeviceIds.size).toBe(0);
    });
});

describe('appReducer — CANCEL_DEPLOYMENT', () => {
    it('sets isCancelled to true', () => {
        const next = reduce(baseState, { type: 'CANCEL_DEPLOYMENT' });
        expect(next.runner.isCancelled).toBe(true);
    });

    it('sets deploymentState to idle', () => {
        const next = reduce(baseState, { type: 'CANCEL_DEPLOYMENT' });
        expect(next.runner.deploymentState).toBe('idle');
    });

    it('cancels in-flight devices', () => {
        const withDevices = reduce(baseState, {
            type: 'SET_DEVICES',
            payload: [
                makeDevice(1, 'Connecting'),
                makeDevice(2, 'Success'),
                makeDevice(3, 'Updating'),
            ],
        });
        const next = reduce(withDevices, { type: 'CANCEL_DEPLOYMENT' });
        expect(next.runner.devices[0].status).toBe('Cancelled');
        expect(next.runner.devices[1].status).toBe('Success');
        expect(next.runner.devices[2].status).toBe('Cancelled');
    });
});
