use crate::error::{AppError, AppResult};
use crate::winrm;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use zeroize::Zeroizing;

#[derive(Debug, Deserialize)]
pub struct FileOpCredentials {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FileOperation {
    Run,
    Install,
    Delete,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOpResult {
    pub output: String,
}

/// All staged files live under one well-known directory on the target so
/// `run`/`install`/`delete` can address them by name alone, mirroring the
/// "available files on the target" concept the old mock simulated with an
/// in-memory `Set`.
const STAGING_DIR: &str = r"C:\ProgramData\SecureDeployer\Staged";

fn run_script(file_name: &str) -> String {
    format!(
        r#"
$path = Join-Path '{dir}' '{name}'
if (-not (Test-Path $path)) {{ throw "File not found on target: $path" }}
Start-Process -FilePath $path -Wait
Write-Output "Ran $path"
"#,
        dir = STAGING_DIR,
        name = file_name.replace('\'', "''"),
    )
}

fn install_script(file_name: &str) -> String {
    format!(
        r#"
$path = Join-Path '{dir}' '{name}'
if (-not (Test-Path $path)) {{ throw "File not found on target: $path" }}
if ($path -like '*.msi') {{
    Start-Process msiexec.exe -ArgumentList "/i `"$path`" /qn /norestart" -Wait
}} else {{
    Start-Process -FilePath $path -ArgumentList '/S' -Wait
}}
Write-Output "Installed $path"
"#,
        dir = STAGING_DIR,
        name = file_name.replace('\'', "''"),
    )
}

fn delete_script(file_name: &str) -> String {
    format!(
        r#"
$path = Join-Path '{dir}' '{name}'
if (-not (Test-Path $path)) {{ throw "File not found on target: $path" }}
Remove-Item -Path $path -Force
Write-Output "Deleted $path"
"#,
        dir = STAGING_DIR,
        name = file_name.replace('\'', "''"),
    )
}

/// Stages `file_bytes` (the file picked in the UI) under `STAGING_DIR` on
/// the target before `run`/`install`, chunked as base64 through the same
/// `Invoke-Command` channel everything else uses — no SMB admin-share
/// dependency, so this works even when the target's file-sharing ports are
/// firewalled but WinRM is reachable.
fn stage_script(file_name: &str, file_base64: &str) -> String {
    format!(
        r#"
New-Item -ItemType Directory -Path '{dir}' -Force | Out-Null
$bytes = [Convert]::FromBase64String('{b64}')
[IO.File]::WriteAllBytes((Join-Path '{dir}' '{name}'), $bytes)
"#,
        dir = STAGING_DIR,
        name = file_name.replace('\'', "''"),
        b64 = file_base64,
    )
}

#[tauri::command]
pub async fn run_remote_file_op(
    host: String,
    credentials: FileOpCredentials,
    operation: FileOperation,
    file_name: String,
    file_base64: Option<String>,
) -> AppResult<FileOpResult> {
    let password = Zeroizing::new(credentials.password);
    let username = credentials.username;

    if matches!(operation, FileOperation::Run | FileOperation::Install) {
        let bytes = file_base64.ok_or_else(|| AppError::ParseError("file content missing for stage step".to_string()))?;
        let stage = stage_script(&file_name, &bytes);
        tokio::task::spawn_blocking({
            let host = host.clone();
            let username = username.clone();
            let password = password.clone();
            move || winrm::invoke_remote(&host, &username, &password, &stage, Duration::from_secs(120))
        })
        .await
        .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })??;
    }

    let action_script = match operation {
        FileOperation::Run => run_script(&file_name),
        FileOperation::Install => install_script(&file_name),
        FileOperation::Delete => delete_script(&file_name),
    };

    let output = tokio::task::spawn_blocking({
        let host = host.clone();
        let username = username.clone();
        let password = password.clone();
        move || winrm::invoke_remote(&host, &username, &password, &action_script, Duration::from_secs(600))
    })
    .await
    .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })??;

    Ok(FileOpResult { output })
}
