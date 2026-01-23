
import React from 'react';

interface BulkActionsProps {
    selectedCount: number;
    onUpdate: () => void;
    onCancel: () => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({ selectedCount, onUpdate, onCancel }) => {
    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm font-semibold text-cyan-400">
                {selectedCount} device{selectedCount > 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center gap-4">
                <button
                    onClick={onUpdate}
                    className="px-4 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 transition duration-200 shadow-md"
                >
                    Update Selected
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition duration-200 shadow-md"
                >
                    Cancel Selected
                </button>
            </div>
        </div>
    );
};
