import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';

export const DeploymentTemplates: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDesc, setNewTemplateDesc] = useState('');

    const handleSave = () => {
        if (!newTemplateName.trim()) {
            dispatch({ type: 'ADD_LOG', payload: { timestamp: new Date(), message: 'Template name cannot be empty.', level: 'ERROR' } });
            return;
        }
        dispatch({ 
            type: 'SAVE_TEMPLATE', 
            payload: { 
                id: Date.now().toString(),
                name: newTemplateName, 
                description: newTemplateDesc,
                settings: state.runner.settings,
                packages: [], // Add packages if needed
            } 
        });
        setNewTemplateName('');
        setNewTemplateDesc('');
    };

    return (
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg border border-gray-800">
            <h3 className="text-lg font-bold text-gray-200 mb-3">Deployment Templates</h3>
            <div className="space-y-3">
                {(state.runner.templates || []).map(template => (
                    <div key={template.id} className="bg-black/50 p-3 rounded-md border border-gray-700 flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-100">{template.name}</p>
                                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">Retries: {template.settings.maxRetries} / {template.settings.retryDelay}s delay</span>
                            </div>
                            <p className="text-xs text-gray-400">{template.description}</p>
                            <div className="flex gap-2 mt-1 font-mono">
                                <span className={`text-[10px] ${template.settings.autoRebootEnabled ? 'text-[#39FF14]' : 'text-gray-500'}`}>
                                    {template.settings.autoRebootEnabled ? 'Auto-Reboot: ON' : 'Auto-Reboot: OFF'}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => dispatch({ type: 'APPLY_TEMPLATE', payload: template })} className="px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-semibold rounded-lg transition-all border border-blue-600/30">Load</button>
                            <button onClick={() => dispatch({ type: 'DELETE_TEMPLATE', payload: template.id })} className="px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white text-xs font-semibold rounded-lg transition-all border border-red-600/30">Delete</button>
                        </div>
                    </div>
                ))}
                 {(state.runner.templates || []).length === 0 && <p className="text-sm text-gray-500 text-center py-4">No templates saved.</p>}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800">
                <h4 className="text-md font-semibold text-gray-300 mb-2 font-mono">Save Current Settings as Template</h4>
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 mb-4 flex flex-wrap gap-4 text-[10px]">
                    <div className="flex flex-col">
                        <span className="text-gray-500 uppercase font-bold">Max Retries</span>
                        <span className="text-[#39FF14]">{state.runner.settings.maxRetries}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500 uppercase font-bold">Retry Delay</span>
                        <span className="text-[#39FF14]">{state.runner.settings.retryDelay}s</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500 uppercase font-bold">Auto-Reboot</span>
                        <span className={state.runner.settings.autoRebootEnabled ? 'text-[#39FF14]' : 'text-red-400'}>
                            {state.runner.settings.autoRebootEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <input
                        type="text"
                        placeholder="Template Name"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="bg-gray-800 text-white placeholder-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#39FF14]"
                    />
                    <input
                        type="text"
                        placeholder="Description (Optional)"
                        value={newTemplateDesc}
                        onChange={(e) => setNewTemplateDesc(e.target.value)}
                        className="bg-gray-800 text-white placeholder-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#39FF14]"
                    />
                    <button 
                        onClick={handleSave}
                        className="px-4 py-2 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#2ECC10] transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
                    >
                        Save Template
                    </button>
                </div>
            </div>
        </div>
    );
};
