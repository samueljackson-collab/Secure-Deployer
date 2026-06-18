use serde::Serialize;

/// Structured error returned to the frontend over the Tauri IPC boundary.
/// `kind` lets the UI map failures onto the existing `DeploymentStatus` union
/// (Offline, Failed, etc.) without parsing free-text messages.
#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("device unreachable: {0}")]
    Unreachable(String),
    #[error("authentication failed: {0}")]
    AuthFailed(String),
    #[error("operation timed out: {0}")]
    Timeout(String),
    #[error("execution failed (exit code {code}): {message}")]
    ExecutionFailed { code: i32, message: String },
    #[error("failed to parse remote output: {0}")]
    ParseError(String),
}

pub type AppResult<T> = Result<T, AppError>;
