<#
.SYNOPSIS
    Gathers device hardware, software, and security metadata during SCCM/MDT
    imaging task sequences.

.DESCRIPTION
    This script collects comprehensive device metadata using WMI/CIM cmdlets
    and outputs a JSON file that conforms to the ImagingMetadata interface
    used by the Secure-Deployer Image Monitor.

    The script is completely self-contained. It does NOT use any AI services,
    internet connectivity, or cloud APIs. All data is gathered from the local
    system using built-in Windows Management Instrumentation (WMI) classes.

    Progress is written to a polling file at %TEMP%\imaging_progress.json so
    that the Image Monitor can track collection status in real time.

    Safe for hospital networks - read-only operations only. No system
    modifications, no registry writes, no service changes.

.PARAMETER OutputPath
    Full path for the output JSON metadata file.
    Default: $env:TEMP\DeviceMetadata\<COMPUTERNAME>.json

.EXAMPLE
    powershell.exe -ExecutionPolicy Bypass -NoProfile -File Gather-DeviceMetadata.ps1
    Runs with default output path.

.EXAMPLE
    powershell.exe -ExecutionPolicy Bypass -NoProfile -File Gather-DeviceMetadata.ps1 -OutputPath "C:\Temp\metadata.json"
    Runs with a custom output path.

.NOTES
    Designed for: SCCM/MDT Task Sequence environments
    Requires:     PowerShell 3.0+ (available in WinPE 5.0+)
    Dependencies: None (uses only built-in WMI/CIM classes)
    Safety:       Read-only - does not modify any system settings
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$OutputPath
)

# ============================================================================
#  STRICT MODE AND ERROR PREFERENCE
# ============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'
$script:ExitCode = 0

# ============================================================================
#  CONSTANTS
# ============================================================================

$ProgressFilePath = Join-Path -Path $env:TEMP -ChildPath 'imaging_progress.json'
$ScriptStartTime = Get-Date

# ============================================================================
#  HELPER FUNCTIONS
# ============================================================================

function Write-Log {
    <#
    .SYNOPSIS
        Writes a timestamped log entry to the console.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Message,

        [Parameter()]
        [ValidateSet('INFO', 'WARNING', 'ERROR', 'SUCCESS')]
        [string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $logLine = "[$timestamp] [$Level] $Message"
    switch ($Level) {
        'ERROR'   { Write-Host $logLine -ForegroundColor Red }
        'WARNING' { Write-Host $logLine -ForegroundColor Yellow }
        'SUCCESS' { Write-Host $logLine -ForegroundColor Green }
        default   { Write-Host $logLine }
    }
}

function Update-ProgressFile {
    <#
    .SYNOPSIS
        Writes the current progress state to the imaging_progress.json polling
        file so the Image Monitor can track status.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Hostname,

        [Parameter(Mandatory)]
        [string]$Status,

        [Parameter(Mandatory)]
        [int]$Progress,

        [Parameter(Mandatory)]
        [string]$CurrentStep
    )

    $progressData = @{
        hostname    = $Hostname
        status      = $Status
        progress    = $Progress
        currentStep = $CurrentStep
        timestamp   = (Get-Date -Format 'o')
    }

    try {
        $json = $progressData | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($ProgressFilePath, $json, [System.Text.Encoding]::UTF8)
    }
    catch {
        Write-Log "Failed to update progress file: $_" -Level WARNING
    }
}

function Get-WmiPropertySafe {
    <#
    .SYNOPSIS
        Safely retrieves a WMI/CIM class, returning $null on failure instead
        of throwing. Handles missing classes, access denied, and timeouts.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ClassName,

        [Parameter()]
        [string]$Namespace = 'root\cimv2',

        [Parameter()]
        [string]$Filter
    )

    try {
        $params = @{
            ClassName   = $ClassName
            Namespace   = $Namespace
            ErrorAction = 'Stop'
        }
        if ($Filter) {
            $params['Filter'] = $Filter
        }

        # Prefer Get-CimInstance (modern) but fall back to Get-WmiObject (legacy)
        if (Get-Command -Name Get-CimInstance -ErrorAction SilentlyContinue) {
            return Get-CimInstance @params
        }
        else {
            $wmiParams = @{
                Class       = $ClassName
                Namespace   = $Namespace
                ErrorAction = 'Stop'
            }
            if ($Filter) {
                $wmiParams['Filter'] = $Filter
            }
            return Get-WmiObject @wmiParams
        }
    }
    catch [System.Runtime.InteropServices.COMException] {
        Write-Log "WMI class '$ClassName' not available (COM error): $_" -Level WARNING
        return $null
    }
    catch [Microsoft.Management.Infrastructure.CimException] {
        Write-Log "CIM query for '$ClassName' failed: $_" -Level WARNING
        return $null
    }
    catch [System.UnauthorizedAccessException] {
        Write-Log "Access denied querying '$ClassName'. Running without admin privileges." -Level WARNING
        return $null
    }
    catch {
        Write-Log "Unexpected error querying '$ClassName': $_" -Level WARNING
        return $null
    }
}

function Get-TaskSequenceVariable {
    <#
    .SYNOPSIS
        Attempts to read a variable from the SCCM/MDT Task Sequence environment.
        Returns $null if not running within a task sequence.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$VariableName
    )

    try {
        $tsEnv = New-Object -ComObject Microsoft.SMS.TSEnvironment -ErrorAction Stop
        return $tsEnv.Value($VariableName)
    }
    catch {
        # Not in a task sequence environment - this is expected on standalone runs
        return $null
    }
}

# ============================================================================
#  MAIN COLLECTION LOGIC
# ============================================================================

function Invoke-MetadataCollection {
    [CmdletBinding()]
    param()

    # Determine hostname early for progress reporting
    $hostname = $env:COMPUTERNAME
    if (-not $hostname) { $hostname = 'UNKNOWN' }

    Write-Log "Starting device metadata collection for: $hostname"
    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 0 -CurrentStep 'Initializing'

    # Initialize the metadata hashtable with safe defaults
    $metadata = @{
        hostname          = $hostname
        serialNumber      = 'Unknown'
        macAddress        = 'Unknown'
        model             = 'Unknown'
        manufacturer      = 'Unknown'
        biosVersion       = 'Unknown'
        biosDate          = 'Unknown'
        totalRamMB        = 0
        diskSizeGB        = 0
        osVersion         = 'Unknown'
        ipAddress         = 'Unknown'
        taskSequenceName  = 'Unknown'
        collectedAt       = (Get-Date -Format 'o')
        imageProgress     = 0
        encryptionReady   = $false
    }

    # ------------------------------------------------------------------
    #  Step 1: System Identity (10%)
    # ------------------------------------------------------------------
    Write-Log 'Gathering system identity...'
    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 5 -CurrentStep 'Gathering system identity'

    $computerSystem = Get-WmiPropertySafe -ClassName 'Win32_ComputerSystem'
    if ($computerSystem) {
        $cs = $computerSystem | Select-Object -First 1
        $metadata.manufacturer = if ($cs.Manufacturer) { $cs.Manufacturer.Trim() } else { 'Unknown' }
        $metadata.model        = if ($cs.Model) { $cs.Model.Trim() } else { 'Unknown' }
        $metadata.totalRamMB   = [math]::Round(($cs.TotalPhysicalMemory / 1MB), 0)
        Write-Log "  Manufacturer : $($metadata.manufacturer)"
        Write-Log "  Model        : $($metadata.model)"
        Write-Log "  Total RAM    : $($metadata.totalRamMB) MB"
    }
    else {
        Write-Log 'Win32_ComputerSystem not available. System identity will be incomplete.' -Level WARNING
    }

    # Serial Number and Asset Tag from SystemEnclosure
    $enclosure = Get-WmiPropertySafe -ClassName 'Win32_SystemEnclosure'
    if ($enclosure) {
        $enc = $enclosure | Select-Object -First 1
        $metadata.serialNumber = if ($enc.SerialNumber -and $enc.SerialNumber.Trim() -ne '') {
            $enc.SerialNumber.Trim()
        }
        else {
            'Unknown'
        }
        Write-Log "  Serial Number: $($metadata.serialNumber)"

        $assetTag = if ($enc.SMBIOSAssetTag -and $enc.SMBIOSAssetTag.Trim() -ne '') {
            $enc.SMBIOSAssetTag.Trim()
        }
        else {
            'Not Set'
        }
        Write-Log "  Asset Tag    : $assetTag"
    }

    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 10 -CurrentStep 'System identity collected'

    # ------------------------------------------------------------------
    #  Step 2: BIOS Information (20%)
    # ------------------------------------------------------------------
    Write-Log 'Gathering BIOS information...'
    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 15 -CurrentStep 'Gathering BIOS information'

    $bios = Get-WmiPropertySafe -ClassName 'Win32_BIOS'
    if ($bios) {
        $b = $bios | Select-Object -First 1
        $metadata.biosVersion = if ($b.SMBIOSBIOSVersion) { $b.SMBIOSBIOSVersion.Trim() } else { 'Unknown' }

        # Parse BIOS date - handle both CIM datetime and string formats
        if ($b.ReleaseDate) {
            try {
                if ($b.ReleaseDate -is [datetime]) {
                    $metadata.biosDate = $b.ReleaseDate.ToString('yyyy-MM-dd')
                }
                elseif ($b.ReleaseDate -is [string]) {
                    # WMI datetime format: yyyyMMddHHmmss.ffffff+zzz
                    $parsed = [System.Management.ManagementDateTimeConverter]::ToDateTime($b.ReleaseDate)
                    $metadata.biosDate = $parsed.ToString('yyyy-MM-dd')
                }
                else {
                    $metadata.biosDate = $b.ReleaseDate.ToString('yyyy-MM-dd')
                }
            }
            catch {
                Write-Log "  Could not parse BIOS date: $($b.ReleaseDate)" -Level WARNING
                $metadata.biosDate = 'Unknown'
            }
        }

        Write-Log "  BIOS Version : $($metadata.biosVersion)"
        Write-Log "  BIOS Date    : $($metadata.biosDate)"
    }
    else {
        Write-Log 'Win32_BIOS not available.' -Level WARNING
    }

    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 25 -CurrentStep 'BIOS information collected'

    # ------------------------------------------------------------------
    #  Step 3: Network Configuration (40%)
    # ------------------------------------------------------------------
    Write-Log 'Gathering network configuration...'
    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 30 -CurrentStep 'Gathering network configuration'

    # Get all physical network adapters with MAC addresses
    $networkConfigs = Get-WmiPropertySafe -ClassName 'Win32_NetworkAdapterConfiguration' -Filter "IPEnabled = TRUE"
    $networkAdapters = Get-WmiPropertySafe -ClassName 'Win32_NetworkAdapter' -Filter "PhysicalAdapter = TRUE"

    $allMacs = @()
    $primaryIp = 'Unknown'
    $defaultGateway = 'Unknown'
    $dnsServers = @()

    if ($networkConfigs) {
        foreach ($nic in $networkConfigs) {
            # Collect MAC addresses
            if ($nic.MACAddress) {
                # Normalize MAC: remove colons/dashes, uppercase
                $normalizedMac = ($nic.MACAddress -replace '[:\-]', '').ToUpper()
                $allMacs += $normalizedMac
            }

            # Get primary IP (first adapter with a non-APIPA address)
            if ($primaryIp -eq 'Unknown' -and $nic.IPAddress) {
                foreach ($ip in $nic.IPAddress) {
                    # Skip IPv6, APIPA (169.254.x.x), and loopback
                    if ($ip -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$' -and
                        $ip -notmatch '^169\.254\.' -and
                        $ip -ne '127.0.0.1') {
                        $primaryIp = $ip
                        break
                    }
                }
            }

            # Default gateway
            if ($defaultGateway -eq 'Unknown' -and $nic.DefaultIPGateway) {
                foreach ($gw in $nic.DefaultIPGateway) {
                    if ($gw -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
                        $defaultGateway = $gw
                        break
                    }
                }
            }

            # DNS servers
            if ($nic.DNSServerSearchOrder) {
                $dnsServers += $nic.DNSServerSearchOrder
            }
        }
    }

    # Also collect MACs from physical adapters that may not be IP-enabled
    if ($networkAdapters) {
        foreach ($adapter in $networkAdapters) {
            if ($adapter.MACAddress) {
                $normalizedMac = ($adapter.MACAddress -replace '[:\-]', '').ToUpper()
                if ($allMacs -notcontains $normalizedMac) {
                    $allMacs += $normalizedMac
                }
            }
        }
    }

    # Use the first MAC as the primary MAC address
    $metadata.macAddress = if ($allMacs.Count -gt 0) { $allMacs[0] } else { 'Unknown' }
    $metadata.ipAddress  = $primaryIp

    Write-Log "  MAC Address(es): $($allMacs -join ', ')"
    Write-Log "  Primary IP     : $primaryIp"
    Write-Log "  Default Gateway: $defaultGateway"
    Write-Log "  DNS Servers    : $(($dnsServers | Select-Object -Unique) -join ', ')"

    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 40 -CurrentStep 'Network configuration collected'

    # ------------------------------------------------------------------
    #  Step 4: Storage Information (55%)
    # ------------------------------------------------------------------
    Write-Log 'Gathering storage information...'
    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 45 -CurrentStep 'Gathering storage information'

    $disks = Get-WmiPropertySafe -ClassName 'Win32_DiskDrive'
    $totalDiskGB = 0

    if ($disks) {
        foreach ($disk in $disks) {
            $diskSizeGB = [math]::Round(($disk.Size / 1GB), 1)
            $totalDiskGB += $diskSizeGB
            Write-Log "  Disk: $($disk.Model) - $diskSizeGB GB ($($disk.MediaType))"
        }
    }

    # Get logical disk free space for the system drive
    $systemDrive = $env:SystemDrive
    if (-not $systemDrive) { $systemDrive = 'C:' }
    $logicalDisk = Get-WmiPropertySafe -ClassName 'Win32_LogicalDisk' -Filter "DeviceID = '$systemDrive'"
    $freeSpaceGB = 0
    if ($logicalDisk) {
        $ld = $logicalDisk | Select-Object -First 1
        $freeSpaceGB = [math]::Round(($ld.FreeSpace / 1GB), 1)
        Write-Log "  System Drive $systemDrive Free: $freeSpaceGB GB"
    }

    # Get partition layout
    $partitions = Get-WmiPropertySafe -ClassName 'Win32_DiskPartition'
    if ($partitions) {
        Write-Log "  Partitions: $($partitions.Count) total"
        foreach ($part in $partitions) {
            $partSizeGB = [math]::Round(($part.Size / 1GB), 1)
            Write-Log "    $($part.Name) - $partSizeGB GB ($($part.Type))"
        }
    }

    $metadata.diskSizeGB = [math]::Round($totalDiskGB, 0)
    Write-Log "  Total Disk Capacity: $($metadata.diskSizeGB) GB"

    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 55 -CurrentStep 'Storage information collected'

    # ------------------------------------------------------------------
    #  Step 5: Operating System (65%)
    # ------------------------------------------------------------------
    Write-Log 'Gathering OS information...'
    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 60 -CurrentStep 'Gathering OS information'

    $os = Get-WmiPropertySafe -ClassName 'Win32_OperatingSystem'
    if ($os) {
        $o = $os | Select-Object -First 1
        $metadata.osVersion = if ($o.Version) { $o.Version } else { 'Unknown' }

        $buildNumber = if ($o.BuildNumber) { $o.BuildNumber } else { 'Unknown' }
        $caption     = if ($o.Caption) { $o.Caption.Trim() } else { 'Unknown' }

        $installDate = 'Unknown'
        if ($o.InstallDate) {
            try {
                if ($o.InstallDate -is [datetime]) {
                    $installDate = $o.InstallDate.ToString('yyyy-MM-dd')
                }
                elseif ($o.InstallDate -is [string]) {
                    $parsed = [System.Management.ManagementDateTimeConverter]::ToDateTime($o.InstallDate)
                    $installDate = $parsed.ToString('yyyy-MM-dd')
                }
                else {
                    $installDate = $o.InstallDate.ToString('yyyy-MM-dd')
                }
            }
            catch {
                Write-Log "  Could not parse OS install date." -Level WARNING
            }
        }

        Write-Log "  OS Caption   : $caption"
        Write-Log "  OS Version   : $($metadata.osVersion)"
        Write-Log "  Build Number : $buildNumber"
        Write-Log "  Install Date : $installDate"
    }
    else {
        Write-Log 'Win32_OperatingSystem not available.' -Level WARNING
    }

    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 65 -CurrentStep 'OS information collected'

    # ------------------------------------------------------------------
    #  Step 6: Security - BitLocker, TPM, Secure Boot (80%)
    # ------------------------------------------------------------------
    Write-Log 'Gathering security information...'
    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 70 -CurrentStep 'Gathering security information'

    # --- BitLocker / Encryption Status ---
    $encryptionReady = $false
    $bitlockerStatus = 'Unknown'

    # Try Win32_EncryptableVolume (requires admin, may not be available in WinPE)
    try {
        $encryptableVolumes = Get-WmiPropertySafe -ClassName 'Win32_EncryptableVolume' -Namespace 'root\cimv2\Security\MicrosoftVolumeEncryption'
        if ($encryptableVolumes) {
            $sysVol = $encryptableVolumes | Where-Object { $_.DriveLetter -eq $systemDrive } | Select-Object -First 1
            if (-not $sysVol) {
                $sysVol = $encryptableVolumes | Select-Object -First 1
            }

            if ($sysVol) {
                # ProtectionStatus: 0 = Off, 1 = On, 2 = Unknown
                switch ($sysVol.ProtectionStatus) {
                    0 { $bitlockerStatus = 'Disabled' }
                    1 { $bitlockerStatus = 'Enabled'; $encryptionReady = $true }
                    2 { $bitlockerStatus = 'Unknown' }
                    default { $bitlockerStatus = 'Unknown' }
                }
            }
        }
    }
    catch {
        Write-Log "  BitLocker query not supported in this environment." -Level WARNING
    }

    Write-Log "  BitLocker Status: $bitlockerStatus"

    # --- TPM Version ---
    $tpmVersion = 'Not Detected'
    try {
        $tpm = Get-WmiPropertySafe -ClassName 'Win32_Tpm' -Namespace 'root\cimv2\Security\MicrosoftTpm'
        if ($tpm) {
            $t = $tpm | Select-Object -First 1
            if ($t.SpecVersion) {
                # SpecVersion is typically "2.0, 0, 1.38" - extract the major version
                $tpmVersion = ($t.SpecVersion -split ',')[0].Trim()
                Write-Log "  TPM Version  : $tpmVersion"

                # If TPM 2.0 is present and BitLocker is available, mark encryption ready
                if ($tpmVersion -match '^2') {
                    $encryptionReady = $true
                }
            }
            if ($t.IsActivated_InitialValue -eq $true) {
                Write-Log "  TPM Activated: Yes"
            }
            else {
                Write-Log "  TPM Activated: No" -Level WARNING
            }
        }
        else {
            Write-Log "  TPM not detected or not accessible." -Level WARNING
        }
    }
    catch {
        Write-Log "  TPM query failed: $_" -Level WARNING
    }

    # --- Secure Boot Status ---
    $secureBootStatus = 'Unknown'
    try {
        # Confirm-SecureBootUEFI is available in full Windows but may not be in WinPE
        if (Get-Command -Name Confirm-SecureBootUEFI -ErrorAction SilentlyContinue) {
            $secureBoot = Confirm-SecureBootUEFI -ErrorAction Stop
            $secureBootStatus = if ($secureBoot) { 'Enabled' } else { 'Disabled' }
        }
        else {
            # Fallback: check registry (only works in full Windows)
            $regPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\State'
            if (Test-Path $regPath) {
                $sbState = Get-ItemProperty -Path $regPath -Name 'UEFISecureBootEnabled' -ErrorAction SilentlyContinue
                if ($null -ne $sbState) {
                    $secureBootStatus = if ($sbState.UEFISecureBootEnabled -eq 1) { 'Enabled' } else { 'Disabled' }
                }
            }
        }
    }
    catch {
        Write-Log "  Secure Boot check not available in this environment." -Level WARNING
    }

    Write-Log "  Secure Boot  : $secureBootStatus"

    $metadata.encryptionReady = $encryptionReady

    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 80 -CurrentStep 'Security information collected'

    # ------------------------------------------------------------------
    #  Step 7: Task Sequence Environment (90%)
    # ------------------------------------------------------------------
    Write-Log 'Checking for SCCM/MDT task sequence environment...'
    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 85 -CurrentStep 'Checking task sequence environment'

    $tsName = Get-TaskSequenceVariable -VariableName '_SMSTSPackageName'
    if (-not $tsName) {
        $tsName = Get-TaskSequenceVariable -VariableName 'TaskSequenceName'
    }
    if (-not $tsName) {
        # Try MDT-specific variable
        $tsName = Get-TaskSequenceVariable -VariableName 'DeploymentType'
    }

    if ($tsName) {
        $metadata.taskSequenceName = $tsName
        Write-Log "  Task Sequence: $tsName"

        # Also try to get the current step
        $tsCurrentStep = Get-TaskSequenceVariable -VariableName '_SMSTSCurrentActionName'
        if ($tsCurrentStep) {
            Write-Log "  Current TS Step: $tsCurrentStep"
        }

        # Get image progress from task sequence percentage if available
        $tsProgress = Get-TaskSequenceVariable -VariableName '_SMSTSProgressPercentComplete'
        if ($tsProgress) {
            try {
                $metadata.imageProgress = [int]$tsProgress
                Write-Log "  TS Progress: $($metadata.imageProgress)%"
            }
            catch {
                Write-Log "  Could not parse TS progress value: $tsProgress" -Level WARNING
            }
        }
    }
    else {
        Write-Log '  Not running within a task sequence (standalone execution).'
        $metadata.taskSequenceName = 'Standalone Collection'
    }

    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 90 -CurrentStep 'Task sequence info collected'

    # ------------------------------------------------------------------
    #  Step 8: Finalize and set completion timestamp (100%)
    # ------------------------------------------------------------------
    Write-Log 'Finalizing metadata...'

    # Set the final collection timestamp
    $metadata.collectedAt = (Get-Date -Format 'o')

    # If we are not in a task sequence and imageProgress is still 0, set to 100
    # since the collection itself is complete
    if ($metadata.imageProgress -eq 0) {
        $metadata.imageProgress = 100
    }

    Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 95 -CurrentStep 'Finalizing metadata'

    return $metadata
}

# ============================================================================
#  OUTPUT AND FILE WRITING
# ============================================================================

function Write-MetadataToFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$Metadata,

        [Parameter(Mandatory)]
        [string]$FilePath
    )

    try {
        # Ensure the output directory exists
        $outputDir = Split-Path -Path $FilePath -Parent
        if (-not (Test-Path -Path $outputDir)) {
            New-Item -ItemType Directory -Path $outputDir -Force -ErrorAction Stop | Out-Null
            Write-Log "Created output directory: $outputDir"
        }

        # Build an ordered hashtable so the JSON keys appear in a consistent,
        # readable order that matches the ImagingMetadata interface
        $ordered = [ordered]@{
            hostname         = $Metadata.hostname
            serialNumber     = $Metadata.serialNumber
            macAddress       = $Metadata.macAddress
            model            = $Metadata.model
            manufacturer     = $Metadata.manufacturer
            biosVersion      = $Metadata.biosVersion
            biosDate         = $Metadata.biosDate
            totalRamMB       = $Metadata.totalRamMB
            diskSizeGB       = $Metadata.diskSizeGB
            osVersion        = $Metadata.osVersion
            ipAddress        = $Metadata.ipAddress
            taskSequenceName = $Metadata.taskSequenceName
            collectedAt      = $Metadata.collectedAt
            imageProgress    = $Metadata.imageProgress
            encryptionReady  = $Metadata.encryptionReady
        }

        $json = $ordered | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($FilePath, $json, [System.Text.Encoding]::UTF8)

        Write-Log "Metadata JSON written to: $FilePath" -Level SUCCESS

        return $true
    }
    catch {
        Write-Log "Failed to write metadata to file: $_" -Level ERROR
        $script:ExitCode = 1
        return $false
    }
}

# ============================================================================
#  ENTRY POINT
# ============================================================================

try {
    Write-Log '================================================================'
    Write-Log 'Gather-DeviceMetadata.ps1 - Hospital Imaging Metadata Collector'
    Write-Log '================================================================'
    Write-Log "PowerShell Version: $($PSVersionTable.PSVersion)"
    Write-Log "Running as: $([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)"
    Write-Log "Start time: $(Get-Date -Format 'o')"

    # Resolve output path
    if (-not $OutputPath) {
        $deviceName = if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { 'UNKNOWN' }
        $OutputPath = Join-Path -Path $env:TEMP -ChildPath "DeviceMetadata\$deviceName.json"
        Write-Log "No OutputPath specified. Using default: $OutputPath"
    }

    # Run the collection
    $metadata = Invoke-MetadataCollection

    if ($null -eq $metadata) {
        Write-Log 'Metadata collection returned null. This should not happen.' -Level ERROR
        $script:ExitCode = 1
    }
    else {
        # Write the metadata JSON file
        $writeSuccess = Write-MetadataToFile -Metadata $metadata -FilePath $OutputPath

        if ($writeSuccess) {
            # Write final progress state
            $hostname = if ($metadata.hostname) { $metadata.hostname } else { 'UNKNOWN' }
            Update-ProgressFile -Hostname $hostname -Status 'Collecting Metadata' -Progress 100 -CurrentStep 'Metadata collection complete'

            Write-Log '================================================================'
            Write-Log 'Device metadata collection completed successfully.' -Level SUCCESS
            Write-Log "Output file: $OutputPath"
            Write-Log "Total collection time: $([math]::Round(((Get-Date) - $ScriptStartTime).TotalSeconds, 1)) seconds"
            Write-Log '================================================================'
        }
        else {
            Write-Log 'Failed to write metadata output file.' -Level ERROR
            $script:ExitCode = 1
        }
    }
}
catch {
    Write-Log "Unhandled exception during metadata collection: $_" -Level ERROR
    Write-Log "Stack trace: $($_.ScriptStackTrace)" -Level ERROR
    $script:ExitCode = 1

    # Try to write an error progress state
    try {
        $hostname = if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { 'UNKNOWN' }
        Update-ProgressFile -Hostname $hostname -Status 'Imaging Failed' -Progress 0 -CurrentStep "Error: $_"
    }
    catch {
        # Progress file update failed too - nothing more we can do
    }
}
finally {
    exit $script:ExitCode
}
