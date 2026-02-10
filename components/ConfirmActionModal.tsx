import React, { useState } from 'react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  deviceCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  description,
  deviceCount,
  onConfirm,
  onCancel,
}) => {
  const [typedValue, setTypedValue] = useState('');

  if (!isOpen) return null;

  const isReady = typedValue.trim().toUpperCase() === 'CONFIRM';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-cyan-400">{title}</h2>
        <p className="text-sm text-slate-300 mt-2">{description}</p>
        <p className="text-sm text-slate-300 mt-2">
          Devices affected: <span className="font-semibold text-cyan-400">{deviceCount}</span>
        </p>

        <div className="mt-4">
          <label htmlFor="confirmAction" className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
            Type CONFIRM to proceed
          </label>
          <input
            id="confirmAction"
            value={typedValue}
            onChange={(event) => setTypedValue(event.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => {
              setTypedValue('');
              onCancel();
            }}
            className="px-4 py-2 text-sm font-semibold bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (isReady) {
                setTypedValue('');
                onConfirm();
              }
            }}
            disabled={!isReady}
            className="px-4 py-2 text-sm font-semibold bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition"
          >
            Confirm Action
          </button>
        </div>
      </div>
    </div>
  );
};
