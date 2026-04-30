import React, { useState, useEffect, useRef } from 'react';
import { ImagingDevice } from '../types';
import { FileCode, Play, Save, Terminal, Activity, CheckCircle, AlertTriangle, X, RefreshCw, Upload, ChevronRight, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../contexts/AppContext';

interface ImagingScriptViewerProps {
    devices: ImagingDevice[];
}

const AVAILABLE_SCRIPTS = [
    {
        name: 'Full Windows Imaging (DISM)',
        content: `# Full Windows Imaging Script (WinPE/DISM)\n# This script executes the complete imaging sequence for enterprise deployment.\n# It assumes the environment is booted into WinPE and network shares are mapped.\n\necho "====================================================="\necho "        Enterprise Windows Imaging Sequence          "\necho "====================================================="\n\necho "[INFO] Step 1: Cleaning and partitioning disk 0..."\n# Using a predefined diskpart script to ensure consistent partition layout (UEFI/GPT)\ndiskpart /s X:\\Windows\\System32\\diskpart_script.txt\n\necho "[INFO] Step 2: Applying Windows Image (install.wim)..."\n# Applying the customized enterprise WIM image to the Windows partition\ndism /Apply-Image /ImageFile:Z:\\Images\\Windows11_Enterprise_22H2_Custom.wim /Index:1 /ApplyDir:W:\\\n\necho "[INFO] Step 3: Creating Boot Files (BCDBoot)..."\n# Writing boot environment files to the EFI system partition\nW:\\Windows\\System32\\bcdboot W:\\Windows /s S: /f ALL\n\necho "[INFO] Step 4: Injecting Device Drivers..."\n# Recursively adding out-of-box drivers based on the detected hardware model\ndism /Image:W:\\ /Add-Driver /Driver:Z:\\Drivers\\Model_Specific /Recurse\n\necho "[INFO] Step 5: Applying Unattend.xml (Sysprep configuration)..."\n# Copying the answer file for OOBE automation, domain join, and local admin setup\ncopy Z:\\Configs\\unattend.xml W:\\Windows\\System32\\Sysprep\\unattend.xml\n\necho "[INFO] Step 6: Setting up Recovery Environment (WinRE)..."\n# Configuring the Windows Recovery Environment\nmd W:\\Recovery\\WindowsRE\ncopy W:\\Windows\\System32\\Recovery\\winre.wim W:\\Recovery\\WindowsRE\\winre.wim\nW:\\Windows\\System32\\reagentc /setreimage /path W:\\Recovery\\WindowsRE /target W:\\Windows\n\necho "[INFO] Step 7: Applying Custom Registry Settings..."\n# Loading the offline registry hive to apply enterprise policies before first boot\nreg load HKLM\\Offline W:\\Windows\\System32\\config\\SOFTWARE\nreg import Z:\\Configs\\EnterprisePolicies.reg\nreg unload HKLM\\Offline\n\necho "[SUCCESS] Imaging complete. System will reboot shortly."\nwpeutil reboot\n`
    },
    {
        name: 'Lite Touch Deployment',
        content: `# Lite Touch Deployment Script\necho "Starting Lite Touch Deployment..."\necho "[INFO] Partitioning..."\necho "[INFO] Applying Image..."\necho "[SUCCESS] Deployment Complete."\n`
    },
    {
        name: 'Diagnostic & Recovery',
        content: `# Diagnostic & Recovery Script\necho "Running system diagnostics..."\necho "[INFO] Checking disk for errors..."\nchkdsk W: /f\necho "[INFO] Repairing boot records..."\nbootrec /fixmbr\nbootrec /fixboot\necho "[SUCCESS] Diagnostics complete."\n`
    }
];

export const ImagingScriptViewer: React.FC<ImagingScriptViewerProps> = ({ devices }) => {
    const { dispatch } = useAppContext();
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
    const [scriptContent, setScriptContent] = useState<string>(AVAILABLE_SCRIPTS[0].content);
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionProgress, setExecutionProgress] = useState(0);
    const [executionLogs, setExecutionLogs] = useState<string[]>([]);
    const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
    const logsEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const selectedDevice = devices.find(d => d.id === selectedDeviceId);

    useEffect(() => {
        if (selectedDevice?.scriptContent) {
            setScriptContent(selectedDevice.scriptContent);
        }
    }, [selectedDeviceId, selectedDevice]);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [executionLogs]);

    const handleRunScript = () => {
        const targetDevices = selectedDeviceId ? [selectedDevice].filter(Boolean) as ImagingDevice[] : devices;
        
        if (targetDevices.length === 0) {
            alert("No devices available to run the script.");
            return;
        }

        setIsExecuting(true);
        setExecutionStatus('running');
        setExecutionProgress(0);
        setExecutionLogs([`[${new Date().toLocaleTimeString()}] Starting execution on ${targetDevices.length} device(s)...`]);

        const steps = [
            { msg: "Connecting to target devices via WinRM...", delay: 1000 },
            { msg: "Authentication successful.", delay: 800 },
            { msg: "Transferring script payload...", delay: 1500 },
            { msg: "Executing imaging sequence...", delay: 2000 },
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

    const handleSelectScript = (content: string) => {
        setScriptContent(content);
        if (selectedDeviceId) {
            dispatch({ type: 'SET_IMAGING_DEVICE_SCRIPT', payload: { deviceId: selectedDeviceId, content } });
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setScriptContent(content);
            if (selectedDeviceId) {
                dispatch({ type: 'SET_IMAGING_DEVICE_SCRIPT', payload: { deviceId: selectedDeviceId, file, content } });
            }
        };
        reader.readAsText(file);
    };

    const handleSaveScript = () => {
        if (selectedDeviceId) {
            dispatch({ type: 'SET_IMAGING_DEVICE_SCRIPT', payload: { deviceId: selectedDeviceId, content: scriptContent } });
        }
        const blob = new Blob([scriptContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedDevice ? `${selectedDevice.hostname}_script.ps1` : 'imaging_script.ps1';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                        <h2 className="text-xl font-bold text-white">
                            {selectedDevice ? `Script Editor: ${selectedDevice.hostname}` : 'Imaging Script Editor'}
                        </h2>
                    </div>
                    <div className="flex gap-2">
                        {selectedDeviceId && (
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 flex items-center gap-2 transition-colors"
                            >
                                <Upload size={16} /> Upload
                            </button>
                        )}
                        <button 
                            onClick={handleSaveScript}
                            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 flex items-center gap-2 transition-colors"
                        >
                            <Save size={16} /> Save
                        </button>
                        <button 
                            onClick={handleRunScript}
                            disabled={isExecuting || devices.length === 0}
                            className="px-4 py-2 bg-[#39FF14] text-black font-bold rounded hover:bg-[#32e612] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                        >
                            <Play size={16} /> {selectedDeviceId ? 'Run on Device' : 'Run on All'}
                        </button>
                    </div>
                </div>

                {selectedDeviceId && (
                    <div className="bg-gray-900 p-3 rounded-lg border border-gray-800 flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase mr-2">Available Scripts:</span>
                        {AVAILABLE_SCRIPTS.map((script, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSelectScript(script.content)}
                                className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded-full hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
                            >
                                {script.name}
                            </button>
                        ))}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                            className="hidden" 
                            accept=".ps1,.bat,.txt"
                        />
                    </div>
                )}

                <div className="bg-gray-900 flex-grow rounded-lg border border-gray-800 p-4 font-mono text-sm text-gray-300 overflow-auto">
                    <textarea 
                        className="w-full h-full bg-transparent border-none outline-none resize-none"
                        value={scriptContent}
                        onChange={(e) => {
                            setScriptContent(e.target.value);
                        }}
                        spellCheck="false"
                    />
                </div>
            </div>

            <div className="lg:col-span-1 bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-[#39FF14] flex items-center gap-2">
                        <Terminal size={20} /> Monitor Devices ({devices.length})
                    </h3>
                    {selectedDeviceId && (
                        <button 
                            onClick={() => setSelectedDeviceId(null)}
                            className="text-xs text-gray-500 hover:text-white"
                        >
                            Clear Selection
                        </button>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {devices.length === 0 ? (
                        <p className="text-gray-500 italic">No devices in monitor.</p>
                    ) : (
                        devices.map(device => (
                            <button 
                                key={device.id} 
                                onClick={() => setSelectedDeviceId(device.id)}
                                className={`w-full text-left p-3 rounded border transition-all flex justify-between items-center group ${
                                    selectedDeviceId === device.id 
                                        ? 'bg-[#39FF14]/10 border-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.1)]' 
                                        : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${selectedDeviceId === device.id ? 'bg-[#39FF14] text-black' : 'bg-gray-800 text-gray-400 group-hover:text-gray-300'}`}>
                                        <ChevronRight size={14} className={selectedDeviceId === device.id ? 'rotate-90' : ''} />
                                    </div>
                                    <div>
                                        <div className={`font-bold transition-colors ${selectedDeviceId === device.id ? 'text-[#39FF14]' : 'text-white'}`}>
                                            {device.hostname}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                            {device.scriptFile || device.scriptContent ? <File size={10} className="text-[#39FF14]" /> : null}
                                            {device.ipAddress}
                                        </div>
                                    </div>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded ${
                                    device.status === 'Completed' ? 'bg-green-900 text-green-300' :
                                    device.status === 'Failed' ? 'bg-red-900 text-red-300' :
                                    'bg-blue-900 text-blue-300'
                                }`}>
                                    {device.status}
                                </div>
                            </button>
                        ))
                    )}
                </div>
                
                {selectedDevice && (
                    <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Device Context</h4>
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Model:</span>
                                <span className="text-gray-200">{selectedDevice.model}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">MAC:</span>
                                <span className="text-gray-200">{selectedDevice.macAddress}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Assigned Script:</span>
                                <span className="text-blue-400">{selectedDevice.scriptFile?.name || (selectedDevice.scriptContent ? 'Custom Entry' : 'Default')}</span>
                            </div>
                        </div>
                    </div>
                )}
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

