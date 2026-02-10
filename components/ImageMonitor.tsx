import React, { useState, useCallback } from 'react';
import type { Device, ImagingMetadata, ImagingStatus } from '../types';

interface ImageMonitorProps {
  onPromoteDevices: (devices: Device[]) => void;
  onLog: (message: string, level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS') => void;
}

const IMAGING_STATUS_STYLES: Record<ImagingStatus, string> = {
  'Not Started': 'text-slate-400',
  'Collecting Metadata': 'text-yellow-400 animate-pulse',
  'Imaging In Progress': 'text-sky-400 animate-pulse',
  'Imaging Complete': 'text-green-400',
  'Imaging Failed': 'text-red-400',
  'Ready for Deployment': 'text-cyan-400',
};

const IMAGING_PROGRESS_COLORS: Record<ImagingStatus, string> = {
  'Not Started': 'bg-slate-500',
  'Collecting Metadata': 'bg-yellow-400',
  'Imaging In Progress': 'bg-sky-400',
  'Imaging Complete': 'bg-green-400',
  'Imaging Failed': 'bg-red-400',
  'Ready for Deployment': 'bg-cyan-400',
};

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{12}$/;

const isValidMacFormat = (mac: string): boolean => {
  if (!mac) return false;
  return MAC_REGEX.test(mac.trim());
};

const normalizeMac = (mac: string): string => {
  // Normalize MAC addresses consistently with App.tsx: remove colons, hyphens, periods, and whitespace
  return mac.replace(/[:\-.\s]/g, '').toUpperCase();
};

const resolveImagingStatus = (progress: number, metadata: ImagingMetadata): ImagingStatus => {
  if (progress >= 100) return 'Ready for Deployment';
  if (progress > 0 && progress < 100) return 'Imaging In Progress';
  if (metadata.serialNumber && metadata.macAddress && progress === 0) return 'Collecting Metadata';
  return 'Not Started';
};

const formatTimestamp = (dateStr: string | undefined): string => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
};

// Generate robust unique IDs using timestamp + counter to avoid collisions
// even across component remounts or multi-tab scenarios
let idCounter = 0;
const generateDeviceId = (): number => {
  // Use modulo to keep timestamp portion within safe integer range
  // Combined with counter, this provides sufficient uniqueness for this use case
  return (Date.now() % 1_000_000_000) * 1000 + (idCounter++ % 1000);
};

const metadataToDevice = (metadata: ImagingMetadata): Device => {
  // Developer note: convert imaging payloads into shared Device shape so promoted
  // devices can move into deployment UI without extra mapping logic.
  const progress = typeof metadata.imageProgress === 'number'
    ? Math.max(0, Math.min(100, metadata.imageProgress))
    : 0;
  const imagingStatus = resolveImagingStatus(progress, metadata);

  return {
    id: generateDeviceId(),
    hostname: metadata.hostname,
    mac: normalizeMac(metadata.macAddress),
    status: 'Pending',
    biosVersion: metadata.biosVersion || undefined,
    serialNumber: metadata.serialNumber || undefined,
    model: metadata.model || undefined,
    ipAddress: metadata.ipAddress || undefined,
    ramAmount: metadata.totalRamMB ? Math.round(metadata.totalRamMB / 1024) : undefined,
    diskSpace: metadata.diskSizeGB
      ? { total: metadata.diskSizeGB, free: 0 }
      : undefined,
    encryptionStatus: metadata.encryptionReady ? 'Enabled' : 'Disabled',
    imagingStatus,
    imagingProgress: progress,
    imagingStartTime: undefined,
    imagingTaskSequence: metadata.taskSequenceName || undefined,
    metadataCollectedAt: metadata.collectedAt ? new Date(metadata.collectedAt) : undefined,
  };
};

const ImagingStatusBadge: React.FC<{ status: ImagingStatus }> = ({ status }) => {
  const color = IMAGING_STATUS_STYLES[status] || 'text-slate-400';
  return (
    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-700/80 ${color}`}>
      {status}
    </span>
  );
};

const MetadataRow: React.FC<{ label: string; value: string | number | undefined | null }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-0.5">
    <span className="text-slate-400 text-xs">{label}</span>
    <span className="text-slate-200 text-xs font-mono truncate max-w-[55%] text-right">
      {value !== undefined && value !== null && value !== '' ? String(value) : '-'}
    </span>
  </div>
);

const ImagingProgressBar: React.FC<{ progress: number; status: ImagingStatus }> = ({ progress, status }) => {
  const barColor = IMAGING_PROGRESS_COLORS[status] || 'bg-slate-500';
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-400">Imaging Progress</span>
        <span className="text-xs font-semibold text-slate-200">{Math.round(clampedProgress)}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

export const ImageMonitor: React.FC<ImageMonitorProps> = ({ onPromoteDevices, onLog }) => {
  const [imagingDevices, setImagingDevices] = useState<Device[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateMetadata = useCallback((data: unknown): { valid: boolean; metadata: ImagingMetadata | null; error: string } => {
    // Developer note: validation returns structured outcome (not thrown errors) so
    // batch imports can continue and report every bad entry in one pass.
    if (!data || typeof data !== 'object') {
      return { valid: false, metadata: null, error: 'Invalid JSON structure: expected an object.' };
    }

    const obj = data as Record<string, unknown>;

    if (!obj.hostname || typeof obj.hostname !== 'string' || obj.hostname.trim().length === 0) {
      return { valid: false, metadata: null, error: 'Missing or empty required field: hostname.' };
    }

    if (!obj.macAddress || typeof obj.macAddress !== 'string') {
      return { valid: false, metadata: null, error: `Device "${obj.hostname}": missing required field: macAddress.` };
    }

    if (!isValidMacFormat(obj.macAddress as string)) {
      return {
        valid: false,
        metadata: null,
        error: `Device "${obj.hostname}": invalid MAC address format "${obj.macAddress}". Expected format: XX:XX:XX:XX:XX:XX or XXXXXXXXXXXX.`,
      };
    }

    const metadata: ImagingMetadata = {
      hostname: (obj.hostname as string).trim(),
      serialNumber: typeof obj.serialNumber === 'string' ? obj.serialNumber.trim() : '',
      macAddress: (obj.macAddress as string).trim(),
      model: typeof obj.model === 'string' ? obj.model.trim() : '',
      manufacturer: typeof obj.manufacturer === 'string' ? obj.manufacturer.trim() : '',
      biosVersion: typeof obj.biosVersion === 'string' ? obj.biosVersion.trim() : '',
      biosDate: typeof obj.biosDate === 'string' ? obj.biosDate.trim() : '',
      totalRamMB: typeof obj.totalRamMB === 'number' ? obj.totalRamMB : 0,
      diskSizeGB: typeof obj.diskSizeGB === 'number' ? obj.diskSizeGB : 0,
      osVersion: typeof obj.osVersion === 'string' ? obj.osVersion.trim() : '',
      ipAddress: typeof obj.ipAddress === 'string' ? obj.ipAddress.trim() : '',
      taskSequenceName: typeof obj.taskSequenceName === 'string' ? obj.taskSequenceName.trim() : '',
      collectedAt: typeof obj.collectedAt === 'string' ? obj.collectedAt.trim() : '',
      imageProgress: typeof obj.imageProgress === 'number' ? obj.imageProgress : 0,
      encryptionReady: typeof obj.encryptionReady === 'boolean' ? obj.encryptionReady : false,
    };

    return { valid: true, metadata, error: '' };
  }, []);

  const processMetadataFiles = useCallback((files: File[]) => {
    // Developer note: batch parser is intentionally tolerant (skip bad files, keep good)
    // because imaging teams often drop mixed-quality exports at once.
    const errors: string[] = [];
    let loadedCount = 0;
    let skippedCount = 0;

    const readPromises = files.map((file) => {
      return new Promise<Device | null>((resolve) => {
        if (!file.name.endsWith('.json')) {
          errors.push(`Skipped "${file.name}": not a .json file.`);
          skippedCount++;
          resolve(null);
          return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            const raw = e.target?.result;
            if (typeof raw !== 'string') {
              errors.push(`Failed to read "${file.name}": empty or unreadable content.`);
              skippedCount++;
              resolve(null);
              return;
            }

            let parsed: unknown;
            try {
              parsed = JSON.parse(raw);
            } catch {
              errors.push(`Failed to parse "${file.name}": invalid JSON syntax.`);
              skippedCount++;
              resolve(null);
              return;
            }

            // Support both single object and array of objects
            const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
            const devicesFromFile: Device[] = [];

            for (let i = 0; i < items.length; i++) {
              const result = validateMetadata(items[i]);
              if (result.valid && result.metadata) {
                devicesFromFile.push(metadataToDevice(result.metadata));
              } else {
                const ctx = items.length > 1 ? ` (entry ${i + 1})` : '';
                errors.push(`"${file.name}"${ctx}: ${result.error}`);
                skippedCount++;
              }
            }

            if (devicesFromFile.length > 0) {
              loadedCount += devicesFromFile.length;
              // Return first device for single, or handle multiple below
              resolve(devicesFromFile.length === 1 ? devicesFromFile[0] : null);
              // If multiple, add them directly
              if (devicesFromFile.length > 1) {
                setImagingDevices((prev) => {
                  const existingMacs = new Set(prev.map((d) => d.mac));
                  const newDevices = devicesFromFile.filter((d) => !existingMacs.has(d.mac));
                  const duplicateCount = devicesFromFile.length - newDevices.length;
                  if (duplicateCount > 0) {
                    errors.push(`"${file.name}": ${duplicateCount} duplicate device(s) skipped (matching MAC).`);
                  }
                  return [...prev, ...newDevices];
                });
              }
            } else {
              resolve(null);
            }
          } catch {
            errors.push(`Unexpected error processing "${file.name}".`);
            skippedCount++;
            resolve(null);
          }
        };

        reader.onerror = () => {
          errors.push(`Failed to read file "${file.name}".`);
          skippedCount++;
          resolve(null);
        };

        reader.readAsText(file);
      });
    });

    Promise.all(readPromises).then((results) => {
      const singleDevices = results.filter((d): d is Device => d !== null);

      if (singleDevices.length > 0) {
        setImagingDevices((prev) => {
          const existingMacs = new Set(prev.map((d) => d.mac));
          const newDevices = singleDevices.filter((d) => {
            if (existingMacs.has(d.mac)) {
              errors.push(`Duplicate device skipped: "${d.hostname}" (MAC: ${d.mac}).`);
              return false;
            }
            existingMacs.add(d.mac);
            return true;
          });
          return [...prev, ...newDevices];
        });
      }

      setValidationErrors(errors);

      const totalProcessed = loadedCount + skippedCount;
      if (loadedCount > 0) {
        onLog(`Loaded ${loadedCount} imaging device(s) from ${files.length} file(s).`, 'SUCCESS');
      }
      if (skippedCount > 0) {
        onLog(`Skipped ${skippedCount} invalid entry/entries from ${files.length} file(s). See validation details.`, 'WARNING');
      }
      if (totalProcessed === 0 && files.length > 0) {
        onLog('No valid imaging metadata found in the selected file(s).', 'ERROR');
      }
    });
  }, [validateMetadata, onLog]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    processMetadataFiles(Array.from(fileList));
    // Reset the input so the same file(s) can be re-selected
    e.target.value = '';
  }, [processMetadataFiles]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;
    processMetadataFiles(Array.from(fileList));
  }, [processMetadataFiles]);

  const handleToggleSelect = useCallback((deviceId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }, []);

  const handleSelectAllReady = useCallback(() => {
    const readyIds = imagingDevices
      .filter((d) => d.imagingStatus === 'Ready for Deployment')
      .map((d) => d.id);
    setSelectedIds(new Set(readyIds));
  }, [imagingDevices]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handlePromoteSelected = useCallback(() => {
    const readyDevices = imagingDevices.filter(
      (d) => selectedIds.has(d.id) && d.imagingStatus === 'Ready for Deployment'
    );

    if (readyDevices.length === 0) {
      onLog('No eligible devices selected. Only devices with "Ready for Deployment" status can be promoted.', 'WARNING');
      return;
    }

    const promotedDevices: Device[] = readyDevices.map((d) => ({
      ...d,
      status: 'Pending',
      imagingStatus: undefined,
      imagingProgress: undefined,
    }));

    onPromoteDevices(promotedDevices);
    onLog(`Promoted ${promotedDevices.length} device(s) to the Secure Deployment Runner.`, 'SUCCESS');

    const promotedIds = new Set(readyDevices.map((d) => d.id));
    setImagingDevices((prev) => prev.filter((d) => !promotedIds.has(d.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      promotedIds.forEach((id) => next.delete(id));
      return next;
    });
  }, [imagingDevices, selectedIds, onPromoteDevices, onLog]);

  const handleRemoveDevice = useCallback((deviceId: number) => {
    setImagingDevices((prev) => prev.filter((d) => d.id !== deviceId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(deviceId);
      return next;
    });
  }, []);

  const handlePromoteSingle = useCallback((deviceId: number) => {
    const device = imagingDevices.find((d) => d.id === deviceId);
    if (!device || device.imagingStatus !== 'Ready for Deployment') {
      onLog('Device is not eligible for promotion. It must have "Ready for Deployment" status.', 'WARNING');
      return;
    }

    const promotedDevice: Device = {
      ...device,
      status: 'Pending',
      imagingStatus: undefined,
      imagingProgress: undefined,
    };

    onPromoteDevices([promotedDevice]);
    onLog(`Promoted "${device.hostname}" to the Secure Deployment Runner.`, 'SUCCESS');

    setImagingDevices((prev) => prev.filter((d) => d.id !== deviceId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(deviceId);
      return next;
    });
  }, [imagingDevices, onPromoteDevices, onLog]);

  const handleClearAll = useCallback(() => {
    setImagingDevices([]);
    setSelectedIds(new Set());
    setValidationErrors([]);
    onLog('Cleared all imaging devices from monitor.', 'INFO');
  }, [onLog]);

  const readyCount = imagingDevices.filter((d) => d.imagingStatus === 'Ready for Deployment').length;
  const inProgressCount = imagingDevices.filter((d) => d.imagingStatus === 'Imaging In Progress').length;
  const failedCount = imagingDevices.filter((d) => d.imagingStatus === 'Imaging Failed').length;
  const selectedReadyCount = imagingDevices.filter(
    (d) => selectedIds.has(d.id) && d.imagingStatus === 'Ready for Deployment'
  ).length;

  return (
    <div className="bg-slate-800/50 rounded-lg shadow-lg border border-slate-700">
      {/* Header */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-cyan-400">Image Monitor</h2>
            <p className="text-xs text-slate-400 mt-1">
              Live monitoring of SCCM/MDT imaging task sequences. Load metadata JSON files from the USB drive.
            </p>
          </div>
          {imagingDevices.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 border border-slate-600 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* File Drop Zone */}
      <div className="p-5 border-b border-slate-700">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer ${
            isDragOver
              ? 'border-cyan-400 bg-cyan-400/10'
              : 'border-slate-600 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-900/60'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-10 w-10 mb-3 ${isDragOver ? 'text-cyan-400' : 'text-slate-500'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm text-slate-300 font-medium">
            {isDragOver ? 'Drop metadata files here' : 'Drag and drop imaging metadata JSON files'}
          </p>
          <p className="text-xs text-slate-500 mt-1">or click to browse</p>
          <input
            type="file"
            accept=".json"
            multiple
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Select imaging metadata JSON files"
          />
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mt-3 bg-red-900/20 border border-red-800/40 rounded-md p-3">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-xs font-semibold text-red-400">Validation Issues</h4>
              <button
                onClick={() => setValidationErrors([])}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Dismiss
              </button>
            </div>
            <ul className="space-y-0.5">
              {validationErrors.map((err, i) => (
                <li key={i} className="text-xs text-red-300/80">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {imagingDevices.length > 0 && (
        <div className="p-5 border-b border-slate-700">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <div className="bg-slate-700/50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-slate-100">{imagingDevices.length}</div>
              <div className="text-xs text-slate-400">Total</div>
            </div>
            <div className="bg-slate-700/50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-sky-400">{inProgressCount}</div>
              <div className="text-xs text-slate-400">In Progress</div>
            </div>
            <div className="bg-slate-700/50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                {imagingDevices.filter((d) => d.imagingStatus === 'Imaging Complete').length}
              </div>
              <div className="text-xs text-slate-400">Complete</div>
            </div>
            <div className="bg-slate-700/50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-cyan-400">{readyCount}</div>
              <div className="text-xs text-slate-400">Ready</div>
            </div>
            <div className="bg-slate-700/50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-red-400">{failedCount}</div>
              <div className="text-xs text-slate-400">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {imagingDevices.length > 0 && (
        <div className="p-4 border-b border-slate-700 bg-slate-800/30">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSelectAllReady}
              disabled={readyCount === 0}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Select All Ready ({readyCount})
            </button>
            <button
              onClick={handleClearSelection}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear Selection
            </button>
            <div className="flex-grow" />
            {selectedIds.size > 0 && (
              <span className="text-xs text-slate-400">
                {selectedIds.size} selected ({selectedReadyCount} eligible for promotion)
              </span>
            )}
            <button
              onClick={handlePromoteSelected}
              disabled={selectedReadyCount === 0}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50"
            >
              Promote to Deployment ({selectedReadyCount})
            </button>
          </div>
        </div>
      )}

      {/* Device List */}
      <div className="p-5">
        {imagingDevices.length === 0 ? (
          <div className="text-center py-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto text-slate-600 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <p className="text-slate-500 text-sm font-medium">No imaging devices loaded</p>
            <p className="text-slate-600 text-xs mt-1">
              Drop or select imaging metadata JSON files to begin monitoring
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {imagingDevices.map((device) => {
              const isSelected = selectedIds.has(device.id);
              const isReady = device.imagingStatus === 'Ready for Deployment';
              const isFailed = device.imagingStatus === 'Imaging Failed';
              const status = device.imagingStatus || 'Not Started';
              const progress = device.imagingProgress || 0;

              return (
                <div
                  key={device.id}
                  className={`bg-slate-900/60 border rounded-lg p-4 transition-all duration-200 ${
                    isSelected
                      ? 'border-cyan-500 shadow-lg shadow-cyan-500/10'
                      : isFailed
                      ? 'border-red-800/50'
                      : 'border-slate-700'
                  }`}
                >
                  {/* Device Header Row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-600 flex-shrink-0"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(device.id)}
                        aria-label={`Select device ${device.hostname}`}
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-100 text-sm truncate">{device.hostname}</h4>
                        {device.imagingTaskSequence && (
                          <p className="text-xs text-slate-500 truncate">
                            Task Sequence: {device.imagingTaskSequence}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ImagingStatusBadge status={status} />
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                        title="Remove device from monitor"
                        aria-label={`Remove ${device.hostname}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <ImagingProgressBar progress={progress} status={status} />
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5 border-t border-slate-700/60 pt-3">
                    <div>
                      <MetadataRow label="Serial Number" value={device.serialNumber} />
                      <MetadataRow label="Model" value={device.model} />
                      <MetadataRow
                        label="MAC Address"
                        value={
                          device.mac
                            ? device.mac.replace(/(.{2})(?=.)/g, '$1:')
                            : undefined
                        }
                      />
                      <MetadataRow label="IP Address" value={device.ipAddress} />
                    </div>
                    <div>
                      <MetadataRow label="BIOS Version" value={device.biosVersion} />
                      <MetadataRow
                        label="RAM"
                        value={device.ramAmount ? `${device.ramAmount} GB` : undefined}
                      />
                      <MetadataRow
                        label="Disk"
                        value={device.diskSpace ? `${device.diskSpace.total} GB` : undefined}
                      />
                      <MetadataRow
                        label="Encryption"
                        value={device.encryptionStatus}
                      />
                    </div>
                  </div>

                  {/* Timestamp & Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-3 pt-2 border-t border-slate-700/40 gap-2">
                    <span className="text-xs text-slate-500">
                      Metadata collected: {formatTimestamp(device.metadataCollectedAt?.toISOString())}
                    </span>
                    {isReady && (
                      <button
                        onClick={() => handlePromoteSingle(device.id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-cyan-600 text-white hover:bg-cyan-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50"
                      >
                        Promote to Deployment
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
