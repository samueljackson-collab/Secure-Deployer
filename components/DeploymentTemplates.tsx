
import React, { useState } from 'react';
import type { DeploymentTemplate } from '../types';

interface Props {
    templates: DeploymentTemplate[];
    currentSettings: { maxRetries: number; retryDelay: number; autoRebootEnabled: boolean };
    onSave: (template: Omit<DeploymentTemplate, 'id' | 'createdAt'>) => void;
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
}

export const DeploymentTemplates: React.FC<Props> = ({
    templates,
    currentSettings,
    onSave,
    onLoad,
    onDelete,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({
            name: name.trim(),
            description: description.trim(),
            notes: notes.trim() || undefined,
            settings: { ...currentSettings },
        });
        setName('');
        setDescription('');
        setNotes('');
        setIsCreating(false);
    };

    const handleCancel = () => {
        setIsCreating(false);
        setName('');
        setDescription('');
        setNotes('');
    };

    return (
        <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
            <button
                className="w-full text-left flex justify-between items-center"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#39FF14]" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                    </svg>
                    <h3 className="text-sm font-bold text-[#39FF14]">Deployment Templates</h3>
                    {templates.length > 0 && (
                        <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full font-bold">
                            {templates.length}
                        </span>
                    )}
                </div>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 text-gray-500 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {isExpanded && (
                <div className="mt-3 space-y-3">
                    <p className="text-xs text-gray-600">
                        Save your current Advanced Settings as a named template. Load a template to instantly apply its settings.
                    </p>

                    {/* Template list */}
                    {templates.length === 0 && !isCreating && (
                        <p className="text-xs text-gray-700 text-center py-3 border border-dashed border-gray-800 rounded-md">
                            No templates saved yet.
                        </p>
                    )}

                    {templates.map(tpl => (
                        <div key={tpl.id} className="bg-black/50 border border-gray-800 rounded-md p-3">
                            <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-sm text-gray-200 truncate">{tpl.name}</p>
                                    {tpl.description && (
                                        <p className="text-xs text-gray-500 mt-0.5 truncate">{tpl.description}</p>
                                    )}
                                    <p className="text-xs text-gray-700 font-mono mt-1">
                                        Retries: {tpl.settings.maxRetries} · Delay: {tpl.settings.retryDelay}s · Reboot: {tpl.settings.autoRebootEnabled ? 'Auto' : 'Manual'}
                                    </p>
                                    {tpl.notes && (
                                        <p className="text-xs text-gray-600 italic mt-1 truncate">{tpl.notes}</p>
                                    )}
                                    <p className="text-xs text-gray-800 mt-1">
                                        {new Date(tpl.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        onClick={() => onLoad(tpl.id)}
                                        className="px-2 py-1 text-xs font-bold bg-[#39FF14] text-black rounded hover:bg-[#2ECC10] transition-colors"
                                        title="Apply this template's settings to Advanced Settings"
                                    >
                                        Load
                                    </button>
                                    <button
                                        onClick={() => onDelete(tpl.id)}
                                        className="px-2 py-1 text-xs font-bold bg-gray-800 text-red-400 rounded hover:bg-red-900/50 transition-colors"
                                        title="Delete this template"
                                    >
                                        Del
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* New template form */}
                    {isCreating ? (
                        <div className="bg-black/50 border border-gray-700 rounded-md p-3 space-y-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">New Template</p>
                            <input
                                type="text"
                                placeholder="Template name *"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-[#39FF14]"
                                autoFocus
                            />
                            <input
                                type="text"
                                placeholder="Description (optional)"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-[#39FF14]"
                            />
                            <textarea
                                placeholder="Notes (optional)"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-[#39FF14] resize-none"
                            />
                            <p className="text-xs text-gray-700 font-mono">
                                Will capture → Retries: {currentSettings.maxRetries} · Delay: {currentSettings.retryDelay}s · Reboot: {currentSettings.autoRebootEnabled ? 'Auto' : 'Manual'}
                            </p>
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleSave}
                                    disabled={!name.trim()}
                                    className="flex-1 px-3 py-1.5 text-xs font-bold bg-[#39FF14] text-black rounded hover:bg-[#2ECC10] disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                                >
                                    Save Template
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="px-3 py-1.5 text-xs font-bold bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="w-full px-3 py-2 text-xs font-bold border border-dashed border-gray-700 text-gray-600 rounded-md hover:border-[#39FF14] hover:text-[#39FF14] transition-colors"
                        >
                            + Save Current Settings as Template
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
