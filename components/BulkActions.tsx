
import React from 'react';

interface BulkActionsProps {
    selectedCount: number;
    onUpdate: () => void;
    onCancel: () => void;
    onValidate: () => void;
    onExecute: () => void;
    onRemove: () => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({ selectedCount, onUpdate, onCancel, onValidate, onExecute, onRemove }) => {
    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg border border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm font-semibold text-[#39FF14]">
                {selectedCount} device{selectedCount > 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
                <button
                    onClick={onUpdate}
                    className="px-4 py-2 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#2ECC10] transition duration-200 shadow-md"
                >
                    Update Selected
                </button>
                <button
                    onClick={onExecute}
                    className="px-4 py-2 bg-yellow-500 text-black text-sm font-semibold rounded-lg hover:bg-yellow-400 transition duration-200 shadow-md"
                >
                    Execute Selected Scripts
                </button>
                <button
                    onClick={onValidate}
                    className="px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-lg hover:bg-gray-500 transition duration-200 shadow-md"
                >
                    Validate Selected
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 transition duration-200 shadow-md"
                >
                    Cancel Selected
                </button>
                 <button
                    onClick={onRemove}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition duration-200 shadow-md"
                >
                    Remove Selected
                </button>
            </div>
        </div>
    );
};
