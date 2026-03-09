import React, { useState, useEffect, useRef } from 'react';
import { Download, Terminal, Usb, Server, AlertTriangle, CheckCircle, Activity, ChevronRight, ChevronLeft, Play, Copy, RefreshCw, HardDrive, ShieldCheck, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const PxeTaskSequence: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [networkShare, setNetworkShare] = useState<string>('\\\\server\\share\\AutoTag');
    const [scriptContent, setScriptContent] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'bat' | 'ps1'>('bat');
    const [integrationMethod, setIntegrationMethod] = useState<'usb' | 'pxe'>('pxe');
    
    // Boot Image Management States
    const [targetDeviceMac, setTargetDeviceMac] = useState('');
    const [sccmStatus, setSccmStatus] = useState<'idle' | 'checking' | 'found' | 'not_found'>('idle');
    const [availableImages, setAvailableImages] = useState<{id: string, name: string, version: string}[]>([]);
    const [selectedImage, setSelectedImage] = useState<string>('');
    
    // Validation States
    const [isValidating, setIsValidating] = useState(false);
    const [validationResults, setValidationResults] = useState<{
        path: boolean | null;
        permissions: boolean | null;
        diskSpace: boolean | null;
        writeSpeed: number | null;
    }>({
        path: null,
        permissions: null,
        diskSpace: null,
        writeSpeed: null
    });

    // Remote Execution States
    const [showRemoteModal, setShowRemoteModal] = useState(false);
    const [remoteIp, setRemoteIp] = useState('');
    const [remoteStatus, setRemoteStatus] = useState<'idle' | 'connecting' | 'running' | 'completed' | 'failed'>('idle');
    const [remoteLogs, setRemoteLogs] = useState<string[]>([]);
    const [remoteProgress, setRemoteProgress] = useState(0);
    const remoteLogEndRef = useRef<HTMLDivElement>(null);

    // AutoTag Log Preview States
    const [autoTagLogs, setAutoTagLogs] = useState<string[]>([]);
    const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

    useEffect(() => {
        generateScripts();
    }, [networkShare]);

    useEffect(() => {
        if (remoteLogEndRef.current) {
            remoteLogEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [remoteLogs]);

    const generateScripts = () => {
        const ps1Script = `# AutoTag.ps1 - Device Metadata Capture for PXE
# Version: 2.1
# Description: Captures device metadata (Hostname, MAC, IP, Model, Asset Tag) and saves to JSON.
# Includes comprehensive logging, error handling, and network share validation.

param (
    [string]$NetworkSharePath = "${networkShare}"
)

$ErrorActionPreference = "Stop"
$LogFile = Join-Path -Path $PSScriptRoot -ChildPath "AutoTag.log"

function Write-Log {
    param (
        [string]$Message,
        [string]$Level = "INFO"
    )
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogLine = "[$Timestamp] [$Level] $Message"
    Write-Host $LogLine -ForegroundColor ($Level -eq "ERROR" ? "Red" : ($Level -eq "WARNING" ? "Yellow" : "White"))
    try {
        Add-Content -Path $LogFile -Value $LogLine -Force
    } catch {
        Write-Warning "Failed to write to log file: $_"
    }
}

function Test-Admin {
    $currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Log "==============================================="
Write-Log "           AutoTag Device Capture              "
Write-Log "==============================================="

# 1. Admin Check
if (-not (Test-Admin)) {
    Write-Log "Script is not running with Administrative privileges. Please run as Administrator." "ERROR"
    exit 1
}

# 2. Validate Network Share
if (-not [string]::IsNullOrWhiteSpace($NetworkSharePath)) {
    Write-Log "Checking network share access: $NetworkSharePath"
    if (Test-Path -Path $NetworkSharePath) {
        Write-Log "Network share is accessible." "SUCCESS"
        
        # Check Write Permissions
        try {
            $testFile = Join-Path -Path $NetworkSharePath -ChildPath "write_test.tmp"
            "test" | Out-File -FilePath $testFile -Force
            Remove-Item -Path $testFile -Force
            Write-Log "Write permissions confirmed." "SUCCESS"
        } catch {
            Write-Log "Write permissions denied on network share." "ERROR"
            exit 1
        }
    } else {
        Write-Log "Network share not accessible or does not exist. Metadata will only be saved locally." "WARNING"
        $NetworkSharePath = $null
    }
}

# 3. Gather Hardware Info
Write-Log "Gathering hardware information..."
try {
    $nic = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -and $_.MACAddress } | Select-Object -First 1
    $computerSystem = Get-CimInstance -ClassName Win32_ComputerSystem
    $bios = Get-CimInstance -ClassName Win32_BIOS
    $enclosure = Get-CimInstance -ClassName Win32_SystemEnclosure

    if (-not $nic) {
        throw "Could not find an active, IP-enabled network adapter."
    }

    $info = @{
        Hostname      = $env:COMPUTERNAME
        MacAddress    = ($nic.MACAddress -replace ":").ToUpper()
        IpAddress     = $nic.IPAddress[0]
        Model         = $computerSystem.Model
        SerialNumber  = $bios.SerialNumber
        AssetTag      = $enclosure.SMBIOSAssetTag
        Timestamp     = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
    }
    
    Write-Log "Hardware info gathered successfully."
    $info.GetEnumerator() | ForEach-Object { Write-Log "$($_.Name): $($_.Value)" }

} catch {
    Write-Log "Failed to gather hardware info: $_" "ERROR"
    exit 1
}

# 4. Save Metadata
$fileName = "DeviceMetadata_$($info.Hostname).json"
$jsonContent = $info | ConvertTo-Json -Depth 2

# Save Locally (USB)
try {
    $localPath = Join-Path -Path $PSScriptRoot -ChildPath $fileName
    $jsonContent | Out-File -FilePath $localPath -Encoding UTF8
    Write-Log "Metadata saved locally to: $localPath" "SUCCESS"
} catch {
    Write-Log "Failed to save local file: $_" "ERROR"
}

# Save to Network
if ($NetworkSharePath) {
    try {
        $networkPath = Join-Path -Path $NetworkSharePath -ChildPath $fileName
        $jsonContent | Out-File -FilePath $networkPath -Encoding UTF8
        Write-Log "Metadata saved to network share: $networkPath" "SUCCESS"
    } catch {
        Write-Log "Failed to save to network share: $_" "ERROR"
    }
}

Write-Log "AutoTag sequence completed successfully."
Start-Sleep -Seconds 3
`;

        const batScript = `@echo off
:: AutoTag.bat - Launcher for AutoTag.ps1
:: Ensures execution policy bypass and admin rights check

echo [INFO] Starting AutoTag Sequence...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AutoTag.ps1" -NetworkSharePath "${networkShare}"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AutoTag script failed with exit code %ERRORLEVEL%.
    echo [INFO] Check AutoTag.log for details.
    pause
    exit /b %ERRORLEVEL%
)

echo [SUCCESS] AutoTag completed.
timeout /t 5
`;

        setScriptContent(activeTab === 'bat' ? batScript : ps1Script);
    };

    // Re-generate when tab changes to show correct content
    useEffect(() => {
        generateScripts();
    }, [activeTab]);

    const handleDownload = () => {
        const element = document.createElement("a");
        const file = new Blob([scriptContent], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = activeTab === 'bat' ? "AutoTag.bat" : "AutoTag.ps1";
        document.body.appendChild(element);
        element.click();
    };

    const handleCopySnippet = () => {
        const snippet = `net use Z: "${networkShare}" /user:domain\\user password\nZ:\\AutoTag.bat`;
        navigator.clipboard.writeText(snippet);
    };

    const checkSccmForDevice = () => {
        if (!targetDeviceMac) return;
        setSccmStatus('checking');
        setAvailableImages([]);
        setSelectedImage('');
        
        // Simulate SCCM API call
        setTimeout(() => {
            if (Math.random() > 0.2) {
                setSccmStatus('found');
                setAvailableImages([
                    { id: 'img1', name: 'Windows 10 Enterprise 22H2', version: '10.0.19045.3086' },
                    { id: 'img2', name: 'Windows 11 Enterprise 22H2', version: '10.0.22621.1848' },
                    { id: 'img3', name: 'Windows 10 LTSC 2021', version: '10.0.19044.1288' }
                ]);
            } else {
                setSccmStatus('not_found');
            }
        }, 1500);
    };

    const validateNetworkPath = () => {
        setIsValidating(true);
        setValidationResults({ path: null, permissions: null, diskSpace: null, writeSpeed: null });

        // Simulate validation steps
        setTimeout(() => {
            const isPathValid = /^\\\\[a-zA-Z0-9-._]+\\[a-zA-Z0-9-._\\]+$/.test(networkShare);
            setValidationResults(prev => ({ ...prev, path: isPathValid }));

            if (isPathValid) {
                setTimeout(() => {
                    setValidationResults(prev => ({ ...prev, permissions: true }));
                    setTimeout(() => {
                        setValidationResults(prev => ({ ...prev, diskSpace: true }));
                        setTimeout(() => {
                            setValidationResults(prev => ({ ...prev, writeSpeed: Math.floor(Math.random() * 50) + 50 })); // Random speed 50-100 MB/s
                            setIsValidating(false);
                        }, 800);
                    }, 800);
                }, 800);
            } else {
                setIsValidating(false);
            }
        }, 1000);
    };

    const startRemoteExecution = () => {
        if (!remoteIp) return;
        setRemoteStatus('connecting');
        setRemoteLogs([]);
        setRemoteProgress(0);

        const isSuccess = Math.random() > 0.4;
        let steps: { msg: string; delay: number; isError?: boolean }[] = [];

        if (isSuccess) {
            steps = [
                { msg: `Connecting to ${remoteIp}...`, delay: 1000 },
                { msg: "Connection established. Verifying credentials...", delay: 1500 },
                { msg: "Authenticated successfully.", delay: 500 },
                { msg: "Copying AutoTag scripts to C:\\Temp\\AutoTag...", delay: 2000 },
                { msg: "Starting AutoTag.bat execution...", delay: 1000 },
                { msg: "[INFO] Starting AutoTag Sequence...", delay: 500 },
                { msg: "[INFO] Checking network share access...", delay: 800 },
                { msg: "[SUCCESS] Network share is accessible.", delay: 500 },
                { msg: "[INFO] Gathering hardware information...", delay: 1200 },
                { msg: "[INFO] Hardware info gathered successfully.", delay: 500 },
                { msg: "[SUCCESS] Metadata saved to network share.", delay: 800 },
                { msg: "[SUCCESS] AutoTag sequence completed successfully.", delay: 500 },
                { msg: "Remote execution finished.", delay: 500 }
            ];
        } else {
            const errors = [
                {
                    err: "Access is denied. (Exception from HRESULT: 0x80070005 (E_ACCESSDENIED))",
                    ts: "Verify that the provided credentials have administrative privileges on the target device. Check if WinRM is configured to allow remote connections."
                },
                {
                    err: "The term 'Get-WindowsUpdate' is not recognized as the name of a cmdlet, function, script file, or operable program.",
                    ts: "Ensure the required PowerShell module (e.g., PSWindowsUpdate) is installed on the target device before running this script."
                },
                {
                    err: "Connecting to remote server failed with the following error message : The WinRM client cannot process the request.",
                    ts: "Check if the target device is online, on the same network, and has the WinRM service running. Verify firewall rules allow port 5985/5986."
                },
                {
                    err: "Cannot find path '\\\\server\\share\\AutoTag' because it does not exist.",
                    ts: "Verify that the network share path is correct and accessible from the target device. Check DNS resolution and network connectivity."
                }
            ];
            const randomError = errors[Math.floor(Math.random() * errors.length)];
            
            steps = [
                { msg: `Connecting to ${remoteIp}...`, delay: 1000 },
                { msg: "Connection established. Verifying credentials...", delay: 1500 },
                { msg: "Authenticated successfully.", delay: 500 },
                { msg: "Copying AutoTag scripts to C:\\Temp\\AutoTag...", delay: 2000 },
                { msg: "Starting AutoTag.bat execution...", delay: 1000 },
                { msg: "[INFO] Starting AutoTag Sequence...", delay: 500 },
                { msg: "[ERROR] Execution failed.", delay: 800, isError: true },
                { msg: `[POWERSHELL ERROR] ${randomError.err}`, delay: 500, isError: true },
                { msg: `[TROUBLESHOOTING] ${randomError.ts}`, delay: 500, isError: true },
                { msg: "Remote execution aborted.", delay: 500, isError: true }
            ];
        }

        let currentStep = 0;

        const executeStep = () => {
            if (currentStep >= steps.length) {
                setRemoteStatus(isSuccess ? 'completed' : 'failed');
                setRemoteProgress(100);
                return;
            }

            const step = steps[currentStep];
            setRemoteLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step.msg}`]);
            setRemoteProgress(Math.round(((currentStep + 1) / steps.length) * 100));
            
            if (currentStep === 4) setRemoteStatus('running');

            currentStep++;
            setTimeout(executeStep, step.delay);
        };

        executeStep();
    };

    const refreshAutoTagLogs = () => {
        setIsRefreshingLogs(true);
        // Simulate fetching logs
        setTimeout(() => {
            const newLogs = [
                `[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}] [INFO] AutoTag started on HOST-001`,
                `[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}] [SUCCESS] Network share accessible`,
                `[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}] [INFO] Hardware info gathered: Dell Latitude 5420`,
                `[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}] [SUCCESS] Metadata saved to ${networkShare}\\DeviceMetadata_HOST-001.json`,
                `[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}] [INFO] AutoTag completed`
            ];
            setAutoTagLogs(newLogs);
            setIsRefreshingLogs(false);
        }, 1000);
    };

    return (
        <div className="h-full flex flex-col bg-gray-900 text-gray-100 p-6 overflow-y-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                    <Terminal className="w-6 h-6 text-[#39FF14]" />
                    PXE Task Sequence Wizard
                </h2>
                <p className="text-gray-400">
                    Configure, validate, and deploy the AutoTag sequence for your imaging environment.
                </p>
            </div>

            {/* Wizard Steps */}
            <div className="mb-8">
                <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-800 -z-10"></div>
                    {[1, 2, 3, 4].map((step) => (
                        <div key={step} className={`flex flex-col items-center gap-2 bg-gray-900 px-4 ${currentStep >= step ? 'text-[#39FF14]' : 'text-gray-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 transition-colors ${currentStep >= step ? 'border-[#39FF14] bg-[#39FF14]/10' : 'border-gray-600 bg-gray-800'}`}>
                                {step}
                            </div>
                            <span className="text-xs font-medium uppercase">
                                {step === 1 ? 'Configuration' : step === 2 ? 'Boot Image' : step === 3 ? 'Integration' : 'Deployment'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Wizard Content */}
                <div className="lg:col-span-2 space-y-6">
                    <AnimatePresence mode="wait">
                        {currentStep === 1 && (
                            <motion.div 
                                key="step1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg"
                            >
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Server className="w-5 h-5 text-blue-400" />
                                    Network Configuration
                                </h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">
                                            Network Share Path
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={networkShare}
                                                onChange={(e) => setNetworkShare(e.target.value)}
                                                className="flex-grow bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                placeholder="\\server\share\AutoTag"
                                            />
                                            <button 
                                                onClick={validateNetworkPath}
                                                disabled={isValidating}
                                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {isValidating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                                Validate Access
                                            </button>
                                        </div>
                                    </div>

                                    {/* Validation Results */}
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div className="bg-gray-900 p-3 rounded border border-gray-700 flex items-center justify-between">
                                            <span className="text-sm text-gray-400 flex items-center gap-2"><Server size={16}/> Path Format</span>
                                            {validationResults.path === null ? <span className="text-gray-600">-</span> : 
                                             validationResults.path ? <CheckCircle className="text-green-500 w-4 h-4" /> : <AlertTriangle className="text-red-500 w-4 h-4" />}
                                        </div>
                                        <div className="bg-gray-900 p-3 rounded border border-gray-700 flex items-center justify-between">
                                            <span className="text-sm text-gray-400 flex items-center gap-2"><ShieldCheck size={16}/> Permissions</span>
                                            {validationResults.permissions === null ? <span className="text-gray-600">-</span> : 
                                             validationResults.permissions ? <CheckCircle className="text-green-500 w-4 h-4" /> : <AlertTriangle className="text-red-500 w-4 h-4" />}
                                        </div>
                                        <div className="bg-gray-900 p-3 rounded border border-gray-700 flex items-center justify-between">
                                            <span className="text-sm text-gray-400 flex items-center gap-2"><HardDrive size={16}/> Disk Space</span>
                                            {validationResults.diskSpace === null ? <span className="text-gray-600">-</span> : 
                                             validationResults.diskSpace ? <span className="text-green-500 text-xs font-mono">OK ({'>'}50GB)</span> : <span className="text-red-500 text-xs">Low</span>}
                                        </div>
                                        <div className="bg-gray-900 p-3 rounded border border-gray-700 flex items-center justify-between">
                                            <span className="text-sm text-gray-400 flex items-center gap-2"><Gauge size={16}/> Write Speed</span>
                                            {validationResults.writeSpeed === null ? <span className="text-gray-600">-</span> : 
                                             <span className="text-[#39FF14] text-xs font-mono">{validationResults.writeSpeed} MB/s</span>}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 2 && (
                            <motion.div 
                                key="step2"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg"
                            >
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <HardDrive className="w-5 h-5 text-yellow-400" />
                                    Boot Image Management
                                </h3>
                                <p className="text-sm text-gray-400 mb-6">
                                    Select the primary boot image (WIM file) to be used for PXE deployments. 
                                    The device must be added to SCCM to retrieve available images.
                                </p>
                                
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">
                                            Target Device MAC Address
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={targetDeviceMac}
                                                onChange={(e) => setTargetDeviceMac(e.target.value)}
                                                className="flex-grow bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                                                placeholder="e.g., 00:1A:2B:3C:4D:5E"
                                            />
                                            <button 
                                                onClick={checkSccmForDevice}
                                                disabled={sccmStatus === 'checking' || !targetDeviceMac}
                                                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-500 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {sccmStatus === 'checking' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                                                Check SCCM
                                            </button>
                                        </div>
                                    </div>

                                    {sccmStatus === 'not_found' && (
                                        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded flex items-start gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                                            <div>
                                                <h4 className="text-red-400 font-medium text-sm">Device Not Found in SCCM</h4>
                                                <p className="text-gray-400 text-xs mt-1">
                                                    The device with MAC address {targetDeviceMac} could not be found in SCCM. 
                                                    Please ensure the device is imported into SCCM before selecting a boot image.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {sccmStatus === 'found' && (
                                        <div className="space-y-3">
                                            <label className="block text-sm font-medium text-gray-400">
                                                Available Boot Images
                                            </label>
                                            <div className="grid grid-cols-1 gap-3">
                                                {availableImages.map(img => (
                                                    <div 
                                                        key={img.id}
                                                        onClick={() => setSelectedImage(img.id)}
                                                        className={`p-3 rounded border cursor-pointer transition-colors flex items-center justify-between ${selectedImage === img.id ? 'bg-yellow-500/10 border-yellow-500' : 'bg-gray-900 border-gray-700 hover:border-gray-500'}`}
                                                    >
                                                        <div>
                                                            <div className="font-medium text-white">{img.name}</div>
                                                            <div className="text-xs text-gray-400">Version: {img.version}</div>
                                                        </div>
                                                        {selectedImage === img.id && <CheckCircle className="w-5 h-5 text-yellow-500" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 3 && (
                            <motion.div 
                                key="step2"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg"
                            >
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Usb className="w-5 h-5 text-purple-400" />
                                    Integration Method
                                </h3>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setIntegrationMethod('usb')}
                                        className={`p-4 rounded-lg border-2 flex flex-col items-center gap-3 transition-all ${integrationMethod === 'usb' ? 'border-[#39FF14] bg-[#39FF14]/10' : 'border-gray-700 bg-gray-900 hover:border-gray-600'}`}
                                    >
                                        <Usb className={`w-8 h-8 ${integrationMethod === 'usb' ? 'text-[#39FF14]' : 'text-gray-500'}`} />
                                        <span className="font-bold">USB Drive (Manual)</span>
                                        <p className="text-xs text-center text-gray-400">Copy scripts to a USB drive and run manually on target devices.</p>
                                    </button>
                                    
                                    <button 
                                        onClick={() => setIntegrationMethod('pxe')}
                                        className={`p-4 rounded-lg border-2 flex flex-col items-center gap-3 transition-all ${integrationMethod === 'pxe' ? 'border-[#39FF14] bg-[#39FF14]/10' : 'border-gray-700 bg-gray-900 hover:border-gray-600'}`}
                                    >
                                        <Server className={`w-8 h-8 ${integrationMethod === 'pxe' ? 'text-[#39FF14]' : 'text-gray-500'}`} />
                                        <span className="font-bold">PXE Server (Automated)</span>
                                        <p className="text-xs text-center text-gray-400">Integrate directly into your WDS/MDT or SCCM Task Sequence.</p>
                                    </button>
                                </div>

                                <div className="mt-6 bg-gray-900 p-4 rounded border border-gray-700">
                                    {integrationMethod === 'usb' ? (
                                        <ol className="list-decimal list-inside text-sm text-gray-300 space-y-2">
                                            <li>Format USB drive as FAT32.</li>
                                            <li>Create a folder named <code className="bg-gray-800 px-1 rounded text-[#39FF14]">AutoTag</code>.</li>
                                            <li>Download both scripts in the next step.</li>
                                            <li>Copy scripts to the folder.</li>
                                            <li>Insert USB into target device before PXE boot.</li>
                                        </ol>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-sm text-gray-300">Add a &quot;Run Command Line&quot; step to your Task Sequence:</p>
                                            <div className="bg-black p-3 rounded border border-gray-800 font-mono text-xs text-green-400 overflow-x-auto">
                                                cmd.exe /c net use Z: &quot;{networkShare}&quot; /user:domain\user password && Z:\AutoTag.bat
                                            </div>
                                            <p className="text-xs text-yellow-500 flex items-center gap-1 mt-2">
                                                <AlertTriangle size={12} />
                                                Ensure the user account has Write permissions to the share.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 4 && (
                            <motion.div 
                                key="step3"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg"
                            >
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Download className="w-5 h-5 text-green-400" />
                                    Deployment Assets
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => { setActiveTab('bat'); handleDownload(); }}
                                            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Download size={18} /> Download AutoTag.bat
                                        </button>
                                        <button 
                                            onClick={() => { setActiveTab('ps1'); handleDownload(); }}
                                            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Download size={18} /> Download AutoTag.ps1
                                        </button>
                                    </div>

                                    {integrationMethod === 'pxe' && (
                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-gray-400 mb-2">Integration Code Snippet</label>
                                            <div className="flex gap-2">
                                                <code className="flex-grow bg-black p-3 rounded border border-gray-700 font-mono text-xs text-gray-300 overflow-x-auto">
                                                    net use Z: &quot;{networkShare}&quot; /user:domain\user password && Z:\AutoTag.bat
                                                </code>
                                                <button 
                                                    onClick={handleCopySnippet}
                                                    className="px-3 bg-gray-700 hover:bg-gray-600 rounded border border-gray-600"
                                                    title="Copy to Clipboard"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-6 pt-6 border-t border-gray-700">
                                        <h4 className="text-sm font-bold text-white mb-3">Test Deployment</h4>
                                        <button 
                                            onClick={() => setShowRemoteModal(true)}
                                            className="w-full py-3 bg-[#39FF14] text-black font-bold rounded hover:bg-[#32e012] transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Play size={18} /> Test Remote Execution
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-6">
                        <button 
                            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                            disabled={currentStep === 1}
                            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <ChevronLeft size={16} /> Back
                        </button>
                        <button 
                            onClick={() => setCurrentStep(prev => Math.min(4, prev + 1))}
                            disabled={currentStep === 4}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Script Preview Panel (Always Visible) */}
                <div className="lg:col-span-1 bg-gray-800 rounded-lg border border-gray-700 shadow-lg flex flex-col overflow-hidden h-[500px]">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
                        <span className="text-sm font-bold text-gray-300">Script Preview</span>
                        <div className="flex space-x-1">
                            <button 
                                onClick={() => setActiveTab('bat')}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeTab === 'bat' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                            >
                                .bat
                            </button>
                            <button 
                                onClick={() => setActiveTab('ps1')}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeTab === 'ps1' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                            >
                                .ps1
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative flex-grow bg-[#1e1e1e] overflow-hidden">
                        <div className="absolute inset-0 overflow-auto p-4">
                            <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap break-all">
                                {scriptContent}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>

            {/* AutoTag Log Preview Section */}
            <div className="mt-8 bg-gray-800 rounded-lg border border-gray-700 shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-[#39FF14]" />
                        AutoTag Log Preview
                    </h3>
                    <button 
                        onClick={refreshAutoTagLogs}
                        disabled={isRefreshingLogs}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white flex items-center gap-2"
                    >
                        <RefreshCw size={14} className={isRefreshingLogs ? "animate-spin" : ""} />
                        Refresh Logs
                    </button>
                </div>
                <div className="bg-black rounded border border-gray-700 p-4 h-48 overflow-y-auto font-mono text-xs text-gray-300">
                    {autoTagLogs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500 italic">
                            No logs available. Click refresh to load latest logs.
                        </div>
                    ) : (
                        autoTagLogs.map((log, i) => (
                            <div key={i} className="py-0.5 border-b border-gray-800 last:border-0">
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Remote Execution Modal */}
            {showRemoteModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden"
                    >
                        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Terminal className="text-[#39FF14]" /> Remote Execution Monitor
                            </h3>
                            <button onClick={() => setShowRemoteModal(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="flex gap-4">
                                <input 
                                    type="text" 
                                    placeholder="Target IP Address (e.g., 192.168.1.50)"
                                    value={remoteIp}
                                    onChange={(e) => setRemoteIp(e.target.value)}
                                    className="flex-grow bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:ring-2 focus:ring-[#39FF14] focus:outline-none"
                                />
                                <button 
                                    onClick={startRemoteExecution}
                                    disabled={remoteStatus === 'running' || !remoteIp}
                                    className="px-6 py-2 bg-[#39FF14] text-black font-bold rounded hover:bg-[#32e012] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {remoteStatus === 'running' ? 'Running...' : 'Connect & Run'}
                                </button>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>Execution Progress</span>
                                    <span>{remoteProgress}%</span>
                                </div>
                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-[#39FF14]"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${remoteProgress}%` }}
                                    />
                                </div>
                            </div>

                            {/* Terminal Output */}
                            <div className="bg-black rounded border border-gray-800 p-4 h-64 overflow-y-auto font-mono text-sm">
                                {remoteLogs.length === 0 ? (
                                    <span className="text-gray-600 italic">Waiting for connection...</span>
                                ) : (
                                    remoteLogs.map((log, i) => {
                                        let textColor = "text-gray-300";
                                        if (log.includes("[ERROR]") || log.includes("[POWERSHELL ERROR]")) {
                                            textColor = "text-red-400 font-bold";
                                        } else if (log.includes("[TROUBLESHOOTING]")) {
                                            textColor = "text-yellow-400";
                                        } else if (log.includes("[SUCCESS]")) {
                                            textColor = "text-emerald-400 font-bold";
                                        }
                                        return (
                                            <div key={i} className={`${textColor} py-0.5`}>
                                                {log}
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={remoteLogEndRef} />
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};
