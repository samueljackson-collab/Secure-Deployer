import React, { useState, useRef, useEffect, useCallback } from 'react';

const NETWORK_SHARE_PLACEHOLDER = '\\\\SERVER\\SHARE\\imaging_data';
const DEFAULT_DURATION = 180;

function generateScriptContent(sharePath: string, duration: number): string {
  const escapedPath = sharePath.replace(/\\/g, '\\\\');
  return `#Requires -Version 5.1
<#
.SYNOPSIS
  Device Metadata Gatherer for Image Monitor

.DESCRIPTION
    This script is designed to be run in a WinPE / Task Sequence environment BEFORE OS installation.
    It gathers essential hardware and technician-provided information, then saves it as a JSON file
    to a centralized network share. The Secure Deployment Runner's "Image Monitor" tab polls this
    share to display live imaging status.

    Parameters can be passed directly via the command line or set via Task Sequence variables
    (TS_NetworkSharePath and TS_ImagingDuration). Command-line parameters take precedence.

.PARAMETER NetworkSharePath
    UNC path to the network share where imaging data is stored.
    Falls back to Task Sequence variable 'TS_NetworkSharePath' if not provided.
    Example: \\\\SERVER\\SHARE\\imaging_data

.PARAMETER Duration
    Estimated imaging duration in minutes. Defaults to ${duration}.
    Falls back to Task Sequence variable 'TS_ImagingDuration' if not provided.

.EXAMPLE
    powershell.exe -ExecutionPolicy Bypass -NoProfile -File MetaGather.ps1 -NetworkSharePath "\\\\DEPLOYSVR\\ImgData$"
    Runs with a specified network share and default duration.

.EXAMPLE
    powershell.exe -ExecutionPolicy Bypass -NoProfile -File MetaGather.ps1 -NetworkSharePath "\\\\DEPLOYSVR\\ImgData$" -Duration 240
    Runs with a specified network share and 240-minute duration estimate.

.NOTES
    Author: Secure Deployment Runner
    Version: 2.0

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

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false, HelpMessage = "UNC path to the imaging data network share.")]
    [string]$NetworkSharePath,

    [Parameter(Mandatory = $false, HelpMessage = "Estimated imaging duration in minutes.")]
    [ValidateRange(1, 1440)]
    [int]$Duration = 0
)

# --- ERROR HANDLING SETUP ---
$ErrorActionPreference = 'Stop'
$script:LogMessages = @()

function Write-Log {
    param(
        [Parameter(Mandatory)]
        [string]$Message,
        [ValidateSet('INFO','WARNING','ERROR','SUCCESS')]
        [string]$Level = 'INFO'
    )
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $entry = "[$timestamp] [$Level] $Message"
    $script:LogMessages += $entry
    switch ($Level) {
        'ERROR'   { Write-Host $entry -ForegroundColor Red }
        'WARNING' { Write-Host $entry -ForegroundColor Yellow }
        'SUCCESS' { Write-Host $entry -ForegroundColor Green }
        default   { Write-Host $entry }
    }
}

function Get-TaskSequenceVariable {
    param([Parameter(Mandatory)][string]$VariableName)
    try {
        $tsEnv = New-Object -ComObject Microsoft.SMS.TSEnvironment -ErrorAction Stop
        return $tsEnv.Value($VariableName)
    }
    catch {
        return $null
    }
}

function Test-NetworkShareAccess {
    <#
    .SYNOPSIS
        Validates that the network share path is reachable and writable.
        Returns a hashtable with 'Success' (bool) and 'ErrorMessage' (string).
    #>
    param([Parameter(Mandatory)][string]$SharePath)

    # Validate UNC path format
    if ($SharePath -notmatch '^\\\\\\\\[^\\\\]+\\\\[^\\\\]+') {
        return @{
            Success = $false
            ErrorMessage = "Invalid UNC path format: '$SharePath'. Expected format: \\\\\\\\SERVER\\\\SHARE\\\\path"
        }
    }

    # Test if the network share is reachable
    try {
        if (-not (Test-Path -Path $SharePath -ErrorAction Stop)) {
            # Try to create the directory
            try {
                New-Item -Path $SharePath -ItemType Directory -Force -ErrorAction Stop | Out-Null
                Write-Log "Created directory on network share: $SharePath"
            }
            catch [System.UnauthorizedAccessException] {
                return @{
                    Success = $false
                    ErrorMessage = "ACCESS DENIED: Cannot create directory '$SharePath'. Verify that the service account or current user has write permissions to the network share. Check with your system administrator."
                }
            }
            catch {
                return @{
                    Success = $false
                    ErrorMessage = "NETWORK SHARE NOT FOUND: '$SharePath' does not exist and could not be created. Verify the server name and share name are correct, and that the server is reachable on the network. Error: $_"
                }
            }
        }
    }
    catch [System.UnauthorizedAccessException] {
        return @{
            Success = $false
            ErrorMessage = "ACCESS DENIED: Cannot access '$SharePath'. The current credentials do not have permission to access this network share. Ensure the Task Sequence is running under an account with read/write access to the share."
        }
    }
    catch [System.IO.IOException] {
        return @{
            Success = $false
            ErrorMessage = "NETWORK ERROR: Cannot reach '$SharePath'. The network path was not found. Verify: (1) The server is online and reachable, (2) The share name is correct, (3) Network connectivity is available in WinPE. Error: $_"
        }
    }
    catch {
        return @{
            Success = $false
            ErrorMessage = "UNEXPECTED ERROR accessing '$SharePath': $_"
        }
    }

    # Test write access by creating and removing a temporary file
    $testFile = Join-Path -Path $SharePath -ChildPath ".write_test_$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [System.IO.File]::WriteAllText($testFile, 'write_test', [System.Text.Encoding]::UTF8)
        Remove-Item -Path $testFile -Force -ErrorAction SilentlyContinue
    }
    catch [System.UnauthorizedAccessException] {
        return @{
            Success = $false
            ErrorMessage = "WRITE ACCESS DENIED: The share '$SharePath' is accessible but the current account cannot write to it. The service account needs Modify or Write permissions on this share and its NTFS permissions."
        }
    }
    catch {
        return @{
            Success = $false
            ErrorMessage = "WRITE TEST FAILED on '$SharePath': Could not create a test file. Error: $_"
        }
    }

    return @{ Success = $true; ErrorMessage = $null }
}

function Write-DeviceReceipt {
    <#
    .SYNOPSIS
        Writes the device data JSON to the network share with retry logic.
    #>
    param(
        [Parameter(Mandatory)][hashtable]$DeviceData,
        [Parameter(Mandatory)][string]$FilePath
    )

    $maxRetries = 3
    $retryDelay = 2

    for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
        try {
            $json = $DeviceData | ConvertTo-Json -Depth 4
            [System.IO.File]::WriteAllText($FilePath, $json, [System.Text.Encoding]::UTF8)
            return @{ Success = $true; ErrorMessage = $null }
        }
        catch [System.IO.IOException] {
            if ($attempt -lt $maxRetries) {
                Write-Log "File write failed (attempt $attempt/$maxRetries). Retrying in $retryDelay seconds... Error: $_" -Level WARNING
                Start-Sleep -Seconds $retryDelay
                $retryDelay *= 2
            }
            else {
                return @{
                    Success = $false
                    ErrorMessage = "FILE WRITE FAILED after $maxRetries attempts: Could not write to '$FilePath'. The file may be locked by another process, or the disk may be full. Error: $_"
                }
            }
        }
        catch [System.UnauthorizedAccessException] {
            return @{
                Success = $false
                ErrorMessage = "FILE WRITE ACCESS DENIED: Cannot write to '$FilePath'. Check that the account running this script has write permissions to the network share. Error: $_"
            }
        }
        catch {
            return @{
                Success = $false
                ErrorMessage = "UNEXPECTED FILE WRITE ERROR on '$FilePath': $_"
            }
        }
    }
}

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
            Write-Log "Could not find an active, IP-enabled network adapter." -Level WARNING
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
        Write-Log "An error occurred while gathering hardware info: $_" -Level ERROR
        return $null
    }
}

# --- PARAMETER RESOLUTION ---

# Resolve NetworkSharePath: CLI param > Task Sequence variable > default
if ([string]::IsNullOrWhiteSpace($NetworkSharePath)) {
    $tsSharePath = Get-TaskSequenceVariable -VariableName 'TS_NetworkSharePath'
    if (-not [string]::IsNullOrWhiteSpace($tsSharePath)) {
        $NetworkSharePath = $tsSharePath
        Write-Log "NetworkSharePath loaded from Task Sequence variable: $NetworkSharePath"
    }
    else {
        $NetworkSharePath = "${escapedPath}"
        Write-Log "NetworkSharePath using configured default: $NetworkSharePath"
    }
}
else {
    Write-Log "NetworkSharePath provided via parameter: $NetworkSharePath"
}

# Resolve Duration: CLI param > Task Sequence variable > default
if ($Duration -eq 0) {
    $tsDuration = Get-TaskSequenceVariable -VariableName 'TS_ImagingDuration'
    if (-not [string]::IsNullOrWhiteSpace($tsDuration)) {
        try {
            $Duration = [int]$tsDuration
            Write-Log "Duration loaded from Task Sequence variable: $Duration minutes"
        }
        catch {
            Write-Log "Invalid TS_ImagingDuration value '$tsDuration'. Using default." -Level WARNING
            $Duration = ${duration}
        }
    }
    else {
        $Duration = ${duration}
        Write-Log "Duration using default: $Duration minutes"
    }
}
else {
    Write-Log "Duration provided via parameter: $Duration minutes"
}

# --- MAIN LOGIC ---

Show-Menu

Write-Host "Network Share : $NetworkSharePath" -ForegroundColor Cyan
Write-Host "Est. Duration : $Duration minutes" -ForegroundColor Cyan
Write-Host

# Validate network share before gathering data
Write-Log "Validating network share access..."
$shareTest = Test-NetworkShareAccess -SharePath $NetworkSharePath
if (-not $shareTest.Success) {
    Write-Log $shareTest.ErrorMessage -Level ERROR
    Write-Host ""
    Write-Host "NETWORK SHARE VALIDATION FAILED" -ForegroundColor Red
    Write-Host $shareTest.ErrorMessage -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "  1. Verify the server name and share path are correct" -ForegroundColor Yellow
    Write-Host "  2. Ensure the network is connected (check ipconfig)" -ForegroundColor Yellow
    Write-Host "  3. Verify the service account has write access to the share" -ForegroundColor Yellow
    Write-Host "  4. If in WinPE, ensure network drivers are loaded" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    Exit 1
}
Write-Log "Network share validated successfully." -Level SUCCESS

# 1. Gather Manual Input
$RackSlot = Read-Host -Prompt "Enter Rack Slot (e.g., 1-8)"
$Hostname = Read-Host -Prompt "Enter Device Hostname"
$TechName = Read-Host -Prompt "Enter Your Name/ID"

if ([string]::IsNullOrWhiteSpace($RackSlot) -or [string]::IsNullOrWhiteSpace($Hostname) -or [string]::IsNullOrWhiteSpace($TechName)) {
    Write-Log "All fields are required. Submission aborted." -Level ERROR
    Read-Host "Press Enter to exit."
    Exit 1
}

# 2. Gather Automated Info
$hwInfo = Get-HardwareInfo
if (-not $hwInfo) {
    Write-Log "Failed to gather hardware data. Cannot continue." -Level ERROR
    Read-Host "Press Enter to exit."
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
    assetTag      = ""
    slot          = $RackSlot.Trim()
    tech          = $TechName.Trim()
    startTime     = [int64](([datetime]::UtcNow) - ([datetime]'1970-01-01')).TotalMilliseconds
    status        = "Imaging"
    progress      = 0
    duration      = $Duration
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
$filePath = Join-Path -Path $NetworkSharePath -ChildPath "$($hwInfo.MacAddress).json"
Write-Log "Writing device receipt to: $filePath"

$writeResult = Write-DeviceReceipt -DeviceData $deviceData -FilePath $filePath
if (-not $writeResult.Success) {
    Write-Log $writeResult.ErrorMessage -Level ERROR
    Write-Host ""
    Write-Host "SUBMISSION FAILED" -ForegroundColor Red
    Write-Host $writeResult.ErrorMessage -ForegroundColor Red
    Read-Host "Press Enter to exit."
    Exit 1
}

Write-Log "Device receipt submitted successfully." -Level SUCCESS
Write-Host "[SUCCESS] Device receipt submitted successfully to monitor." -ForegroundColor Green
Write-Host "You can now start the imaging process."
Start-Sleep -Seconds 3
`;
}

/** Validates a UNC path format: \\SERVER\SHARE with optional subfolders */
function isValidUncPath(path: string): boolean {
  // Must start with \\ followed by server name, then \share, then optional \subpath
  return /^\\\\[a-zA-Z0-9._-]+\\[a-zA-Z0-9$._-]+(\\[a-zA-Z0-9$._-]+)*\\?$/.test(path);
}

function getUncPathError(path: string): string | null {
  if (!path.trim()) {
    return null; // Empty is allowed (uses placeholder default)
  }
  if (!path.startsWith('\\\\')) {
    return 'UNC path must start with \\\\';
  }
  const parts = path.replace(/^\\\\/, '').split('\\').filter(Boolean);
  if (parts.length < 2) {
    return 'Path must include both a server name and share name (e.g., \\\\SERVER\\SHARE)';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(parts[0])) {
    return 'Server name contains invalid characters';
  }
  for (let i = 1; i < parts.length; i++) {
    if (!/^[a-zA-Z0-9$._-]+$/.test(parts[i])) {
      return `Path segment "${parts[i]}" contains invalid characters`;
    }
  }
  return null;
}

export const ImagingScriptPage: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [sharePath, setSharePath] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [configSaved, setConfigSaved] = useState(false);
  const [pathTouched, setPathTouched] = useState(false);
  const copiedTimeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const savedTimeoutRef = useRef<number | null>(null);

  const effectiveSharePath = sharePath.trim() || NETWORK_SHARE_PLACEHOLDER;
  const pathError = pathTouched ? getUncPathError(sharePath) : null;
  const isPathValid = !sharePath.trim() || isValidUncPath(sharePath.trim());
  const scriptContent = generateScriptContent(effectiveSharePath, duration);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
      }
      if (savedTimeoutRef.current !== null) {
        window.clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (copiedTimeoutRef.current !== null) {
      window.clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    }
    if (errorTimeoutRef.current !== null) {
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }

    setCopyError(null);
    try {
      await navigator.clipboard.writeText(scriptContent);
      setCopied(true);
      copiedTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy imaging script content.', error);
      setCopied(false);
      setCopyError('Unable to copy script to clipboard. Please try again.');
      errorTimeoutRef.current = window.setTimeout(() => {
        setCopyError(null);
      }, 4000);
    }
  }, [scriptContent]);

  const handleSaveConfig = useCallback(() => {
    if (!isPathValid) return;
    if (savedTimeoutRef.current !== null) {
      window.clearTimeout(savedTimeoutRef.current);
    }
    setConfigSaved(true);
    savedTimeoutRef.current = window.setTimeout(() => {
      setConfigSaved(false);
    }, 2000);
  }, [isPathValid]);

  const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 1440) {
      setDuration(val);
    } else if (e.target.value === '') {
      setDuration(DEFAULT_DURATION);
    }
  }, []);

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

        {/* Configuration Section */}
        <div className="border-t border-slate-700 pt-4 mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Configuration</h3>
          <p className="text-xs text-slate-400 mb-3">
            Set the network share path and duration below. These values will be embedded in the script as defaults.
            They can still be overridden at runtime via command-line parameters or Task Sequence variables.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="sharePath" className="block text-xs font-semibold text-slate-400 mb-1">
                Network Share Path (UNC)
              </label>
              <input
                id="sharePath"
                type="text"
                value={sharePath}
                onChange={(e) => { setSharePath(e.target.value); setConfigSaved(false); }}
                onBlur={() => setPathTouched(true)}
                placeholder={NETWORK_SHARE_PLACEHOLDER}
                className={`w-full px-3 py-2 bg-slate-900 border rounded-md text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 ${
                  pathError
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-600 focus:ring-cyan-500'
                }`}
                aria-invalid={!!pathError}
                aria-describedby={pathError ? 'sharePath-error' : undefined}
              />
              {pathError && (
                <p id="sharePath-error" role="alert" className="mt-1 text-xs text-rose-400">
                  {pathError}
                </p>
              )}
              {!pathError && sharePath.trim() && isPathValid && (
                <p className="mt-1 text-xs text-emerald-400">Valid UNC path</p>
              )}
            </div>
            <div>
              <label htmlFor="duration" className="block text-xs font-semibold text-slate-400 mb-1">
                Est. Duration (minutes)
              </label>
              <input
                id="duration"
                type="number"
                min={1}
                max={1440}
                value={duration}
                onChange={handleDurationChange}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-sm font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <p className="mt-1 text-xs text-slate-500">1 &ndash; 1440 min</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleSaveConfig}
              disabled={!isPathValid}
              className="px-4 py-1.5 text-xs font-semibold bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {configSaved ? 'Saved to Script' : 'Save to Script'}
            </button>
            {configSaved && (
              <span className="text-xs text-emerald-400" role="status">
                Configuration applied. Copy the script below to use these settings.
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
            <li>Configure the network share path and duration above, then copy the script.</li>
            <li>Save the script as <span className="font-mono text-cyan-400">MetaGather.ps1</span>.</li>
            <li>Add the script to the task sequence before &ldquo;Apply Operating System&rdquo;.</li>
            <li>
              <span className="text-slate-400">(Optional)</span> Override at runtime via parameters:
              <code className="ml-1 text-xs text-cyan-400 bg-slate-900/60 px-1.5 py-0.5 rounded">
                -NetworkSharePath &quot;\\SERVER\SHARE&quot; -Duration 240
              </code>
            </li>
            <li>
              <span className="text-slate-400">(Optional)</span> Or set Task Sequence variables{' '}
              <code className="text-xs text-cyan-400 bg-slate-900/60 px-1.5 py-0.5 rounded">TS_NetworkSharePath</code> and{' '}
              <code className="text-xs text-cyan-400 bg-slate-900/60 px-1.5 py-0.5 rounded">TS_ImagingDuration</code>.
            </li>
            <li>When the script runs, the device appears in the Image Monitor tab.</li>
          </ol>
        </div>

        <div className="mt-6 bg-slate-900/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-300">MetaGather.ps1</p>
            <div className="flex items-center gap-3">
              {copyError ? (
                <span
                  id="copy-error-message"
                  role="alert"
                  aria-live="assertive"
                  className="text-xs text-rose-400"
                >
                  {copyError}
                </span>
              ) : null}
              <button
                onClick={handleCopy}
                className="px-3 py-1 text-xs font-semibold bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition"
                aria-describedby={copyError ? 'copy-error-message' : undefined}
              >
                {copied ? 'Copied' : 'Copy Script'}
              </button>
            </div>
          </div>
          <pre className="text-xs text-slate-200 overflow-auto max-h-[420px]">
            <code>{scriptContent}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
