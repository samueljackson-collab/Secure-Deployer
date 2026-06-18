# Dell Command | Update - silent scan and apply
$dcu = "C:\Program Files\Dell\CommandUpdate\dcu-cli.exe"
if (-not (Test-Path $dcu)) {
    $dcu = "C:\Program Files (x86)\Dell\CommandUpdate\dcu-cli.exe"
}
if (-not (Test-Path $dcu)) {
    Write-Output "ERROR: Dell Command | Update CLI not found on this device."
    exit 1
}

Write-Output "Scanning for Dell updates..."
& $dcu /scan -outputLog="C:\Windows\Temp\dcu-scan.log"

Write-Output "Applying available updates (reboot disabled)..."
& $dcu /applyUpdates -reboot=disable -outputLog="C:\Windows\Temp\dcu-apply.log"

Write-Output "Dell Command | Update completed with exit code $LASTEXITCODE"
exit $LASTEXITCODE
