import React, { useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Package, Trash2, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { SoftwarePackage } from '../types';

export const PackageManager: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { packages } = state.runner;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            Array.from(e.target.files).forEach(file => {
                const newPackage: SoftwarePackage = {
                    id: Math.random().toString(36).substring(7),
                    name: file.name,
                    file: file,
                    order: packages.length,
                    bypassAlerts: false
                };
                dispatch({ type: 'ADD_PACKAGE', payload: newPackage });
            });
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const movePackage = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index > 0) {
            const newPackages = [...packages];
            [newPackages[index - 1], newPackages[index]] = [newPackages[index], newPackages[index - 1]];
            dispatch({ type: 'REORDER_PACKAGES', payload: newPackages });
        } else if (direction === 'down' && index < packages.length - 1) {
            const newPackages = [...packages];
            [newPackages[index + 1], newPackages[index]] = [newPackages[index], newPackages[index + 1]];
            dispatch({ type: 'REORDER_PACKAGES', payload: newPackages });
        }
    };

    return (
        <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <h2 className="text-xl font-bold text-[#39FF14] flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Software Packages
                </h2>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded flex items-center gap-2"
                >
                    Add Files (.bat, .exe, .msi)
                </button>
                <input 
                    type="file" 
                    multiple 
                    accept=".bat,.exe,.msi" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
            </div>

            {packages.length === 0 ? (
                <div className="text-center py-8 text-gray-500 italic">
                    No software packages added. Click &quot;Add Files&quot; to select scripts or installers.
                </div>
            ) : (
                <div className="space-y-3">
                    {packages.map((pkg, index) => (
                        <div key={pkg.id} className="bg-gray-900 border border-gray-700 rounded p-3 flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-grow">
                                <div className="flex flex-col gap-1">
                                    <button 
                                        onClick={() => movePackage(index, 'up')} 
                                        disabled={index === 0}
                                        className="text-gray-500 hover:text-white disabled:opacity-30"
                                    >
                                        <ArrowUp size={14} />
                                    </button>
                                    <button 
                                        onClick={() => movePackage(index, 'down')} 
                                        disabled={index === packages.length - 1}
                                        className="text-gray-500 hover:text-white disabled:opacity-30"
                                    >
                                        <ArrowDown size={14} />
                                    </button>
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-200">{pkg.name}</div>
                                    <div className="text-xs text-gray-500">{(pkg.file.size / 1024 / 1024).toFixed(2)} MB</div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={pkg.bypassAlerts}
                                        onChange={(e) => dispatch({ type: 'UPDATE_PACKAGE', payload: { id: pkg.id, bypassAlerts: e.target.checked } })}
                                        className="rounded bg-gray-800 border-gray-600 text-[#39FF14] focus:ring-[#39FF14]"
                                    />
                                    <span className="text-sm text-gray-400 flex items-center gap-1" title="Automatically bypass any alerts or prompts during installation">
                                        <AlertTriangle size={14} className="text-yellow-500" />
                                        Bypass Alerts
                                    </span>
                                </label>
                                
                                <button 
                                    onClick={() => dispatch({ type: 'REMOVE_PACKAGE', payload: pkg.id })}
                                    className="text-red-500 hover:text-red-400 p-1"
                                    title="Remove Package"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
