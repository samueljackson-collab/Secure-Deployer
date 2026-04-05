import React, { useState, useEffect } from 'react';
import type { SavedScript } from '../src/types';

interface ScriptManagerProps {
    scripts: SavedScript[];
    activeScriptId: string | null;
    onAddScript: (script: SavedScript) => void;
    onUpdateScript: (script: SavedScript) => void;
    onDeleteScript: (id: string) => void;
    onSetActiveScript: (id: string | null) => void;
}

export const ScriptManager: React.FC<ScriptManagerProps> = ({
    scripts,
    activeScriptId,
    onAddScript,
    onUpdateScript,
    onDeleteScript,
    onSetActiveScript,
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState('');
    const [draftContent, setDraftContent] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const selectedScript = scripts.find(s => s.id === editingId);

    useEffect(() => {
        if (selectedScript) {
            setDraftName(selectedScript.name);
            setDraftContent(selectedScript.content);
        }
    }, [editingId]);

    const handleSelectScript = (id: string) => {
        setIsCreating(false);
        setEditingId(id);
        const s = scripts.find(sc => sc.id === id);
        if (s) {
            setDraftName(s.name);
            setDraftContent(s.content);
        }
    };

    const handleNew = () => {
        setIsCreating(true);
        setEditingId(null);
        setDraftName('New Script');
        setDraftContent('');
    };

    const handleSave = () => {
        if (!draftName.trim()) return;
        if (isCreating) {
            const newScript: SavedScript = {
                id: `script-${Date.now()}`,
                name: draftName.trim(),
                content: draftContent,
            };
            onAddScript(newScript);
            setEditingId(newScript.id);
            setIsCreating(false);
        } else if (editingId) {
            onUpdateScript({ id: editingId, name: draftName.trim(), content: draftContent });
        }
    };

    const handleDelete = () => {
        if (!editingId || !window.confirm('Are you sure you want to delete this script?')) return;
        onDeleteScript(editingId);
        setEditingId(null);
        setDraftName('');
        setDraftContent('');
        setIsCreating(false);
    };

    const isEditing = isCreating || editingId !== null;
    const hasChanges = isEditing && selectedScript
        ? draftName !== selectedScript.name || draftContent !== selectedScript.content
        : isCreating;

    return (
        <div className="space-y-3 pt-2">
            {/* Script list */}
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {scripts.length === 0 && !isCreating && (
                    <p className="text-xs text-gray-500 italic">No scripts saved yet.</p>
                )}
                {scripts.map(script => (
                    <div
                        key={script.id}
                        onClick={() => handleSelectScript(script.id)}
                        className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-sm ${
                            editingId === script.id
                                ? 'bg-gray-700 text-white'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                        }`}
                    >
                        <span className="truncate flex-1">{script.name}</span>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                            {activeScriptId === script.id ? (
                                <span className="text-[10px] px-1.5 py-0.5 bg-[#39FF14] text-black rounded font-bold">
                                    Active
                                </span>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSetActiveScript(script.id); }}
                                    className="text-[10px] px-1.5 py-0.5 bg-gray-600 text-gray-300 rounded hover:bg-gray-500"
                                >
                                    Set Active
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Editor area */}
            {isEditing && (
                <div className="space-y-2">
                    <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder="Script name"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
                    />
                    <textarea
                        value={draftContent}
                        onChange={(e) => setDraftContent(e.target.value)}
                        placeholder="Enter script content..."
                        rows={6}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 font-mono placeholder-gray-600 resize-y focus:outline-none focus:border-[#39FF14]"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={!draftName.trim()}
                            className="flex-1 px-3 py-1.5 bg-[#39FF14] text-black text-xs font-bold rounded hover:bg-[#32e612] disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                        >
                            {isCreating ? 'Create' : 'Save'}
                        </button>
                        {!isCreating && editingId && (
                            <button
                                onClick={handleDelete}
                                className="px-3 py-1.5 bg-red-900 text-red-300 text-xs font-bold rounded hover:bg-red-800"
                            >
                                Delete
                            </button>
                        )}
                        <button
                            onClick={() => { setIsCreating(false); setEditingId(null); }}
                            className="px-3 py-1.5 bg-gray-700 text-gray-300 text-xs font-bold rounded hover:bg-gray-600"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* New script button */}
            {!isEditing && (
                <button
                    onClick={handleNew}
                    className="w-full px-3 py-1.5 bg-gray-800 text-[#39FF14] text-xs font-bold rounded border border-gray-700 hover:bg-gray-700 flex items-center justify-center gap-1"
                >
                    <span>+</span> New Script
                </button>
            )}
        </div>
    );
};
