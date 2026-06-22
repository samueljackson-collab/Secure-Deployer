# Windows Update - install all available updates without forcing a reboot.
if (-not (Get-Module -ListAvailable -Name PSWindowsUpdate)) {
    Write-Output "Installing PSWindowsUpdate module..."
    Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force | Out-Null
    Install-Module -Name PSWindowsUpdate -Force -Confirm:$false -Scope AllUsers
}

Import-Module PSWindowsUpdate

Write-Output "Scanning for Windows updates..."
$updates = Get-WindowsUpdate -AcceptAll

if (-not $updates) {
    Write-Output "No updates available."
    exit 0
}

Write-Output "Installing updates (no auto-reboot)..."
Install-WindowsUpdate -AcceptAll -IgnoreReboot -Confirm:$false | ForEach-Object { Write-Output $_.Title }

Write-Output "Windows Update completed."
exit 0
