
import React from 'react';
import type { DeploymentOperationType } from '../types';
import { Tooltip } from './Tooltip';

interface BulkActionsProps {
    selectedCount: number;
    onUpdate: () => void;
    onCancel: () => void;
    onValidate: () => void;
    onExecute: () => void;
    onRemove: () => void;
    onDeployOperation: (payload: { operation: DeploymentOperationType; file: File }) => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({ selectedCount, onUpdate, onCancel, onValidate, onExecute, onRemove, onDeployOperation }) => {
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

    const executeOperation = (operation: DeploymentOperationType) => {
        if (!selectedFile) return;
        onDeployOperation({ operation, file: selectedFile });
    };

    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg border border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm font-semibold text-[#39FF14]">
                {selectedCount} device{selectedCount > 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
                <Tooltip content="Run a full BIOS, DCU, and Windows update on all selected devices." position="top">
                    <button
                        onClick={onUpdate}
                        className="px-4 py-2 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#2ECC10] transition duration-200 shadow-md"
                    >
                        Update Selected
                    </button>
                </Tooltip>
                <Tooltip content="Execute the assigned script on all selected devices that are in 'Ready for Execution' state." position="top">
                    <button
                        onClick={onExecute}
                        className="px-4 py-2 bg-yellow-500 text-black text-sm font-semibold rounded-lg hover:bg-yellow-400 transition duration-200 shadow-md"
                    >
                        Execute Selected Scripts
                    </button>
                </Tooltip>
                <Tooltip content="Re-run the compliance scan (BIOS, DCU, Windows, Encryption, CrowdStrike, SCCM) on selected devices." position="top">
                    <button
                        onClick={onValidate}
                        className="px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-lg hover:bg-gray-500 transition duration-200 shadow-md disabled:bg-gray-800 disabled:cursor-not-allowed"
                        disabled={selectedCount === 0}
                    >
                        Validate Selected
                    </button>
                </Tooltip>
                <Tooltip content="Interrupt any in-progress operation on selected devices and mark them as Cancelled." position="top">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 transition duration-200 shadow-md"
                    >
                        Cancel Selected
                    </button>
                </Tooltip>
                <Tooltip content="Permanently remove selected devices from the deployment runner list." position="top">
                    <button
                        onClick={onRemove}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition duration-200 shadow-md"
                    >
                        Remove Selected
                    </button>
                </Tooltip>
                <Tooltip content="Choose the file to run, install, or delete on selected devices." position="top">
                    <label className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition duration-200 shadow-md cursor-pointer">
                        Select Deploy File
                        <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                    </label>
                </Tooltip>
                <Tooltip content="Execute the selected file on all targeted devices. File must exist on the target." position="top">
                    <button
                        onClick={() => executeOperation('run')}
                        disabled={!selectedFile}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        Run File
                    </button>
                </Tooltip>
                <Tooltip content="Push and install the selected package on all targeted devices." position="top">
                    <button
                        onClick={() => executeOperation('install')}
                        disabled={!selectedFile}
                        className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        Install File
                    </button>
                </Tooltip>
                <Tooltip content="Remove the specified program or file from all targeted devices. Use with caution." position="top">
                    <button
                        onClick={() => executeOperation('delete')}
                        disabled={!selectedFile}
                        className="px-4 py-2 bg-rose-700 text-white text-sm font-semibold rounded-lg hover:bg-rose-600 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        Delete Program/File
                    </button>
                </Tooltip>
            </div>
            {selectedFile && <p className="text-xs text-gray-400">Deploy target: {selectedFile.name}</p>}
        </div>
    );
};
