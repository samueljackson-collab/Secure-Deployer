import React, { useState, useEffect } from 'react';
import { Download, Terminal, Usb, Server, AlertTriangle, CheckCircle, Activity } from 'lucide-react';

export const PxeTaskSequence: React.FC = () => {
    const [networkShare, setNetworkShare] = useState<string>('\\\\server\\share\\AutoTag');
    const [scriptContent, setScriptContent] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'bat' | 'ps1'>('bat');
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        generateScripts();
    }, [networkShare]);

    const generateScripts = () => {
        const ps1Script = `# AutoTag.ps1 - Device Metadata Capture for PXE
# Version: 2.0
# Description: Captures device metadata (Hostname, MAC, IP, Model, Asset Tag) and saves to JSON.
# Includes comprehensive logging and error handling.

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
        
        // Simulate logging the download action
        const newLog = `[${new Date().toLocaleTimeString()}] Downloaded ${activeTab === 'bat' ? 'AutoTag.bat' : 'AutoTag.ps1'}`;
        setLogs(prev => [newLog, ...prev]);
    };

    return (
        <div className="h-full flex flex-col bg-gray-900 text-gray-100 p-6 overflow-y-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                    <Terminal className="w-6 h-6 text-[#39FF14]" />
                    PXE Task Sequence: AutoTag
                </h2>
                <p className="text-gray-400">
                    Configure and download the AutoTag scripts for your PXE boot environment. 
                    These scripts automate the capture of device metadata during imaging.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-lg">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Server className="w-5 h-5 text-blue-400" />
                            Configuration
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    Network Share Path
                                </label>
                                <input 
                                    type="text" 
                                    value={networkShare}
                                    onChange={(e) => setNetworkShare(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="\\server\share\AutoTag"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Where the JSON metadata files will be saved.
                                </p>
                            </div>

                            <div className="bg-blue-900/20 border border-blue-800 rounded p-3">
                                <h4 className="text-sm font-bold text-blue-400 mb-1 flex items-center gap-1">
                                    <Usb className="w-4 h-4" />
                                    USB Preparation
                                </h4>
                                <ol className="list-decimal list-inside text-xs text-gray-300 space-y-1">
                                    <li>Format USB drive as FAT32.</li>
                                    <li>Create a folder named <code className="bg-gray-900 px-1 rounded">AutoTag</code>.</li>
                                    <li>Download both scripts below.</li>
                                    <li>Copy scripts to the folder.</li>
                                    <li>Insert USB into target device before PXE boot.</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-lg">
                         <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-green-400" />
                            Activity Log
                        </h3>
                        <div className="bg-black rounded border border-gray-700 p-2 h-40 overflow-y-auto font-mono text-xs">
                            {logs.length === 0 ? (
                                <span className="text-gray-600 italic">No activity recorded yet.</span>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className="text-gray-300 border-b border-gray-800 last:border-0 py-1">
                                        {log}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Script Preview Panel */}
                <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700 shadow-lg flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
                        <div className="flex space-x-2">
                            <button 
                                onClick={() => setActiveTab('bat')}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'bat' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                            >
                                AutoTag.bat
                            </button>
                            <button 
                                onClick={() => setActiveTab('ps1')}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'ps1' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                            >
                                AutoTag.ps1
                            </button>
                        </div>
                        <button 
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#39FF14] text-black text-sm font-bold rounded hover:bg-[#32e012] transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download File
                        </button>
                    </div>
                    
                    <div className="relative flex-grow bg-[#1e1e1e] overflow-hidden">
                        <div className="absolute inset-0 overflow-auto p-4">
                            <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap break-all">
                                {scriptContent}
                            </pre>
                        </div>
                    </div>
                    
                    <div className="px-4 py-2 bg-gray-900 border-t border-gray-700 text-xs text-gray-500 flex items-center gap-2">
                        {activeTab === 'ps1' && (
                            <>
                                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                <span>Ensure PowerShell Execution Policy allows scripts (e.g., RemoteSigned or Bypass).</span>
                            </>
                        )}
                        {activeTab === 'bat' && (
                            <>
                                <CheckCircle className="w-3 h-3 text-green-500" />
                                <span>Batch file automatically attempts to bypass execution policy.</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
