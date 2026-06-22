use crate::error::{AppError, AppResult};
use crate::winrm;
use serde::Deserialize;
use std::time::Duration;
use zeroize::Zeroizing;

#[derive(Debug, Deserialize)]
pub struct RebootCredentials {
    pub username: String,
    pub password: String,
}

const REBOOT_SCRIPT: &str = "Restart-Computer -Force";

/// Issues a forced restart over WinRM. The connection is expected to drop
/// mid-call as the target reboots — `Invoke-Command` surfaces that as an
/// RPC/transport error, which we treat as success rather than failure,
/// since a disconnect here is the expected, desired outcome.
#[tauri::command]
pub async fn reboot_device(host: String, credentials: RebootCredentials) -> AppResult<()> {
    let password = Zeroizing::new(credentials.password);
    let result = tokio::task::spawn_blocking({
        let host = host.clone();
        let username = credentials.username.clone();
        let password = password.clone();
        move || winrm::invoke_remote(&host, &username, &password, REBOOT_SCRIPT, Duration::from_secs(30))
    })
    .await
    .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })?;

    match result {
        Ok(_) => Ok(()),
        Err(AppError::Unreachable(_)) => Ok(()),
        Err(other) => Err(other),
    }
}
