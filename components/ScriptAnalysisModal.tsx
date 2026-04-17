import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scriptContent?: string;
}

export const ScriptAnalysisModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-lg font-bold text-[#39FF14] mb-4">Script Analysis</h2>
        <p className="text-gray-400 text-sm">AI script analysis coming soon.</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
        >
          Close
        </button>
      </div>
    </div>
  );
};
