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
    // Build the PowerShell WinRM remote execution script.
    // Credentials are passed via environment variables (PS_USER / PS_PASS) so they
    // never appear in the script body, command-line arguments, or process listings.
    let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
try {{
    Write-Output "[INFO] Setting up credentials for {target_ip}..."
    $SecPass = ConvertTo-SecureString $env:PS_PASS -AsPlainText -Force
    $Cred = New-Object System.Management.Automation.PSCredential($env:PS_USER, $SecPass)

    Write-Output "[INFO] Establishing PSSession to {target_ip}..."
    $Session = New-PSSession -ComputerName '{target_ip}' -Credential $Cred -ErrorAction Stop

    Write-Output "[INFO] Copying AutoTag scripts from USB ({usb_path}) to remote device..."
    New-Item -ItemType Directory -Path 'C:\Temp\AutoTag' -Force | Out-Null
    Copy-Item -Path '{usb_path}AutoTag\*' -Destination 'C:\Temp\AutoTag\' -ToSession $Session -Recurse -Force

    Write-Output "[INFO] Executing AutoTag.ps1 on {target_ip}..."
    $result = Invoke-Command -Session $Session -ScriptBlock {{
        param($share)
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
        & 'C:\Temp\AutoTag\AutoTag.ps1' -NetworkSharePath $share
    }} -ArgumentList '{network_share}'

    Remove-PSSession $Session
    Write-Output "[SUCCESS] AutoTag completed on {target_ip}."
    Write-Output $result
}} catch {{
    Write-Output "[ERROR] $($_.Exception.Message)"
    exit 1
}}
"#,
        target_ip = target_ip,
        usb_path = usb_path,
        network_share = network_share,
    );

    let output = Command::new("powershell")
        .args(["-NonInteractive", "-NoProfile", "-Command", &script])
        .env("PS_USER", &username)
        .env("PS_PASS", &password)
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
    let script = format!(
        r#"
try {{
    # Load SCCM PowerShell module
    $ModulePath = "$env:SMS_ADMIN_UI_PATH\..\..\..\bin\ConfigurationManager.psd1"
    if (-not (Test-Path $ModulePath)) {{
        $ModulePath = "C:\Program Files (x86)\Microsoft Configuration Manager\AdminConsole\bin\ConfigurationManager.psd1"
    }}
    Import-Module $ModulePath -ErrorAction Stop

    # Connect to SCCM site
    $SiteCode = (Get-PSDrive -PSProvider CMSite).Name | Select-Object -First 1
    Set-Location "$($SiteCode):"

    # Search for device by MAC address
    $NormalizedMac = '{mac}' -replace '[:\-]', ''
    $Device = Get-CMDevice | Where-Object {{
        ($_.MACAddresses -replace '[:\-]', '') -like "*$NormalizedMac*"
    }} | Select-Object -First 1

    if (-not $Device) {{
        Write-Output '{{"found":false,"device_name":null,"images":[],"error":null}}'
        return
    }}

    # Get available boot images
    $Images = Get-CMBootImage | Select-Object @{{n='id';e={{$_.PackageID}}}}, @{{n='name';e={{$_.Name}}}}, @{{n='version';e={{$_.Version}}}}, @{{n='package_id';e={{$_.PackageID}}}}
    $ImagesJson = $Images | ConvertTo-Json -Compress -AsArray

    $Output = [PSCustomObject]@{{
        found = $true
        device_name = $Device.Name
        images = $Images
        error = $null
    }}
    Write-Output ($Output | ConvertTo-Json -Compress)
}} catch {{
    $err = $_.Exception.Message -replace '"', "'"
    Write-Output "{{""found"":false,""device_name"":null,""images"":[],""error"":""$err""}}"
}}
"#,
        mac = device_mac,
    );

    let output = Command::new("powershell")
        .args(["-NonInteractive", "-NoProfile", "-Command", &script])
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
