use std::process::Command;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct BootImage {
    pub id: String,
    pub name: String,
    pub version: String,
    pub package_id: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SccmQueryResult {
    pub found: bool,
    pub device_name: Option<String>,
    pub images: Vec<BootImage>,
    pub error: Option<String>,
}

/// Detect removable USB drives on the system.
/// On Windows, uses wmic to list drive type 2 (removable).
/// Returns a list of drive paths like ["D:\\", "E:\\"].
#[tauri::command]
pub fn detect_usb_drives() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("wmic")
            .args(["logicaldisk", "where", "drivetype=2", "get", "deviceid", "/format:csv"])
            .output();

        match output {
            Ok(o) => {
                String::from_utf8_lossy(&o.stdout)
                    .lines()
                    .filter(|l| l.contains(':') && !l.to_lowercase().contains("deviceid"))
                    .map(|l| {
                        let drive = l.split(',').last().unwrap_or("").trim();
                        format!("{}\\", drive)
                    })
                    .filter(|s| s.len() > 1)
                    .collect()
            }
            Err(_) => vec![],
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On Linux/macOS, list /media and /mnt mount points
        let mut drives = vec![];
        for base in &["/media", "/mnt", "/Volumes"] {
            if let Ok(entries) = std::fs::read_dir(base) {
                for entry in entries.flatten() {
                    drives.push(entry.path().to_string_lossy().to_string() + "/");
                }
            }
        }
        drives
    }
}

/// Validate an IP address or hostname: only allow alphanumeric, dots, hyphens, and brackets for IPv6.
/// Colons are only permitted inside IPv6 bracket notation (e.g. [::1]), not in plain hostnames.
fn validate_host(host: &str) -> Result<(), String> {
    if host.is_empty() || host.len() > 253 {
        return Err("Invalid host: must be 1–253 characters".to_string());
    }
    let is_ipv6 = host.starts_with('[') && host.ends_with(']');
    if is_ipv6 {
        // Inside brackets: allow hex digits, colons, and dots (IPv6 with embedded IPv4)
        let inner = &host[1..host.len() - 1];
        if !inner.chars().all(|c| c.is_ascii_hexdigit() || c == ':' || c == '.') {
            return Err("Invalid IPv6 address: contains disallowed characters".to_string());
        }
    } else {
        // Plain hostname or IPv4: alphanumeric, dots, hyphens only — no colons
        if !host.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
            return Err("Invalid host: contains disallowed characters".to_string());
        }
    }
    Ok(())
}

/// Validate a Windows file-system path for safe use as a PowerShell argument.
/// Rejects any string that contains shell metacharacters. Mirrors the TypeScript
/// validateWindowsPath() helper in utils/security.ts.
fn validate_windows_path(path: &str) -> Result<(), String> {
    const SHELL_METACHARACTERS: &[char] = &[
        ';', '&', '|', '`', '$', '(', ')', '{', '}', '<', '>', '\'', '"', '\n', '\r',
    ];
    if let Some(ch) = path.chars().find(|c| SHELL_METACHARACTERS.contains(c)) {
        return Err(format!("Path contains a disallowed character: {:?}", ch));
    }
    Ok(())
}

/// Validate a MAC address: only allow hex digits, colons, and hyphens.
fn validate_mac(mac: &str) -> Result<(), String> {
    if mac.is_empty() || mac.len() > 17 {
        return Err("Invalid MAC address format".to_string());
    }
    if !mac.chars().all(|c| c.is_ascii_hexdigit() || c == ':' || c == '-') {
        return Err("Invalid MAC address: contains disallowed characters".to_string());
    }
    Ok(())
}

/// Execute AutoTag on a remote device via PowerShell WinRM.
/// Copies the AutoTag scripts from the USB path, then runs them on the target.
/// Returns the combined stdout output.
#[tauri::command]
pub async fn execute_powershell_remote(
    target_ip: String,
    username: String,
    password: String,
    usb_path: String,
    network_share: String,
) -> Result<String, String> {
    validate_host(&target_ip)?;
    validate_windows_path(&usb_path)?;
    validate_windows_path(&network_share)?;

    // All variable user inputs are passed via environment variables so they
    // never appear in the script body, command-line arguments, or process listings.
    let script = r#"
$ErrorActionPreference = 'Stop'
try {
    $TargetIp    = $env:PS_TARGET_IP
    $UsbPath     = $env:PS_USB_PATH
    $NetworkShare = $env:PS_NETWORK_SHARE

    Write-Output "[INFO] Setting up credentials for $TargetIp..."
    $SecPass = ConvertTo-SecureString $env:PS_PASS -AsPlainText -Force
    $Cred = New-Object System.Management.Automation.PSCredential($env:PS_USER, $SecPass)

    Write-Output "[INFO] Establishing PSSession to $TargetIp..."
    $Session = New-PSSession -ComputerName $TargetIp -Credential $Cred -ErrorAction Stop

    Write-Output "[INFO] Copying AutoTag scripts from USB ($UsbPath) to remote device..."
    New-Item -ItemType Directory -Path 'C:\Temp\AutoTag' -Force | Out-Null
    Copy-Item -Path "${UsbPath}AutoTag\*" -Destination 'C:\Temp\AutoTag\' -ToSession $Session -Recurse -Force

    Write-Output "[INFO] Executing AutoTag.ps1 on $TargetIp..."
    $result = Invoke-Command -Session $Session -ScriptBlock {
        param($share)
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
        & 'C:\Temp\AutoTag\AutoTag.ps1' -NetworkSharePath $share
    } -ArgumentList $NetworkShare

    Remove-PSSession $Session
    Write-Output "[SUCCESS] AutoTag completed on $TargetIp."
    Write-Output $result
} catch {
    Write-Output "[ERROR] $($_.Exception.Message)"
    exit 1
}
"#;

    let output = Command::new("powershell")
        .args(["-NonInteractive", "-NoProfile", "-Command", script])
        .env("PS_USER", &username)
        .env("PS_PASS", &password)
        .env("PS_TARGET_IP", &target_ip)
        .env("PS_USB_PATH", &usb_path)
        .env("PS_NETWORK_SHARE", &network_share)
        .output()
        .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() || stdout.contains("[SUCCESS]") {
        Ok(stdout)
    } else {
        Err(format!("{}{}",
            if stdout.is_empty() { String::new() } else { stdout + "\n" },
            stderr
        ))
    }
}

/// Query SCCM for available boot images for a device identified by MAC address.
/// Requires the ConfigMgr PowerShell module to be installed on the operator's machine.
#[tauri::command]
pub async fn query_sccm_boot_images(
    sccm_server: String,
    device_mac: String,
) -> Result<SccmQueryResult, String> {
    validate_mac(&device_mac)?;
    validate_host(&sccm_server)?;

    // MAC address is passed via environment variable to prevent script injection.
    let script = r#"
try {
    # Load SCCM PowerShell module
    $ModulePath = "$env:SMS_ADMIN_UI_PATH\..\..\..\bin\ConfigurationManager.psd1"
    if (-not (Test-Path $ModulePath)) {
        $ModulePath = "C:\Program Files (x86)\Microsoft Configuration Manager\AdminConsole\bin\ConfigurationManager.psd1"
    }
    Import-Module $ModulePath -ErrorAction Stop

    # Connect to SCCM site
    $SiteCode = (Get-PSDrive -PSProvider CMSite).Name | Select-Object -First 1
    Set-Location "$($SiteCode):"

    # Search for device by MAC address (read from env to avoid injection)
    $NormalizedMac = $env:PS_DEVICE_MAC -replace '[:\-]', ''
    $Device = Get-CMDevice | Where-Object {
        ($_.MACAddresses -replace '[:\-]', '') -like "*$NormalizedMac*"
    } | Select-Object -First 1

    if (-not $Device) {
        Write-Output '{"found":false,"device_name":null,"images":[],"error":null}'
        return
    }

    # Get available boot images
    $Images = Get-CMBootImage | Select-Object @{n='id';e={$_.PackageID}}, @{n='name';e={$_.Name}}, @{n='version';e={$_.Version}}, @{n='package_id';e={$_.PackageID}}

    $Output = [PSCustomObject]@{
        found = $true
        device_name = $Device.Name
        images = $Images
        error = $null
    }
    Write-Output ($Output | ConvertTo-Json -Compress)
} catch {
    $err = $_.Exception.Message -replace '"', "'"
    Write-Output "{""found"":false,""device_name"":null,""images"":[],""error"":""$err""}"
}
"#;

    let output = Command::new("powershell")
        .args(["-NonInteractive", "-NoProfile", "-Command", script])
        .env("PS_DEVICE_MAC", &device_mac)
        .output()
        .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout)
        .trim()
        .to_string();

    serde_json::from_str::<SccmQueryResult>(&stdout)
        .map_err(|e| format!("Failed to parse SCCM response: {}. Raw output: {}", e, &stdout[..stdout.len().min(500)]))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            detect_usb_drives,
            execute_powershell_remote,
            query_sccm_boot_images,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
