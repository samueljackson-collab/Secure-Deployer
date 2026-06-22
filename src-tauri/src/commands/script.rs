use crate::error::AppResult;
use crate::winrm;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use zeroize::Zeroizing;

#[derive(Debug, Deserialize)]
pub struct ScriptCredentials {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptOutcome {
    pub output: String,
}

/// Known WinRM/PowerShell error substrings mapped to operator-facing
/// remediation tips. Matched against real PowerShell error text once an
/// `execute_adhoc_script` call fails, replacing the old random canned-error
/// mock with a lookup against what the target actually reported.
const TROUBLESHOOTING_KB: &[(&str, &str)] = &[
    (
        "access is denied",
        "Verify that the provided credentials have administrative privileges on the target device. Check if WinRM is configured to allow remote connections.",
    ),
    (
        "is not recognized as the name of a cmdlet",
        "Ensure the required PowerShell module is installed on the target device before running this script.",
    ),
    (
        "the winrm client cannot process the request",
        "Check if the target device is online, on the same network, and has the WinRM service running. Verify firewall rules allow port 5985/5986.",
    ),
    (
        "the rpc server is unavailable",
        "The target device did not respond. Confirm it is powered on, network-reachable, and that WinRM is enabled (winrm quickconfig).",
    ),
];

pub fn troubleshooting_for(message: &str) -> Option<&'static str> {
    let lowered = message.to_lowercase();
    TROUBLESHOOTING_KB
        .iter()
        .find(|(needle, _)| lowered.contains(needle))
        .map(|(_, tip)| *tip)
}

/// Runs a user-supplied ad hoc script against `host` via the same
/// `Invoke-Command` primitive used everywhere else (`winrm::invoke_remote`
/// already passes the script body through as a `ScriptBlock`, so no
/// separate temp-file staging is needed for plain script text).
#[tauri::command]
pub async fn execute_adhoc_script(
    host: String,
    credentials: ScriptCredentials,
    script_body: String,
) -> AppResult<ScriptOutcome> {
    let password = Zeroizing::new(credentials.password);
    let result = tokio::task::spawn_blocking({
        let host = host.clone();
        let username = credentials.username.clone();
        let password = password.clone();
        move || winrm::invoke_remote(&host, &username, &password, &script_body, Duration::from_secs(300))
    })
    .await
    .map_err(|e| crate::error::AppError::ExecutionFailed { code: -1, message: e.to_string() })?;

    use crate::error::AppError;
    let with_tip = |message: String| {
        match troubleshooting_for(&message) {
            Some(tip) => format!("{message} Tip: {tip}"),
            None => message,
        }
    };

    match result {
        Ok(output) => Ok(ScriptOutcome { output }),
        Err(AppError::ExecutionFailed { code, message }) => {
            Err(AppError::ExecutionFailed { code, message: with_tip(message) })
        }
        Err(AppError::Unreachable(message)) => Err(AppError::Unreachable(with_tip(message))),
        Err(AppError::AuthFailed(message)) => Err(AppError::AuthFailed(with_tip(message))),
        Err(other) => Err(other),
    }
}
