import React, { useEffect, useState } from 'react';

interface AdminGateModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AdminGateModal: React.FC<AdminGateModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAcknowledged(false);
      setTypedValue('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isReady = acknowledged && typedValue.trim().toUpperCase() === 'ADMIN';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-cyan-400">Administrator Verification Required</h2>
        <p className="text-sm text-slate-300 mt-2">
          This action can affect devices or network behavior. Only authorized administrators may proceed.
        </p>

        <div className="mt-4 space-y-3 text-sm text-slate-300">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1"
            />
            <span>
              I confirm I am authorized to perform administrative actions on this network.
            </span>
          </label>

          <div>
            <label htmlFor="adminConfirm" className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Type ADMIN to continue
            </label>
            <input
              id="adminConfirm"
              value={typedValue}
              onChange={(event) => setTypedValue(event.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isReady}
            className="px-4 py-2 text-sm font-semibold bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition"
          >
            Verify Admin
          </button>
        </div>
      </div>
    </div>
  );
};
