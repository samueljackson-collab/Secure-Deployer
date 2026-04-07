/**
 * AutoTag WinPE Intake Script
 *
 * This PowerShell script runs during the PXE task sequence in the WinPE environment
 * (before OS installation). It collects device identity metadata from hardware and
 * operator input, then writes a JSON record to a configured network share.
 * Image Monitor polls that share path every 30 seconds to populate the rack view.
 *
 * Prerequisites:
 *   - WinPE environment with PowerShell optional component loaded
 *   - Network connectivity to the configured share path
 *   - Share must allow write access for the WinPE machine account or specified credentials
 *
 * Usage:
 *   Run via F8 console in WinPE, or as a custom task sequence step:
 *     powershell.exe -ExecutionPolicy Bypass -File X:\Deploy\autotag.ps1
 *   Optionally pass share path as parameter:
 *     powershell.exe -ExecutionPolicy Bypass -File X:\Deploy\autotag.ps1 -SharePath "\\SERVER\AutoTagShare"
 */

export const AUTOTAG_WINPE_SCRIPT = `#Requires -Version 3.0
<#
.SYNOPSIS
    AutoTag WinPE Device Intake Script
.DESCRIPTION
    Collects device identity metadata and writes a JSON record to a network share
    for consumption by Image Monitor. Run during PXE task sequence in WinPE.
.PARAMETER SharePath
    UNC path to the network share where JSON records are written.
    Default: \\\\DEPLOY-SRV\\AutoTagShare
.PARAMETER Credentials
    Optional PSCredential for authenticating to the share. If omitted, uses
    the current session context (machine account in WinPE).
.EXAMPLE
    .\\autotag.ps1 -SharePath "\\\\10.0.1.50\\AutoTagShare"
#>

param(
    [string]$SharePath = "\\\\DEPLOY-SRV\\AutoTagShare",
    [System.Management.Automation.PSCredential]$Credential = $null
)

$ErrorActionPreference = 'Stop'
$VerbosePreference = 'Continue'

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "       AutoTag - WinPE Device Intake Script         " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Auto-collect hardware identity ---
Write-Host "[INFO] Collecting hardware identity..." -ForegroundColor Yellow

# MAC address and IP (first active non-loopback adapter)
$adapter = Get-WmiObject Win32_NetworkAdapterConfiguration |
    Where-Object { $_.IPEnabled -eq $true -and $_.MACAddress -ne $null } |
    Select-Object -First 1

$macAddress   = if ($adapter)                          { $adapter.MACAddress }      else { "UNKNOWN" }
$ipAddress    = if ($adapter -and $adapter.IPAddress)  { $adapter.IPAddress[0] }    else { "UNKNOWN" }

# Model, serial number, asset tag
$csProduct    = Get-WmiObject Win32_ComputerSystemProduct
$bios         = Get-WmiObject Win32_BIOS
$model        = ($csProduct.Name).Trim()
$serialNumber = ($bios.SerialNumber).Trim()
$assetTag     = ($csProduct.IdentifyingNumber).Trim()

Write-Host "  MAC Address : $macAddress"
Write-Host "  IP Address  : $ipAddress"
Write-Host "  Model       : $model"
Write-Host "  Serial      : $serialNumber"
Write-Host "  Asset Tag   : $assetTag"
Write-Host ""

# --- Step 2: Operator input ---
Write-Host "[INPUT] Enter device information" -ForegroundColor Yellow
Write-Host ""

do {
    $rackSlot = (Read-Host "  Rack Slot number (e.g. 12)").Trim()
} while ([string]::IsNullOrEmpty($rackSlot))

do {
    $hostname = (Read-Host "  Hostname (e.g. HQ-LT-001)").Trim().ToUpper()
    if ([string]::IsNullOrEmpty($hostname)) {
        Write-Host "  Hostname cannot be empty." -ForegroundColor Red
    }
} while ([string]::IsNullOrEmpty($hostname))

do {
    $techName = (Read-Host "  Technician name").Trim()
} while ([string]::IsNullOrEmpty($techName))

Write-Host ""

# --- Step 3: Build JSON record ---
$timestamp    = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$safeFilename = $hostname -replace '[^a-zA-Z0-9_\\-]', '_'

$record = [ordered]@{
    hostname     = $hostname
    macAddress   = $macAddress
    ipAddress    = $ipAddress
    model        = $model
    serialNumber = $serialNumber
    assetTag     = $assetTag
    rackSlot     = $rackSlot
    technician   = $techName
    timestamp    = $timestamp
    status       = "Imaging"
    progress     = 0
}

$json = $record | ConvertTo-Json -Depth 3

Write-Host "[INFO] Record:" -ForegroundColor Yellow
Write-Host $json
Write-Host ""

# --- Step 4: Connect to share and write record ---
Write-Host "[INFO] Connecting to share: $SharePath" -ForegroundColor Yellow

try {
    if ($Credential) {
        $netResult = net use $SharePath /user:$($Credential.UserName) $($Credential.GetNetworkCredential().Password) 2>&1
        if ($LASTEXITCODE -ne 0) { throw "net use failed: $netResult" }
    }

    if (-not (Test-Path $SharePath)) {
        throw "Share path not reachable: $SharePath"
    }

    $outputPath = Join-Path $SharePath "$safeFilename.json"
    $json | Out-File -FilePath $outputPath -Encoding UTF8 -Force

    Write-Host "[OK] Record written: $outputPath" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to write record: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Verify share path is correct: $SharePath"
    Write-Host "  2. Verify network connectivity: ping DEPLOY-SRV"
    Write-Host "  3. Verify share permissions allow write access from WinPE"
    Write-Host "  4. Re-run with -Credential if authentication is required"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  AutoTag complete. Device will appear in Image      " -ForegroundColor Green
Write-Host "  Monitor within the next polling cycle (~30s).      " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
`;
