import React, { useState, useEffect, useRef } from 'react';
import { ImagingDevice } from '../types';
import { FileCode, Play, Save, Terminal, Activity, CheckCircle, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AUTOTAG_WINPE_SCRIPT } from '../services/powershellScript';

interface ImagingScriptViewerProps {
    devices: ImagingDevice[];
}

export const ImagingScriptViewer: React.FC<ImagingScriptViewerProps> = ({ devices }) => {
    const [scriptContent, setScriptContent] = useState<string>(AUTOTAG_WINPE_SCRIPT);

    const [isExecuting, setIsExecuting] = useState(false);
    const [executionProgress, setExecutionProgress] = useState(0);
    const [executionLogs, setExecutionLogs] = useState<string[]>([]);
    const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [executionLogs]);

    const handleRunScript = () => {
        if (devices.length === 0) {
            alert("No devices available to run the script.");
            return;
        }

        setIsExecuting(true);
        setExecutionStatus('running');
        setExecutionProgress(0);
        setExecutionLogs([`[${new Date().toLocaleTimeString()}] Starting execution on ${devices.length} device(s)...`]);

        const steps = [
            { msg: "Connecting to target devices via WinRM...", delay: 1000 },
            { msg: "Authentication successful.", delay: 800 },
            { msg: "Transferring script payload...", delay: 1500 },
            { msg: "Executing: Step 1: Cleaning and partitioning disk 0...", delay: 2000 },
            { msg: "Executing: Step 2: Applying Windows Image (install.wim)...", delay: 3000 },
            { msg: "Executing: Step 3: Creating Boot Files (BCDBoot)...", delay: 1500 },
            { msg: "Executing: Step 4: Injecting Device Drivers...", delay: 2500 },
            { msg: "Executing: Step 5: Applying Unattend.xml...", delay: 1000 },
            { msg: "Executing: Step 6: Setting up Recovery Environment...", delay: 1500 },
            { msg: "Executing: Step 7: Applying Custom Registry Settings...", delay: 1000 },
            { msg: "Script execution completed successfully.", delay: 500 }
        ];

        let currentStep = 0;

        const runNextStep = () => {
            if (currentStep >= steps.length) {
                setExecutionStatus('completed');
                setExecutionProgress(100);
                return;
            }

            const step = steps[currentStep];
            setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step.msg}`]);
            setExecutionProgress(Math.round(((currentStep + 1) / steps.length) * 100));
            
            currentStep++;
            setTimeout(runNextStep, step.delay);
        };

        runNextStep();
    };

    const closeExecutionModal = () => {
        setIsExecuting(false);
        setExecutionStatus('idle');
        setExecutionLogs([]);
        setExecutionProgress(0);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-12rem)] relative">
            <div className="lg:col-span-2 flex flex-col gap-4 h-full">
                <div className="bg-gray-950 p-4 rounded-lg shadow-lg border border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileCode className="text-[#39FF14]" />
                        <h2 className="text-xl font-bold text-white">Imaging Script Editor</h2>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 flex items-center gap-2 transition-colors">
                            <Save size={16} /> Save
                        </button>
                        <button 
                            onClick={handleRunScript}
                            disabled={isExecuting || devices.length === 0}
                            className="px-4 py-2 bg-[#39FF14] text-black font-bold rounded hover:bg-[#32e612] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                        >
                            <Play size={16} /> Run on All
                        </button>
                    </div>
                </div>
                <div className="bg-gray-900 flex-grow rounded-lg border border-gray-800 p-4 font-mono text-sm text-gray-300 overflow-auto">
                    <textarea 
                        className="w-full h-full bg-transparent border-none outline-none resize-none"
                        value={scriptContent}
                        onChange={(e) => setScriptContent(e.target.value)}
                        spellCheck="false"
                    />
                </div>
            </div>

            <div className="lg:col-span-1 bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 flex flex-col h-full">
                <h3 className="text-lg font-bold text-[#39FF14] mb-4 flex items-center gap-2">
                    <Terminal size={20} /> Target Devices ({devices.length})
                </h3>
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {devices.length === 0 ? (
                        <p className="text-gray-500 italic">No devices in monitor.</p>
                    ) : (
                        devices.map(device => (
                            <div key={device.id} className="p-3 bg-gray-900 rounded border border-gray-800 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-white">{device.hostname}</div>
                                    <div className="text-xs text-gray-500">{device.ipAddress}</div>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded ${
                                    device.status === 'Completed' ? 'bg-green-900 text-green-300' :
                                    device.status === 'Failed' ? 'bg-red-900 text-red-300' :
                                    'bg-blue-900 text-blue-300'
                                }`}>
                                    {device.status}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Real-time Execution Overlay */}
            <AnimatePresence>
                {isExecuting && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[80%]"
                        >
                            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950 rounded-t-xl">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Activity className="text-[#39FF14]" /> 
                                    Live Execution Monitor
                                </h3>
                                {executionStatus !== 'running' && (
                                    <button onClick={closeExecutionModal} className="text-gray-400 hover:text-white transition-colors">
                                        <X size={24} />
                                    </button>
                                )}
                            </div>
                            
                            <div className="p-6 flex flex-col flex-grow overflow-hidden">
                                {/* Status and Progress */}
                                <div className="mb-6 space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-sm text-gray-400 mb-1">Overall Status</p>
                                            <div className="flex items-center gap-2">
                                                {executionStatus === 'running' && <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />}
                                                {executionStatus === 'completed' && <CheckCircle className="w-5 h-5 text-[#39FF14]" />}
                                                {executionStatus === 'failed' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                                                <span className={`font-bold text-lg ${
                                                    executionStatus === 'running' ? 'text-blue-400' :
                                                    executionStatus === 'completed' ? 'text-[#39FF14]' :
                                                    executionStatus === 'failed' ? 'text-red-500' : 'text-gray-400'
                                                }`}>
                                                    {executionStatus === 'running' ? 'Executing Script...' :
                                                     executionStatus === 'completed' ? 'Execution Completed' :
                                                     executionStatus === 'failed' ? 'Execution Failed' : 'Idle'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-2xl font-mono font-bold text-white">{executionProgress}%</span>
                                        </div>
                                    </div>
                                    
                                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                                        <motion.div 
                                            className={`h-full ${executionStatus === 'failed' ? 'bg-red-500' : 'bg-[#39FF14]'}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${executionProgress}%` }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    </div>
                                </div>

                                {/* Terminal Logs */}
                                <div className="flex-grow bg-black rounded-lg border border-gray-800 p-4 font-mono text-sm overflow-y-auto shadow-inner relative">
                                    <div className="absolute top-2 right-4 text-xs text-gray-600 select-none">TERMINAL OUTPUT</div>
                                    {executionLogs.map((log, i) => {
                                        let textColor = "text-gray-300";
                                        if (log.includes("[ERROR]")) textColor = "text-red-400 font-bold";
                                        else if (log.includes("[SUCCESS]")) textColor = "text-[#39FF14] font-bold";
                                        else if (log.includes("[INFO]")) textColor = "text-blue-300";
                                        
                                        return (
                                            <div key={i} className={`py-1 border-b border-gray-800/50 last:border-0 ${textColor}`}>
                                                {log}
                                            </div>
                                        );
                                    })}
                                    <div ref={logsEndRef} />
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

