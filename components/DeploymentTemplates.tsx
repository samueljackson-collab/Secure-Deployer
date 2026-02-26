import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';

export const DeploymentTemplates: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDesc, setNewTemplateDesc] = useState('');

    const handleSave = () => {
        if (!newTemplateName.trim() || state.runner.devices.length === 0) {
            dispatch({ type: 'ADD_LOG', payload: { timestamp: new Date(), message: 'Template name cannot be empty and must have devices to save.', level: 'ERROR' } });
            return;
        }
        dispatch({ type: 'SAVE_TEMPLATE', payload: { name: newTemplateName, description: newTemplateDesc } });
        setNewTemplateName('');
        setNewTemplateDesc('');
    };

    return (
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg border border-gray-800">
            <h3 className="text-lg font-bold text-gray-200 mb-3">Deployment Templates</h3>
            <div className="space-y-3">
                {state.ui.templates.map(template => (
                    <div key={template.id} className="bg-black/50 p-3 rounded-md border border-gray-700 flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-gray-100">{template.name}</p>
                            <p className="text-xs text-gray-400">{template.description} ({template.devices.length} devices)</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => dispatch({ type: 'LOAD_TEMPLATE', payload: template.id })} className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-500 transition-colors">Load</button>
                            <button onClick={() => dispatch({ type: 'DELETE_TEMPLATE', payload: template.id })} className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-500 transition-colors">Delete</button>
                        </div>
                    </div>
                ))}
                 {state.ui.templates.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No templates saved.</p>}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800">
                <h4 className="text-md font-semibold text-gray-300 mb-2">Save Current Device List as Template</h4>
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
                        disabled={state.runner.devices.length === 0}
                        className="px-4 py-2 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#2ECC10] transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
                    >
                        Save Template
                    </button>
                </div>
            </div>
        </div>
    );
};
