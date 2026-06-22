use crate::error::AppError;
use crate::scripts::{DCU_SCRIPT, WIN_UPDATE_SCRIPT};
use crate::winrm;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Semaphore;
use zeroize::Zeroizing;

/// Devices are addressed by whichever of hostname/IP is present; WinRM
/// connects to `ip_address` when given, otherwise `hostname`.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkTarget {
    pub hostname: String,
    pub ip_address: Option<String>,
}

impl BulkTarget {
    fn host(&self) -> &str {
        self.ip_address.as_deref().filter(|s| !s.is_empty()).unwrap_or(&self.hostname)
    }
}

#[derive(Debug, Deserialize)]
pub struct BulkCredentials {
    pub username: String,
    pub password: String,
    /// Captured once per batch in the UI and reused for every device's DCU
    /// run below — never re-prompted per target.
    pub bios_password: Option<String>,
}

/// Mirrors the `{ target, scriptKey, status, log, error }` shape the old
/// SSE relay emitted, so `BulkUpdate.tsx`'s existing progress reducer
/// needs no changes beyond swapping its event source.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BulkStatusEvent {
    target: BulkTarget,
    script_key: String,
    status: &'static str,
    log: Option<String>,
    error: Option<String>,
}

const CONCURRENCY: usize = 10;

fn script_for(key: &str, bios_password: &Option<Zeroizing<String>>) -> Option<String> {
    match key {
        "dcu" => {
            let bios_arg = match bios_password {
                Some(pw) if !pw.is_empty() => format!("-biosPassword=\"{}\"", pw.replace('"', "`\"")),
                _ => String::new(),
            };
            Some(DCU_SCRIPT.replace("{{BIOS_PASSWORD_ARG}}", &bios_arg))
        }
        "windowsUpdate" => Some(WIN_UPDATE_SCRIPT.to_string()),
        _ => None,
    }
}

#[tauri::command]
pub async fn bulk_update(
    app: AppHandle,
    targets: Vec<BulkTarget>,
    credentials: BulkCredentials,
    scripts: Vec<String>,
) -> Result<(), AppError> {
    let username = Arc::new(credentials.username);
    let password = Arc::new(Zeroizing::new(credentials.password));
    let bios_password = Arc::new(credentials.bios_password.map(Zeroizing::new));
    let semaphore = Arc::new(Semaphore::new(CONCURRENCY));

    let mut handles = Vec::new();

    for target in targets {
        for script_key in &scripts {
            let Some(script_body) = script_for(script_key, &bios_password) else { continue };

            let app = app.clone();
            let target = target.clone();
            let script_key = script_key.clone();
            let username = Arc::clone(&username);
            let password = Arc::clone(&password);
            let semaphore = Arc::clone(&semaphore);

            handles.push(tokio::spawn(async move {
                let _permit = semaphore.acquire().await.expect("semaphore not closed");

                let emit = |status: &'static str, log: Option<String>, error: Option<String>| {
                    let _ = app.emit(
                        "bulk-update-status",
                        BulkStatusEvent { target: target.clone(), script_key: script_key.clone(), status, log, error },
                    );
                };

                emit("connecting", None, None);

                let host = target.host().to_string();
                emit("running", None, None);
                let result = tokio::task::spawn_blocking({
                    let username = (*username).clone();
                    let password = Zeroizing::new((**password).clone());
                    let host = host.clone();
                    move || winrm::invoke_remote(&host, &username, &password, &script_body, Duration::from_secs(900))
                })
                .await
                .expect("blocking task did not panic");

                match result {
                    Ok(output) => emit("success", Some(output), None),
                    Err(e) => emit("failed", None, Some(e.to_string())),
                }
            }));
        }
    }

    for handle in handles {
        let _ = handle.await;
    }

    Ok(())
}
