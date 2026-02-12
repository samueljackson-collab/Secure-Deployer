import React, { useState } from 'react';

const powershellScript = `
#Requires -Version 5.1
<#
.SYNOPSIS
    Device Metadata Gatherer for Image Monitor
.DESCRIPTION
    This script is designed to be run in a WinPE / Task Sequence environment BEFORE OS installation.
    It gathers essential hardware and technician-provided information, then saves it as a JSON file
    to a centralized network share. The Secure Deployment Runner's "Image Monitor" tab polls this
    share to display live imaging status.
.NOTES
    Author: Secure Deployment Runner
    Version: 1.2

    SECURE CREDENTIAL MANAGEMENT FOR NON-INTERACTIVE SCENARIOS:
    This script uses interactive prompts (Read-Host) and does not handle network share authentication.
    In an automated Task Sequence, you will need to handle credentials securely.

    DO NOT hardcode passwords in scripts.

    Recommended Secure Options:
    1.  SERVICE ACCOUNTS: Create a dedicated service account with the absolute minimum required permissions
        (e.g., Write-only access to the specific network share). Use this account to run the Task Sequence step.
        Access can be managed via Group Policy or other infrastructure tools.

    2.  SECURE VAULTS: For higher security environments, integrate with a secrets management solution
        like HashiCorp Vault, Azure Key Vault, or CyberArk. The Task Sequence can be configured to
        retrieve temporary credentials from the vault at runtime. This is the most secure method as
        credentials are centrally managed, audited, and rotated automatically.

    3.  LAPS (Local Administrator Password Solution): While not for network shares, if local admin access
        is needed, LAPS is the standard for managing local passwords securely. This is not directly
        applicable for writing to a network share but is a key part of a secure endpoint management strategy.
#>

# --- CONFIGURATION ---
# IMPORTANT: Change this path to your network share where imaging data is stored.
$NetworkSharePath = "\\\\SERVER\\SHARE\\imaging_data"

# --- FUNCTIONS ---

function Show-Menu {
    Clear-Host
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host "   Device Metadata Gatherer for Image Monitor  " -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host
    Write-Host "This tool will collect device info and register it for live imaging monitoring."
    Write-Host
}

function Get-HardwareInfo {
    Write-Host "[*] Gathering hardware information..." -ForegroundColor Cyan
    try {
        $nic = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -and $_.MACAddress } | Select-Object -First 1
        $computerSystem = Get-CimInstance -ClassName Win32_ComputerSystem
        $bios = Get-CimInstance -ClassName Win32_BIOS
        $enclosure = Get-CimInstance -ClassName Win32_SystemEnclosure

        if (-not $nic) {
            Write-Warning "Could not find an active, IP-enabled network adapter."
            return $null
        }

        return @{
            MacAddress    = ($nic.MACAddress -replace ":").ToUpper()
            IpAddress     = $nic.IPAddress[0]
            Model         = $computerSystem.Model
            SerialNumber  = $bios.SerialNumber
            AssetTag      = $enclosure.SMBIOSAssetTag
        }
    }
    catch {
        Write-Error "An error occurred while gathering hardware info: $_"
        return $null
    }
}

# --- MAIN LOGIC ---

Show-Menu

# 1. Gather Manual Input
$RackSlot = Read-Host -Prompt "Enter Rack Slot (e.g., 1-8)"
$Hostname = Read-Host -Prompt "Enter Device Hostname"
$TechName = Read-Host -Prompt "Enter Your Name/ID"

# 2. Gather Automated Info
$hwInfo = Get-HardwareInfo
if (-not $hwInfo) {
    Read-Host "Failed to gather hardware data. Press Enter to exit."
    Exit 1
}

# 3. Combine Data
$deviceData = @{
    id            = $hwInfo.MacAddress
    hostname      = $Hostname
    macAddress    = $hwInfo.MacAddress
    ipAddress     = $hwInfo.IpAddress
    model         = $hwInfo.Model
    serialNumber  = $hwInfo.SerialNumber
    assetTag      = $hwInfo.AssetTag
    slot          = $RackSlot
    tech          = $TechName
    startTime     = [int64](([datetime]::UtcNow) - ([datetime]'1970-01-01')).TotalMilliseconds
    status        = "Imaging"
    progress      = 0
    duration      = 180 # Default duration, can be updated by task sequence
}

# 4. Display Receipt for Confirmation
Clear-Host
Write-Host "--- Device Receipt ---" -ForegroundColor Green
$deviceData.GetEnumerator() | ForEach-Object {
    Write-Host ("{0,-15}: {1}" -f $_.Name, $_.Value) -ForegroundColor White
}
Write-Host "----------------------" -ForegroundColor Green
Write-Host

$confirmation = Read-Host "Is the information correct? (Y/N)"

if ($confirmation -ne 'Y') {
    Write-Host "Submission cancelled by user." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    Exit 0
}

# 5. Submit to Network Share
try {
    if (-not (Test-Path -Path $NetworkSharePath)) {
        Write-Warning "Network share '$NetworkSharePath' not found. Creating directory..."
        New-Item -Path $NetworkSharePath -ItemType Directory -Force | Out-Null
    }
    
    $filePath = Join-Path -Path $NetworkSharePath -ChildPath "$($hwInfo.MacAddress).json"
    $deviceData | ConvertTo-Json | Out-File -FilePath $filePath -Encoding UTF8
    
    Write-Host "[SUCCESS] Device receipt submitted successfully to monitor." -ForegroundColor Green
    Write-Host "You can now start the imaging process."
}
catch {
    Write-Error "Failed to submit device receipt: $_"
    Read-Host "Press Enter to exit."
    Exit 1
}

Start-Sleep -Seconds 3
`;

export const ImagingScriptViewer: React.FC = () => {
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(powershellScript.trim()).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    return (
        <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 max-w-4xl mx-auto">
             <div className="flex flex-col sm:flex-row items-start gap-6">
                 <div className="flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#39FF14]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                </div>
                 <div className="flex-grow">
                    <h2 className="text-2xl font-bold text-[#39FF14]">Imaging Metadata Gatherer Script</h2>
                    <p className="text-gray-400 mt-2 font-bold">
                        Run this PowerShell script on a device in the WinPE/Task Sequence environment to register it with the Image Monitor.
                    </p>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-800 space-y-4">
                 <div>
                    <h3 className="text-lg font-semibold text-gray-100">Instructions:</h3>
                    <ol className="list-decimal list-inside mt-2 space-y-2 text-sm text-gray-300">
                        <li>Save the script below as <code className="bg-gray-800 px-1 rounded font-mono">MetaGather.ps1</code>.</li>
                        <li>
                            Modify the <code className="bg-gray-800 px-1 rounded font-mono">$NetworkSharePath</code> variable in the script to point to a network share accessible by both WinPE and the machine running this web app.
                        </li>
                        <li>Integrate the script as a step in your imaging Task Sequence before the 'Apply Operating System' step.</li>
                        <li>When the script runs, it will prompt the technician for the necessary information.</li>
                        <li>Once submitted, the device will appear in the "Image Monitor" tab.</li>
                    </ol>
                </div>

                <div className="relative">
                     <button
                        onClick={handleCopy}
                        className="absolute top-2 right-2 px-3 py-1 bg-gray-700 text-white text-xs font-semibold rounded-lg hover:bg-gray-600 transition duration-200"
                    >
                        {copySuccess ? 'Copied!' : 'Copy Script'}
                    </button>
                    <pre className="bg-black/50 p-4 rounded-lg border border-gray-800 text-sm text-gray-300 overflow-x-auto max-h-[500px]">
                        <code className="language-powershell whitespace-pre-wrap font-mono">
                            {powershellScript.trim()}
                        </code>
                    </pre>
                </div>
            </div>
        </div>
    );
};