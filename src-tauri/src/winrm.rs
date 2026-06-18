use crate::error::{AppError, AppResult};
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::Duration;
use zeroize::Zeroizing;

/// Runs a PowerShell scriptblock against `host` over WinRM using
/// `Invoke-Command`, returning stdout as a string.
///
/// We deliberately shell out to the system `powershell.exe` rather than
/// reimplement the WinRM/WS-Man SOAP protocol in Rust: this inherits
/// Windows' own Kerberos/NTLM transport encryption defaults for free,
/// which is strictly more secure than a from-scratch SOAP client that
/// would otherwise default to unencrypted Basic auth.
///
/// The username and password are written to the child process's stdin
/// rather than passed as command-line arguments, so they never appear
/// in `argv` (and therefore never show up in process listings, crash
/// dumps, or shell history).
pub fn invoke_remote(
    host: &str,
    username: &str,
    password: &Zeroizing<String>,
    remote_script: &str,
    _timeout: Duration,
) -> AppResult<String> {
    // Build the host-side wrapper script. The remote scriptblock is passed
    // through as a literal here-string; it never touches argv either.
    let wrapper = format!(
        r#"
$ErrorActionPreference = 'Stop'
$plainPassword = [Console]::In.ReadLine()
$securePassword = ConvertTo-SecureString -String $plainPassword -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential('{username}', $securePassword)
$scriptBlock = {{
{remote_script}
}}
try {{
    $result = Invoke-Command -ComputerName '{host}' -Credential $cred -ScriptBlock $scriptBlock -ErrorAction Stop
    $result | ConvertTo-Json -Depth 6 -Compress
}} catch {{
    Write-Error $_.Exception.Message
    exit 1
}}
"#,
        username = username.replace('\'', "''"),
        host = host.replace('\'', "''"),
        remote_script = remote_script,
    );

    let mut child = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::ExecutionFailed { code: -1, message: format!("failed to launch powershell.exe: {e}") })?;

    {
        let stdin = child.stdin.as_mut().expect("stdin was piped");
        stdin
            .write_all(wrapper.as_bytes())
            .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })?;
        stdin
            .write_all(b"\n")
            .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })?;
        stdin
            .write_all(password.as_bytes())
            .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })?;
        stdin
            .write_all(b"\n")
            .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| AppError::ExecutionFailed { code: -1, message: e.to_string() })?;

    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let lowered = stderr.to_lowercase();
        if lowered.contains("access is denied") || lowered.contains("logon failure") {
            return Err(AppError::AuthFailed(stderr.trim().to_string()));
        }
        if lowered.contains("cannot be resolved")
            || lowered.contains("the rpc server is unavailable")
            || lowered.contains("the client cannot connect")
            || lowered.contains("winrm cannot complete the operation")
        {
            return Err(AppError::Unreachable(stderr.trim().to_string()));
        }
        return Err(AppError::ExecutionFailed {
            code: output.status.code().unwrap_or(-1),
            message: stderr.trim().to_string(),
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// `timeout` is currently advisory; `std::process::Command` has no native
/// timeout, so callers needing a hard cap should wrap this call with
/// `tokio::time::timeout` from an async context.
#[allow(dead_code)]
pub fn default_timeout() -> Duration {
    Duration::from_secs(30)
}
