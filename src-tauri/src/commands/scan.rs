use crate::error::{AppError, AppResult};
use crate::winrm;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use zeroize::Zeroizing;

#[derive(Debug, Deserialize)]
pub struct ScanCredentials {
    pub username: String,
    pub password: String,
}

/// Mirrors the subset of `types.ts`'s `Device` fields that a read-only
/// scan can populate. Kept separate from the full `Device` type so the
/// Rust side only needs to know about scan-relevant fields.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub encryption_status: String,
    pub model: String,
    pub serial_number: String,
    pub asset_tag: String,
    pub bios_version: String,
    pub is_bios_up_to_date: bool,
    pub dcu_version: String,
    pub is_dcu_up_to_date: bool,
    pub win_version: String,
    pub is_win_up_to_date: bool,
    pub crowdstrike_status: String,
    pub sccm_status: String,
}

/// Read-only PowerShell scriptblock executed on the target via
/// `Invoke-Command`. Single round trip; gathers BIOS/DCU/Windows version,
/// BitLocker, CrowdStrike, and SCCM client state, then emits one JSON
/// object so the Rust side does a single deserialize.
const SCAN_SCRIPT: &str = r#"
$bios = Get-CimInstance -ClassName Win32_BIOS
$cs = Get-CimInstance -ClassName Win32_ComputerSystem
$os = Get-CimInstance -ClassName Win32_OperatingSystem
$bitlocker = (Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction SilentlyContinue).ProtectionStatus
$dcuVersion = (Get-Item "C:\Program Files (x86)\Dell\CommandUpdate\dcu-cli.exe" -ErrorAction SilentlyContinue).VersionInfo.ProductVersion
$crowdstrike = (Get-Service -Name CSFalconService -ErrorAction SilentlyContinue).Status
$sccm = (Get-Service -Name ccmexec -ErrorAction SilentlyContinue).Status

[PSCustomObject]@{
    EncryptionStatus = if ($bitlocker -eq 1) { 'Enabled' } else { 'Disabled' }
    Model = $cs.Model
    SerialNumber = $bios.SerialNumber
    AssetTag = (Get-CimInstance -ClassName Win32_SystemEnclosure -ErrorAction SilentlyContinue).SMBIOSAssetTag
    BiosVersion = $bios.SMBIOSBIOSVersion
    DcuVersion = $dcuVersion
    WinVersion = $os.Version
    CrowdstrikeStatus = if ($crowdstrike -eq 'Running') { 'Running' } else { 'Not Found' }
    SccmStatus = if ($sccm -eq 'Running') { 'Healthy' } else { 'Unhealthy' }
}
"#;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct RawScanOutput {
    encryption_status: String,
    model: Option<String>,
    serial_number: Option<String>,
    asset_tag: Option<String>,
    bios_version: Option<String>,
    dcu_version: Option<String>,
    win_version: Option<String>,
    crowdstrike_status: String,
    sccm_status: String,
}

/// Compares a discovered version string against a target. Versions are
/// treated as up-to-date when they exactly match (the targets in
/// `App.tsx` are pinned strings, not ranges), and "unknown" (missing)
/// values are treated as not up to date so they surface for review
/// rather than silently passing.
fn is_up_to_date(actual: &Option<String>, target: &str) -> bool {
    actual.as_deref().map(|v| v == target).unwrap_or(false)
}

#[tauri::command]
pub async fn scan_device(
    host: String,
    credentials: ScanCredentials,
    target_bios_version: String,
    target_dcu_version: String,
    target_win_version: String,
) -> AppResult<ScanResult> {
    let password = Zeroizing::new(credentials.password);
    let raw = tokio::task::spawn_blocking({
        let host = host.clone();
        let username = credentials.username.clone();
        let password = password.clone();
        move || winrm::invoke_remote(&host, &username, &password, SCAN_SCRIPT, Duration::from_secs(30))
    })
    .await
    .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })??;

    let parsed: RawScanOutput = serde_json::from_str(&raw)
        .map_err(|e| AppError::ParseError(format!("{e}: {raw}")))?;

    let is_bios_up_to_date = is_up_to_date(&parsed.bios_version, &target_bios_version);
    let is_dcu_up_to_date = is_up_to_date(&parsed.dcu_version, &target_dcu_version);
    let is_win_up_to_date = is_up_to_date(&parsed.win_version, &target_win_version);

    Ok(ScanResult {
        encryption_status: parsed.encryption_status,
        model: parsed.model.unwrap_or_default(),
        serial_number: parsed.serial_number.unwrap_or_default(),
        asset_tag: parsed.asset_tag.unwrap_or_default(),
        bios_version: parsed.bios_version.unwrap_or_else(|| "Unknown".to_string()),
        is_bios_up_to_date,
        dcu_version: parsed.dcu_version.unwrap_or_else(|| "Not Installed".to_string()),
        is_dcu_up_to_date,
        win_version: parsed.win_version.unwrap_or_else(|| "Unknown".to_string()),
        is_win_up_to_date,
        crowdstrike_status: parsed.crowdstrike_status,
        sccm_status: parsed.sccm_status,
    })
}
