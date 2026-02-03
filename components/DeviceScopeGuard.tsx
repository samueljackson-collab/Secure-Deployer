import React, { useState, useMemo } from 'react';
import type { Device, ScopePolicy, ScopeVerification } from '../types';

interface DeviceScopeGuardProps {
  devices: Device[];
  selectedDeviceIds: Set<number>;
  onVerificationComplete: (verifiedDevices: Device[], policy: ScopePolicy) => void;
  onCancel: () => void;
  isOpen: boolean;
  username: string;
}

const HARD_MAX_DEVICE_COUNT = 200;
const DEFAULT_MAX_DEVICE_COUNT = 50;

export const DeviceScopeGuard: React.FC<DeviceScopeGuardProps> = ({
  devices,
  selectedDeviceIds,
  onVerificationComplete,
  onCancel,
  isOpen,
  username,
}) => {
  // Track individually checked device IDs
  const [checkedDeviceIds, setCheckedDeviceIds] = useState<Set<number>>(new Set());

  // Typed confirmation count input
  const [confirmationCount, setConfirmationCount] = useState<string>('');

  // Safety policy toggles
  const [blockBroadcast, setBlockBroadcast] = useState<boolean>(true);
  const [blockCriticalServices, setBlockCriticalServices] = useState<boolean>(true);
  const [blockRegistryWrites, setBlockRegistryWrites] = useState<boolean>(true);
  const [enforceHostnameWhitelist, setEnforceHostnameWhitelist] = useState<boolean>(true);

  // Max device count
  const [maxDeviceCount, setMaxDeviceCount] = useState<number>(DEFAULT_MAX_DEVICE_COUNT);

  // Derive the selected devices from the full list
  const selectedDevices = useMemo(
    () => devices.filter((d) => selectedDeviceIds.has(d.id)),
    [devices, selectedDeviceIds],
  );

  const selectedCount = selectedDevices.length;

  // All devices individually checked
  const allDevicesChecked = useMemo(
    () =>
      selectedCount > 0 &&
      selectedDevices.every((d) => checkedDeviceIds.has(d.id)),
    [selectedDevices, checkedDeviceIds, selectedCount],
  );

  // Count confirmation matches
  const countConfirmed =
    confirmationCount.trim() !== '' &&
    parseInt(confirmationCount.trim(), 10) === selectedCount;

  // Overall readiness
  const isWithinMax = selectedCount <= maxDeviceCount;
  const isReadyToConfirm =
    allDevicesChecked && countConfirmed && selectedCount > 0 && isWithinMax;

  const handleDeviceCheck = (deviceId: number) => {
    setCheckedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  const handleMaxDeviceCountChange = (value: string) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1) {
      setMaxDeviceCount(1);
    } else if (parsed > HARD_MAX_DEVICE_COUNT) {
      setMaxDeviceCount(HARD_MAX_DEVICE_COUNT);
    } else {
      setMaxDeviceCount(parsed);
    }
  };

  const handleConfirm = () => {
    if (!isReadyToConfirm) return;

    const now = new Date();

    // Build scope-verified devices
    const verifiedDevices: Device[] = selectedDevices.map((d) => ({
      ...d,
      scopeVerified: true,
      scopeVerifiedAt: now,
    }));

    // Build verification records (kept for audit trail in the future)
    const _verifications: ScopeVerification[] = selectedDevices.map((d) => ({
      deviceId: d.id,
      hostname: d.hostname,
      mac: d.mac,
      verified: true,
      verifiedAt: now,
      verifiedBy: username,
    }));

    // Build the scope policy
    const policy: ScopePolicy = {
      allowedHostnames: selectedDevices.map((d) => d.hostname),
      allowedMacs: selectedDevices.map((d) => d.mac),
      maxDeviceCount,
      requireExplicitSelection: true,
      blockBroadcastCommands: blockBroadcast,
      blockSubnetWideOperations: blockBroadcast,
      blockRegistryWrites,
      blockServiceStops: blockCriticalServices,
      enforceHostnameWhitelist,
    };

    onVerificationComplete(verifiedDevices, policy);

    // Reset internal state
    setCheckedDeviceIds(new Set());
    setConfirmationCount('');
    setBlockBroadcast(true);
    setBlockCriticalServices(true);
    setBlockRegistryWrites(true);
    setEnforceHostnameWhitelist(true);
    setMaxDeviceCount(DEFAULT_MAX_DEVICE_COUNT);
  };

  const handleCancel = () => {
    setCheckedDeviceIds(new Set());
    setConfirmationCount('');
    onCancel();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50"
      aria-modal="true"
      role="dialog"
      aria-labelledby="scope-guard-title"
    >
      <div className="bg-slate-800 rounded-lg shadow-2xl border-2 border-amber-500/70 w-full max-w-3xl m-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-amber-500/30 flex items-center space-x-3 flex-shrink-0">
          {/* Warning triangle icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-amber-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h2
              id="scope-guard-title"
              className="text-xl font-bold text-amber-400"
            >
              Device Scope Verification
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Confirm every device before operations proceed
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Scope Summary */}
          <div className="bg-amber-900/20 border border-amber-500/40 rounded-lg p-4">
            <p className="text-lg font-semibold text-amber-300 text-center">
              You are about to execute operations on{' '}
              <span className="text-white font-bold text-xl">
                {selectedCount}
              </span>{' '}
              device{selectedCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Device Checklist */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
              Device Checklist
            </h3>
            {selectedDevices.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                No devices selected.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedDevices.map((device) => {
                  const isChecked = checkedDeviceIds.has(device.id);
                  const isVerified = device.scopeVerified === true;

                  return (
                    <label
                      key={device.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors duration-150 ${
                        isChecked
                          ? 'bg-slate-700/60 border-green-500/50'
                          : 'bg-slate-800/60 border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleDeviceCheck(device.id)}
                        className="h-4 w-4 rounded border-slate-500 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-800 accent-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-100 truncate">
                            {device.hostname}
                          </span>
                          {isVerified && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-900/40 text-green-400 border border-green-700/50">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span>
                            MAC:{' '}
                            <span className="font-mono text-slate-300">
                              {device.mac}
                            </span>
                          </span>
                          {device.ipAddress && (
                            <span>
                              IP:{' '}
                              <span className="font-mono text-slate-300">
                                {device.ipAddress}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      {isChecked && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-400 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            <div className="mt-2 text-xs text-slate-500">
              {checkedDeviceIds.size} of {selectedCount} device
              {selectedCount !== 1 ? 's' : ''} confirmed
            </div>
          </div>

          {/* Safety Policy Configuration */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
              Safety Policy Configuration
            </h3>
            <div className="space-y-3">
              <PolicyToggle
                label="Block broadcast/subnet-wide commands"
                enabled={blockBroadcast}
                onToggle={() => setBlockBroadcast((v) => !v)}
              />
              <PolicyToggle
                label="Block critical service modifications"
                enabled={blockCriticalServices}
                onToggle={() => setBlockCriticalServices((v) => !v)}
              />
              <PolicyToggle
                label="Block registry writes to HKLM\SYSTEM"
                enabled={blockRegistryWrites}
                onToggle={() => setBlockRegistryWrites((v) => !v)}
              />
              <PolicyToggle
                label="Enforce hostname whitelist"
                enabled={enforceHostnameWhitelist}
                onToggle={() => setEnforceHostnameWhitelist((v) => !v)}
              />

              {/* Max device count */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-300">
                  Max device count
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={HARD_MAX_DEVICE_COUNT}
                    value={maxDeviceCount}
                    onChange={(e) => handleMaxDeviceCountChange(e.target.value)}
                    className="w-20 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-center text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <span className="text-xs text-slate-500">
                    (max {HARD_MAX_DEVICE_COUNT})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Confirmation Requirements */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
              Confirmation
            </h3>

            {/* Warning Banner */}
            <div className="bg-red-900/20 border border-red-500/40 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-300 font-semibold text-center">
                Operations will ONLY affect the verified devices listed above.
                No other devices on the hospital network will be contacted.
              </p>
            </div>

            {/* Device count confirmation */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="scope-count-confirm"
                className="text-sm text-slate-300"
              >
                Type the number of devices to confirm:
              </label>
              <input
                id="scope-count-confirm"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={confirmationCount}
                onChange={(e) => setConfirmationCount(e.target.value)}
                placeholder={String(selectedCount)}
                className={`w-20 bg-slate-700 border rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 ${
                  confirmationCount.trim() === ''
                    ? 'border-slate-600 text-slate-200 focus:ring-amber-500 focus:border-amber-500'
                    : countConfirmed
                      ? 'border-green-500 text-green-400 focus:ring-green-500 focus:border-green-500'
                      : 'border-red-500 text-red-400 focus:ring-red-500 focus:border-red-500'
                }`}
              />
              {countConfirmed && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>

            {/* Readiness indicator */}
            {isReadyToConfirm ? (
              <div className="mt-4 bg-green-900/20 border border-green-500/40 rounded-lg p-3">
                <div className="flex items-center gap-2 justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <p className="text-sm font-semibold text-green-400">
                    All checks passed. Ready to confirm scope.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-xs text-slate-500 space-y-1">
                {!allDevicesChecked && (
                  <p>
                    - Check every device individually above (
                    {checkedDeviceIds.size}/{selectedCount})
                  </p>
                )}
                {!countConfirmed && (
                  <p>
                    - Type "{selectedCount}" to confirm the device count
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="p-4 bg-slate-900/50 rounded-b-lg flex justify-between items-center flex-shrink-0 border-t border-slate-700">
          <p className="text-xs text-slate-500">
            Operator: <span className="text-slate-400">{username}</span>
          </p>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-slate-600 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isReadyToConfirm}
              className={`px-6 py-2 font-semibold rounded-lg transition duration-200 shadow-md text-sm ${
                isReadyToConfirm
                  ? 'bg-amber-600 text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-800'
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'
              }`}
            >
              Confirm Scope & Deploy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Internal helper component for policy toggle switches                */
/* ------------------------------------------------------------------ */

interface PolicyToggleProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}

const PolicyToggle: React.FC<PolicyToggleProps> = ({
  label,
  enabled,
  onToggle,
}) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm text-slate-300">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`${
        enabled ? 'bg-amber-600' : 'bg-slate-600'
      } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-800`}
    >
      <span
        className={`${
          enabled ? 'translate-x-6' : 'translate-x-1'
        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
      />
    </button>
  </div>
);
