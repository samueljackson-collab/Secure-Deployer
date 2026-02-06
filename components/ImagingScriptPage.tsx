import React, { useState } from 'react';

const scriptContent = `#Requires -Version 5.1
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
    Version: 1.1

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

        if (-not $nic) {
            Write-Warning "Could not find an active, IP-enabled network adapter."
            return $null
        }

        return @{
            MacAddress    = ($nic.MACAddress -replace ":").ToUpper()
            IpAddress     = $nic.IPAddress[0]
            Model         = $computerSystem.Model
            SerialNumber  = $bios.SerialNumber
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

if ([string]::IsNullOrWhiteSpace($RackSlot) -or [string]::IsNullOrWhiteSpace($Hostname) -or [string]::IsNullOrWhiteSpace($TechName)) {
    Write-Warning "All fields are required."
    Read-Host "Press Enter to exit."
    Exit 1
}

# 2. Gather Automated Info
$hwInfo = Get-HardwareInfo
if (-not $hwInfo) {
    Read-Host "Failed to gather hardware data. Press Enter to exit."
    Exit 1
}

# 3. Combine Data
$deviceData = @{
    id            = $hwInfo.MacAddress
    hostname      = $Hostname.Trim()
    macAddress    = $hwInfo.MacAddress
    ipAddress     = $hwInfo.IpAddress
    model         = $hwInfo.Model
    serialNumber  = $hwInfo.SerialNumber
    assetTag      = "" # Can be added if needed
    slot          = $RackSlot.Trim()
    tech          = $TechName.Trim()
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
    $deviceData | ConvertTo-Json -Depth 4 | Out-File -FilePath $filePath -Encoding UTF8
    
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

export const ImagingScriptPage: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-cyan-400">Imaging Metadata Gatherer Script</h2>
            <p className="text-sm text-slate-400">
              Run this PowerShell script in WinPE/Task Sequence to register devices with Image Monitor.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
            <li>Save the script below as <span className="font-mono text-cyan-400">MetaGather.ps1</span>.</li>
            <li>Set <span className="font-mono text-cyan-400">$NetworkSharePath</span> to your imaging share.</li>
            <li>Add the script to the task sequence before “Apply Operating System”.</li>
            <li>When the script runs, the device appears in the Image Monitor tab.</li>
          </ol>
        </div>

        <div className="mt-6 bg-slate-900/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-300">MetaGather.ps1</p>
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-xs font-semibold bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition"
            >
              {copied ? 'Copied' : 'Copy Script'}
            </button>
          </div>
          <pre className="text-xs text-slate-200 overflow-auto max-h-[420px]">
            <code>{scriptContent}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
