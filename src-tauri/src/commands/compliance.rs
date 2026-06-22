use crate::error::{AppError, AppResult};
use crate::winrm;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use zeroize::Zeroizing;

#[derive(Debug, Deserialize)]
pub struct ComplianceCredentials {
    pub username: String,
    pub password: String,
}

/// One `Invoke-Command` round trip covering every check the old mock
/// `runSingleComplianceCheck` faked with `Math.random()`.
const COMPLIANCE_SCRIPT: &str = r#"
$bitlocker = (Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction SilentlyContinue).ProtectionStatus
$citrix = Get-Service -Name 'CitrixWorkspaceUI', 'Citrix Workspace' -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' -or $_.Status -eq 'Stopped' }
$lapsKey = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft Windows\CurrentVersion\LAPS\Config' -ErrorAction SilentlyContinue
$sccm = (Get-Service -Name ccmexec -ErrorAction SilentlyContinue).Status

[PSCustomObject]@{
    BitlockerPassed = ($bitlocker -eq 1)
    CitrixPassed = [bool]$citrix
    LapsPassed = [bool]$lapsKey
    SccmPassed = ($sccm -eq 'Running')
}
"#;

#[derive(Debug, Deserialize)]
struct RawComplianceOutput {
    bitlocker_passed: bool,
    citrix_passed: bool,
    laps_passed: bool,
    sccm_passed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComplianceCheckItem {
    pub description: String,
    pub expected: String,
    pub passed: bool,
    pub actual: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComplianceCheckResult {
    pub status: String,
    pub details: Vec<ComplianceCheckItem>,
}

fn item(description: &str, passed: bool) -> ComplianceCheckItem {
    ComplianceCheckItem {
        description: description.to_string(),
        expected: "Yes".to_string(),
        passed,
        actual: if passed { "Yes".to_string() } else { "No".to_string() },
    }
}

#[tauri::command]
pub async fn run_compliance_check(host: String, credentials: ComplianceCredentials) -> AppResult<ComplianceCheckResult> {
    let password = Zeroizing::new(credentials.password);
    let raw = tokio::task::spawn_blocking({
        let host = host.clone();
        let username = credentials.username.clone();
        let password = password.clone();
        move || winrm::invoke_remote(&host, &username, &password, COMPLIANCE_SCRIPT, Duration::from_secs(60))
    })
    .await
    .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })??;

    let parsed: RawComplianceOutput = serde_json::from_str(&raw)
        .map_err(|e| AppError::ParseError(format!("{e}: {raw}")))?;

    let details = vec![
        item("Bitlocker Volume Status", parsed.bitlocker_passed),
        item("Citrix Workspace Installed", parsed.citrix_passed),
        item("LAPS Installed", parsed.laps_passed),
        item("SCCM Client Installed & Running", parsed.sccm_passed),
    ];
    let status = if details.iter().all(|d| d.passed) { "Passed" } else { "Failed" };

    Ok(ComplianceCheckResult { status: status.to_string(), details })
}
