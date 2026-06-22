use crate::error::{AppError, AppResult};
use crate::scripts::{DCU_SCRIPT, WIN_UPDATE_SCRIPT};
use crate::winrm;
use serde::Deserialize;
use std::time::Duration;
use zeroize::Zeroizing;

#[derive(Debug, Deserialize)]
pub struct UpdateCredentials {
    pub username: String,
    pub password: String,
}

fn dcu_script_with_bios_password(bios_password: &Option<String>) -> String {
    let bios_arg = match bios_password {
        Some(pw) if !pw.is_empty() => format!("-biosPassword=\"{}\"", pw.replace('"', "`\"")),
        _ => String::new(),
    };
    DCU_SCRIPT.replace("{{BIOS_PASSWORD_ARG}}", &bios_arg)
}

/// Applies pending BIOS/Dell-firmware updates via `dcu-cli.exe /applyUpdates`.
/// The BIOS password (captured once per run in the UI) is substituted into
/// the script body, never passed as a separate argv-visible token.
#[tauri::command]
pub async fn apply_dcu_update(
    host: String,
    credentials: UpdateCredentials,
    bios_password: Option<String>,
) -> AppResult<String> {
    let password = Zeroizing::new(credentials.password);
    let script = dcu_script_with_bios_password(&bios_password);

    tokio::task::spawn_blocking({
        let host = host.clone();
        let username = credentials.username.clone();
        let password = password.clone();
        move || winrm::invoke_remote(&host, &username, &password, &script, Duration::from_secs(900))
    })
    .await
    .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })?
}

/// Installs all available Windows updates via the embedded `winupdate.ps1`
/// (PSWindowsUpdate bootstrap + `Install-WindowsUpdate -IgnoreReboot`).
#[tauri::command]
pub async fn apply_windows_update(host: String, credentials: UpdateCredentials) -> AppResult<String> {
    let password = Zeroizing::new(credentials.password);
    tokio::task::spawn_blocking({
        let host = host.clone();
        let username = credentials.username.clone();
        let password = password.clone();
        move || winrm::invoke_remote(&host, &username, &password, WIN_UPDATE_SCRIPT, Duration::from_secs(1800))
    })
    .await
    .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })?
}
