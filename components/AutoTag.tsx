import React, { useState, useEffect } from 'react';
import { 
    Download, FileCode, Terminal, Usb, CheckCircle, AlertCircle, Server, Play, 
    HardDrive, X, Info, Activity, ChevronRight, ChevronLeft, Shield, Network, 
    Copy, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Script Content Generators ---

const getAutoTagBatContent = (networkShare: string) => `@echo off
:: AutoTag.bat - Wrapper to run the AutoTag PowerShell script
:: This script is intended to be run from a USB drive during a PXE Task Sequence

echo Starting AutoTag Device Metadata Capture...
pushd %~dp0

:: Check for PowerShell
where powershell >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] PowerShell not found. AutoTag requires PowerShell.
    pause
    exit /b 1
)

:: Run the PowerShell script
echo Running AutoTag.ps1...
:: You can pass a network share path as an argument to this batch file, 
:: or it will use the default configured below.
set "NETSHARE=${networkShare}"

if "%~1" neq "" set "NETSHARE=%~1"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\\AutoTag.ps1" -NetworkShare "%NETSHARE%"

if %errorlevel% neq 0 (
    echo [ERROR] AutoTag script failed.
    pause
    exit /b %errorlevel%
)

echo [SUCCESS] AutoTag completed successfully.
popd
exit /b 0
`;

const getAutoTagPs1Content = (networkShare: string) => `#Requires -Version 5.1
<#
.SYNOPSIS
    AutoTag - Device Metadata Gatherer
.DESCRIPTION
    Captures Host Name, IP Address, MAC Address, Device Model, and Asset Tag.
    Saves data to a JSON file on the USB drive or a network share.
    Includes robust logging and network validation.
.PARAMETER NetworkShare
    Optional network path to save the metadata.
#>

param (
    [string]$NetworkShare = "${networkShare}"
)

$ErrorActionPreference = "Stop"
$LogFile = Join-Path -Path $PSScriptRoot -ChildPath "AutoTag_Log_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$timestamp] [$Level] $Message"
    
    # Write to Console with Color
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        "SUCCESS" { "Green" }
        Default { "White" }
    }
    Write-Host $logMsg -ForegroundColor $color
    
    # Write to Log File
    Add-Content -Path $LogFile -Value $logMsg -ErrorAction SilentlyContinue
}

function Get-HardwareInfo {
    Write-Log "Gathering hardware information..."
    try {
        $nic = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -and $_.MACAddress } | Select-Object -First 1
        $computerSystem = Get-CimInstance -ClassName Win32_ComputerSystem
        $bios = Get-CimInstance -ClassName Win32_BIOS
        $enclosure = Get-CimInstance -ClassName Win32_SystemEnclosure

        if (-not $nic) {
            Write-Log "Could not find an active, IP-enabled network adapter." "WARN"
            return $null
        }

        $info = @{
            MacAddress    = ($nic.MACAddress -replace ":").ToUpper()
            IpAddress     = $nic.IPAddress[0]
            Model         = $computerSystem.Model
            SerialNumber  = $bios.SerialNumber
            AssetTag      = $enclosure.SMBIOSAssetTag
            Hostname      = $env:COMPUTERNAME
        }
        Write-Log "Hardware info gathered successfully." "SUCCESS"
        return $info
    }
    catch {
        Write-Log "An error occurred while gathering hardware info: $_" "ERROR"
        return $null
    }
}

# --- MAIN LOGIC ---

Write-Log "Starting AutoTag Device Capture"
Write-Log "Log file: $LogFile"

# 1. Validate Network Share (if provided)
if (-not [string]::IsNullOrWhiteSpace($NetworkShare)) {
    Write-Log "Validating network share: $NetworkShare"
    
    if (Test-Path -Path $NetworkShare) {
        Write-Log "Network share path exists." "SUCCESS"
        
        # Check Write Permissions
        $testFile = Join-Path -Path $NetworkShare -ChildPath "write_test_$(Get-Date -Format 'yyyyMMddHHmmss').tmp"
        try {
            "test" | Out-File -FilePath $testFile -ErrorAction Stop
            Remove-Item -Path $testFile -ErrorAction SilentlyContinue
            Write-Log "Write permission confirmed on network share." "SUCCESS"
        } catch {
            Write-Log "Write permission denied on network share: $_" "WARN"
            Write-Log "Metadata will ONLY be saved locally." "WARN"
            $NetworkShare = $null
        }
    } else {
        Write-Log "Network share not accessible or does not exist." "WARN"
        $NetworkShare = $null
    }
}

# 2. Gather Info
$hwInfo = Get-HardwareInfo
if (-not $hwInfo) {
    Write-Log "Failed to gather hardware data." "ERROR"
    exit 1
}

# 3. Display Info
Write-Log "Captured Data:"
$hwInfo.GetEnumerator() | ForEach-Object {
    Write-Host ("{0,-15}: {1}" -f $_.Name, $_.Value) -ForegroundColor Cyan
}

# 4. Save Data
$fileName = "DeviceMetadata_$($hwInfo.Hostname).json"

# Save to local (USB)
$localPath = Join-Path -Path $PSScriptRoot -ChildPath $fileName
try {
    $hwInfo | ConvertTo-Json | Out-File -FilePath $localPath -Encoding UTF8
    Write-Log "Saved locally: $localPath" "SUCCESS"
} catch {
    Write-Log "Failed to save locally: $_" "ERROR"
}

# Save to Network Share (if valid)
if (-not [string]::IsNullOrWhiteSpace($NetworkShare)) {
    try {
        $networkPath = Join-Path -Path $NetworkShare -ChildPath $fileName
        $hwInfo | ConvertTo-Json | Out-File -FilePath $networkPath -Encoding UTF8
        Write-Log "Saved to network: $networkPath" "SUCCESS"
    } catch {
        Write-Log "Failed to save to network share: $_" "ERROR"
    }
}

Write-Log "AutoTag process completed."
Start-Sleep -Seconds 3
`;

// --- Types & Components ---

interface ActivityLogEntry {
    id: string;
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'error';
}

const Tooltip: React.FC<{ content: string; children: React.ReactNode; className?: string }> = ({ content, children, className = "relative inline-block" }) => {
    const [isVisible, setIsVisible] = useState(false);
    return (
        <div className={className} onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute z-50 w-64 p-2 mt-2 text-xs text-gray-200 bg-gray-900 border border-gray-700 rounded-lg shadow-xl left-1/2 -translate-x-1/2 pointer-events-none"
                    >
                        {content}
                        <div className="absolute w-2 h-2 bg-gray-900 border-t border-l border-gray-700 -top-1 left-1/2 -translate-x-1/2 transform rotate-45"></div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Main Component ---

export const AutoTag: React.FC = () => {
    // Wizard State
    const [currentStep, setCurrentStep] = useState(1);
    const [deploymentMethod, setDeploymentMethod] = useState<'usb' | 'pxe'>('usb');

    // Functional State
    const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'complete'>('idle');
    const [usbStatus, setUsbStatus] = useState<'idle' | 'writing' | 'success' | 'error'>('idle');
    const [networkShare, setNetworkShare] = useState('');
    const [activePreview, setActivePreview] = useState<'bat' | 'ps1'>('bat');
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
    const [networkValidation, setNetworkValidation] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
    const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
    
    // Log Preview State
    const [logPreview, setLogPreview] = useState<string>('Click refresh to load the latest AutoTag.log content...');
    const [isLogLoading, setIsLogLoading] = useState(false);
    const [showScriptPreview, setShowScriptPreview] = useState(false);
    const [copiedSnippet, setCopiedSnippet] = useState(false);

    const addActivityLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        const newEntry: ActivityLogEntry = {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toLocaleTimeString(),
            message,
            type
        };
        setActivityLog(prev => [newEntry, ...prev].slice(0, 50));
    };

    // Automated Network Path Validation
    useEffect(() => {
        if (!networkShare) {
            setNetworkValidation('idle');
            return;
        }

        setNetworkValidation('validating');
        const timer = setTimeout(() => {
            // Regex for UNC path: \\Server\Share
            const uncRegex = /^\\\\[a-zA-Z0-9-._]+\\[a-zA-Z0-9-._]+/;
            if (uncRegex.test(networkShare)) {
                setNetworkValidation('valid');
            } else {
                setNetworkValidation('invalid');
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [networkShare]);

    const handleDownload = (filename: string, content: string) => {
        const element = document.createElement('a');
        const file = new Blob([content], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        addActivityLog(`Downloaded script: ${filename}`, 'success');
    };

    const handleDownloadPackage = () => {
        setDownloadStatus('downloading');
        addActivityLog('Started package download...', 'info');
        setTimeout(() => {
            handleDownload('AutoTag.bat', getAutoTagBatContent(networkShare));
            setTimeout(() => {
                handleDownload('AutoTag.ps1', getAutoTagPs1Content(networkShare));
                setDownloadStatus('complete');
                addActivityLog('Package download completed successfully.', 'success');
                setTimeout(() => setDownloadStatus('idle'), 3000);
            }, 500);
        }, 1000);
    };

    const handleSaveToUsb = async () => {
        setUsbStatus('writing');
        addActivityLog('Initiating save to USB...', 'info');
        try {
            // @ts-ignore - File System Access API
            const dirHandle = await window.showDirectoryPicker();
            
            // Write BAT
            const batHandle = await dirHandle.getFileHandle('AutoTag.bat', { create: true });
            const batWritable = await batHandle.createWritable();
            await batWritable.write(getAutoTagBatContent(networkShare));
            await batWritable.close();

            // Write PS1
            const ps1Handle = await dirHandle.getFileHandle('AutoTag.ps1', { create: true });
            const ps1Writable = await ps1Handle.createWritable();
            await ps1Writable.write(getAutoTagPs1Content(networkShare));
            await ps1Writable.close();

            setUsbStatus('success');
            addActivityLog('Successfully saved scripts to USB drive.', 'success');
            setTimeout(() => setUsbStatus('idle'), 3000);
        } catch (err) {
            console.error(err);
            setUsbStatus('error');
            addActivityLog(`Failed to save to USB: ${err}`, 'error');
            setTimeout(() => setUsbStatus('idle'), 3000);
        }
    };

    const runSimulation = () => {
        setIsSimulating(true);
        setSimulationLogs([]);
        addActivityLog('Started AutoTag simulation.', 'info');
        const logs: string[] = [];
        const addLog = (msg: string) => {
            logs.push(msg);
            setSimulationLogs([...logs]);
        };

        let step = 0;
        const steps = [
            () => addLog(`[INFO] Starting AutoTag Simulation...`),
            () => addLog(`[INFO] Validating network share: ${networkShare || 'None provided'}`),
            () => {
                if (networkShare && !/^\\\\[a-zA-Z0-9-._]+\\[a-zA-Z0-9-._]+/.test(networkShare)) {
                     addLog(`[WARN] Network share invalid or not accessible. Saving locally only.`);
                } else if (networkShare) {
                     addLog(`[SUCCESS] Network share exists.`);
                     addLog(`[SUCCESS] Write permission confirmed on network share.`);
                }
            },
            () => addLog(`[INFO] Gathering hardware information...`),
            () => {
                addLog(`[SUCCESS] Hardware info gathered successfully.`);
                addLog(`[DATA] Hostname: DESKTOP-SIM01`);
                addLog(`[DATA] IP: 192.168.1.105`);
                addLog(`[DATA] MAC: 00-15-5D-00-01-02`);
            },
            () => addLog(`[SUCCESS] Saved locally: D:\\AutoTag\\DeviceMetadata_DESKTOP-SIM01.json`),
            () => {
                if (networkShare && /^\\\\[a-zA-Z0-9-._]+\\[a-zA-Z0-9-._]+/.test(networkShare)) {
                    addLog(`[SUCCESS] Saved to network: ${networkShare}\\DeviceMetadata_DESKTOP-SIM01.json`);
                }
            },
            () => {
                addLog(`[SUCCESS] AutoTag process completed.`);
                addActivityLog('Simulation completed.', 'success');
                setTimeout(refreshLogPreview, 1000);
            }
        ];

        const interval = setInterval(() => {
            if (step < steps.length) {
                steps[step]();
                step++;
            } else {
                clearInterval(interval);
            }
        }, 800);
    };

    const refreshLogPreview = () => {
        setIsLogLoading(true);
        setTimeout(() => {
            const now = new Date();
            const share = networkShare || '\\\\SERVER\\Share';
            const newLogs = `
[${now.toLocaleString()}] [INFO] --- AutoTag Log Start ---
[${now.toLocaleString()}] [INFO] Script Version: 1.2.0
[${now.toLocaleString()}] [INFO] User: NT AUTHORITY\\SYSTEM
[${now.toLocaleString()}] [INFO] Validating Network Path: ${share}
[${now.toLocaleString()}] [SUCCESS] Path Reachable. Latency: 12ms
[${now.toLocaleString()}] [INFO] Detecting Hardware...
[${now.toLocaleString()}] [DATA] Model: Latitude 7420
[${now.toLocaleString()}] [DATA] Serial: 5J9X2K3
[${now.toLocaleString()}] [DATA] Asset Tag: 102938
[${now.toLocaleString()}] [INFO] Generating JSON Payload...
[${now.toLocaleString()}] [SUCCESS] Payload saved to ${share}\\DeviceMetadata_5J9X2K3.json
[${now.toLocaleString()}] [INFO] --- AutoTag Log End ---
`.trim();
            setLogPreview(newLogs);
            setIsLogLoading(false);
            addActivityLog('Refreshed AutoTag log preview.', 'info');
        }, 1000);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSnippet(true);
        setTimeout(() => setCopiedSnippet(false), 2000);
        addActivityLog('Copied PXE integration snippet to clipboard.', 'success');
    };

    const pxeSnippet = `
:: Add this to your startnet.cmd or Task Sequence
:: Ensure the user has read/write access to the share

net use Z: "${networkShare || '\\\\SERVER\\Share'}" /user:YourUsername YourPassword
if %errorlevel% neq 0 (
    echo [ERROR] Failed to map network drive.
    exit /b 1
)

powershell.exe -ExecutionPolicy Bypass -File "Z:\\AutoTag.ps1" -NetworkShare "${networkShare || '\\\\SERVER\\Share'}"
`.trim();

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-900 rounded-xl border border-gray-800">
                        <Usb className="text-[#39FF14] w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                            PXE Task Sequence Wizard
                        </h2>
                        <p className="text-gray-400 text-sm">
                            Configure, validate, and integrate AutoTag into your imaging workflow.
                        </p>
                    </div>
                </div>
                
                {/* Stepper */}
                <div className="mt-8 flex items-center justify-between relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-800 -z-10"></div>
                    {[1, 2, 3].map((step) => (
                        <div key={step} className={`flex flex-col items-center gap-2 bg-gray-950 px-4 z-10`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${
                                currentStep >= step 
                                    ? 'bg-[#39FF14] border-[#39FF14] text-black shadow-[0_0_10px_rgba(57,255,20,0.3)]' 
                                    : 'bg-gray-900 border-gray-700 text-gray-500'
                            }`}>
                                {currentStep > step ? <Check className="w-5 h-5" /> : step}
                            </div>
                            <span className={`text-xs font-medium ${currentStep >= step ? 'text-white' : 'text-gray-600'}`}>
                                {step === 1 ? 'Configuration' : step === 2 ? 'Integration' : 'Deployment'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column: Wizard Steps */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 shadow-lg min-h-[400px] flex flex-col">
                        
                        {/* Step 1: Configuration */}
                        {currentStep === 1 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-grow space-y-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Server className="w-5 h-5 text-cyan-400" />
                                    Network Configuration
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                            Network Share Path (UNC)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={networkShare}
                                                onChange={(e) => setNetworkShare(e.target.value)}
                                                placeholder="\\SERVER\Share\Metadata"
                                                className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-700 focus:ring-2 transition-all outline-none font-mono ${
                                                    networkValidation === 'invalid' ? 'border-red-500/50 focus:ring-red-500/20' : 
                                                    networkValidation === 'valid' ? 'border-green-500/50 focus:ring-green-500/20' : 
                                                    'border-gray-800 focus:ring-cyan-500/20 focus:border-cyan-500/50'
                                                }`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                {networkValidation === 'validating' && <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />}
                                                {networkValidation === 'valid' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                {networkValidation === 'invalid' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                            </div>
                                        </div>
                                        {networkValidation === 'invalid' && (
                                            <p className="text-xs text-red-400 mt-2">Invalid UNC path format.</p>
                                        )}
                                    </div>

                                    <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
                                        <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-bold text-blue-300">Required Permissions</h4>
                                            <p className="text-xs text-blue-200/70 leading-relaxed">
                                                The user account running the PXE Task Sequence must have 
                                                <span className="font-bold text-white mx-1">Read & Write</span> 
                                                access to this share. The script will attempt to create a test file to verify permissions before proceeding.
                                            </p>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={runSimulation}
                                        className="w-full py-3 bg-cyan-950/30 border border-cyan-500/30 text-cyan-400 rounded-xl font-bold text-sm hover:bg-cyan-900/50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Play className="w-4 h-4" />
                                        Validate Access (Simulation)
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Integration Method */}
                        {currentStep === 2 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-grow space-y-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Network className="w-5 h-5 text-purple-400" />
                                    Choose Integration Method
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setDeploymentMethod('usb')}
                                        className={`p-6 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${
                                            deploymentMethod === 'usb' 
                                                ? 'border-[#39FF14] bg-[#39FF14]/5' 
                                                : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                                        }`}
                                    >
                                        <div className="mb-4 p-3 bg-gray-800 rounded-lg w-fit group-hover:scale-110 transition-transform">
                                            <Usb className={`w-6 h-6 ${deploymentMethod === 'usb' ? 'text-[#39FF14]' : 'text-gray-400'}`} />
                                        </div>
                                        <h4 className="text-white font-bold mb-2">USB Drive (Manual)</h4>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            Save scripts to a USB drive and manually execute them on each device. Best for ad-hoc imaging or offline scenarios.
                                        </p>
                                        {deploymentMethod === 'usb' && (
                                            <div className="absolute top-4 right-4 text-[#39FF14]">
                                                <CheckCircle className="w-5 h-5" />
                                            </div>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setDeploymentMethod('pxe')}
                                        className={`p-6 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${
                                            deploymentMethod === 'pxe' 
                                                ? 'border-purple-500 bg-purple-500/5' 
                                                : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                                        }`}
                                    >
                                        <div className="mb-4 p-3 bg-gray-800 rounded-lg w-fit group-hover:scale-110 transition-transform">
                                            <Server className={`w-6 h-6 ${deploymentMethod === 'pxe' ? 'text-purple-400' : 'text-gray-400'}`} />
                                        </div>
                                        <h4 className="text-white font-bold mb-2">PXE Server (Automated)</h4>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            Integrate directly into WDS/MDT for zero-touch automation. Scripts run automatically during the boot process.
                                        </p>
                                        {deploymentMethod === 'pxe' && (
                                            <div className="absolute top-4 right-4 text-purple-400">
                                                <CheckCircle className="w-5 h-5" />
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 3: Deployment */}
                        {currentStep === 3 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-grow space-y-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <HardDrive className="w-5 h-5 text-emerald-400" />
                                    {deploymentMethod === 'usb' ? 'Download & Deploy' : 'Integration Code'}
                                </h3>

                                {deploymentMethod === 'usb' ? (
                                    <div className="space-y-6">
                                        <p className="text-sm text-gray-400">
                                            Download the package or save directly to your USB drive. Insert the drive into the target machine and run <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-200">AutoTag.bat</code>.
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={handleSaveToUsb}
                                                disabled={usbStatus === 'writing'}
                                                className={`p-6 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center gap-3 border ${
                                                    usbStatus === 'success' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30' :
                                                    usbStatus === 'error' ? 'bg-red-950/30 text-red-400 border-red-500/30' :
                                                    'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800'
                                                }`}
                                            >
                                                {usbStatus === 'writing' ? <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" /> :
                                                 usbStatus === 'success' ? <CheckCircle className="w-6 h-6" /> :
                                                 <Usb className="w-6 h-6" />}
                                                <span>Save to USB Drive</span>
                                            </button>

                                            <button
                                                onClick={handleDownloadPackage}
                                                disabled={downloadStatus === 'downloading'}
                                                className={`p-6 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center gap-3 border ${
                                                    downloadStatus === 'complete' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30' :
                                                    'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800'
                                                }`}
                                            >
                                                {downloadStatus === 'downloading' ? <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" /> :
                                                 downloadStatus === 'complete' ? <CheckCircle className="w-6 h-6" /> :
                                                 <Download className="w-6 h-6" />}
                                                <span>Download Package</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-400">
                                            Add the following code to your PXE Boot Image's <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-200">startnet.cmd</code> or create a "Run Command Line" step in your MDT Task Sequence.
                                        </p>
                                        <div className="relative bg-black rounded-xl border border-gray-800 p-4 group">
                                            <pre className="text-xs font-mono text-purple-300 whitespace-pre-wrap break-all">
                                                {pxeSnippet}
                                            </pre>
                                            <button 
                                                onClick={() => copyToClipboard(pxeSnippet)}
                                                className="absolute top-2 right-2 p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                                            >
                                                {copiedSnippet ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-4 flex gap-3">
                                            <Shield className="w-5 h-5 text-purple-400 flex-shrink-0" />
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-bold text-purple-300">Security Note</h4>
                                                <p className="text-xs text-purple-200/70">
                                                    Ensure the credentials used in the <code className="text-white">net use</code> command have minimal privileges (Write-only if possible) to the specific share.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="mt-auto pt-8 flex justify-between border-t border-gray-800">
                            <button
                                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                                disabled={currentStep === 1}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                                    currentStep === 1 
                                        ? 'text-gray-600 cursor-not-allowed' 
                                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                                }`}
                            >
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                            
                            {currentStep < 3 ? (
                                <button
                                    onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}
                                    disabled={currentStep === 1 && networkValidation !== 'valid'}
                                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                                        currentStep === 1 && networkValidation !== 'valid'
                                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                            : 'bg-[#39FF14] text-black hover:bg-[#32e612]'
                                    }`}
                                >
                                    Next <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => { setCurrentStep(1); setUsbStatus('idle'); setDownloadStatus('idle'); }}
                                    className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm bg-gray-800 text-white hover:bg-gray-700 transition-all"
                                >
                                    Start Over
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Logs & Preview */}
                <div className="xl:col-span-1 space-y-6">
                    {/* AutoTag Log Preview */}
                    <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <FileCode className="w-4 h-4" /> Log Preview
                            </h3>
                            <button 
                                onClick={refreshLogPreview}
                                disabled={isLogLoading}
                                className="text-xs flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                                <div className={`w-3 h-3 border-2 border-current border-t-transparent rounded-full ${isLogLoading ? 'animate-spin' : ''}`} />
                                {isLogLoading ? 'Refreshing...' : 'Refresh'}
                            </button>
                        </div>
                        <div className="bg-black rounded-xl border border-gray-800 p-4 font-mono text-xs text-gray-300 h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800">
                            <pre className="whitespace-pre-wrap">{logPreview}</pre>
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 shadow-lg">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Activity Log
                        </h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-2">
                            {activityLog.length === 0 ? (
                                <div className="text-gray-700 text-xs italic text-center py-4">No activity recorded</div>
                            ) : (
                                activityLog.map(log => (
                                    <div key={log.id} className="flex items-start gap-3 text-xs border-b border-gray-900 pb-2 last:border-0">
                                        <span className="text-gray-600 font-mono whitespace-nowrap">{log.timestamp}</span>
                                        <span className={`${
                                            log.type === 'error' ? 'text-red-400' : 
                                            log.type === 'success' ? 'text-emerald-400' : 
                                            'text-gray-300'
                                        }`}>
                                            {log.message}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Collapsible Script Preview */}
            <div className="bg-gray-950 rounded-2xl border border-gray-800 shadow-lg overflow-hidden">
                <button 
                    onClick={() => setShowScriptPreview(!showScriptPreview)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-900/50 transition-colors"
                >
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Terminal className="w-4 h-4" /> Script Source Code
                    </h3>
                    <span className="text-xs text-cyan-400 font-medium">
                        {showScriptPreview ? 'Hide Preview' : 'Show Preview'}
                    </span>
                </button>
                
                <AnimatePresence>
                    {showScriptPreview && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-gray-800"
                        >
                            <div className="p-6 pt-0">
                                <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800 mb-4 w-fit">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActivePreview('bat'); }}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                                            activePreview === 'bat' 
                                                ? 'bg-gray-800 text-white shadow-sm' 
                                                : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        AutoTag.bat
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActivePreview('ps1'); }}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                                            activePreview === 'ps1' 
                                                ? 'bg-gray-800 text-white shadow-sm' 
                                                : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        AutoTag.ps1
                                    </button>
                                </div>
                                <div className="bg-black/50 rounded-xl border border-gray-800 p-4 overflow-x-auto">
                                    <pre className="text-xs font-mono text-gray-400 whitespace-pre">
                                        {activePreview === 'bat' ? getAutoTagBatContent(networkShare) : getAutoTagPs1Content(networkShare)}
                                    </pre>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Simulation Modal */}
            {isSimulating && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Terminal className="w-5 h-5 text-[#39FF14]" />
                                AutoTag Simulation
                            </h3>
                            <button onClick={() => setIsSimulating(false)} className="text-gray-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 bg-black font-mono text-sm overflow-y-auto flex-grow space-y-2">
                            {simulationLogs.map((log, i) => (
                                <div key={i} className={`${
                                    log.includes('[ERROR]') ? 'text-red-400' : 
                                    log.includes('[WARN]') ? 'text-yellow-400' : 
                                    log.includes('[SUCCESS]') ? 'text-green-400' : 
                                    log.includes('[DATA]') ? 'text-cyan-400' : 
                                    'text-gray-300'
                                }`}>
                                    {log}
                                </div>
                            ))}
                            {simulationLogs.length === 0 && <div className="text-gray-600 animate-pulse">Initializing...</div>}
                        </div>
                        <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-end">
                            <button 
                                onClick={() => setIsSimulating(false)}
                                className="px-4 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
