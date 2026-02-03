/**
 * scriptSafetyAnalyzer.ts
 *
 * DETERMINISTIC, AI-FREE script safety analyzer for hospital network deployments.
 * Analyzes .bat, .cmd, and PowerShell scripts for dangerous patterns that could
 * affect hospital systems beyond targeted devices.
 *
 * Design principles:
 *   - False negatives are WORSE than false positives on a hospital network.
 *   - Every check is purely regex/string-based; no AI or network calls.
 *   - All pattern lists are intentionally broad to catch obfuscation attempts.
 */

import type { ScriptSafetyResult, ScriptFinding, ScopePolicy } from '../types';

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

interface PatternRule {
  /** RegExp tested against each INDIVIDUAL line (case-insensitive). */
  regex: RegExp;
  severity: ScriptFinding['severity'];
  description: string;
  recommendation: string;
}

// ---- BLOCKED (CRITICAL) ---- script will be rejected outright ----

const BLOCKED_PATTERNS: PatternRule[] = [
  // -- shutdown without /t timeout or targeting all machines --
  {
    regex: /shutdown\s+\/[sr](?!.*\/t\s+\d)/i,
    severity: 'BLOCKED',
    description: 'Shutdown/restart command without explicit /t timeout. Could immediately power off hospital systems.',
    recommendation: 'Add an explicit /t timeout value (e.g. shutdown /r /t 60) and target a specific hostname.',
  },
  {
    regex: /shutdown\s+.*\\\\[*]/i,
    severity: 'BLOCKED',
    description: 'Shutdown command targeting wildcard machines. This would affect every reachable host.',
    recommendation: 'Target specific hostnames only. Never use wildcard targets for shutdown.',
  },

  // -- net stop on critical services --
  {
    regex: /net\s+stop\s+(W32Time|WinRM|DNS|DNSCache|Dnscache|DHCP|DHCPServer|Spooler|wuauserv|LanmanServer|LanmanWorkstation|EventLog|TermService|RemoteRegistry|MSSQLSERVER|MSSQL\$|SQLAgent|W3SVC|IISAdmin|CertSvc|NTDS|Netlogon|Kdc)/i,
    severity: 'BLOCKED',
    description: 'Stopping a critical Windows/infrastructure service. This can cripple hospital networking, printing, updates, or domain services.',
    recommendation: 'Do not stop critical infrastructure services via deployment scripts. Use proper change-management procedures.',
  },

  // -- recursive delete on system drives --
  {
    regex: /del\s+\/s\s+\/q\s+[A-Za-z]:\\/i,
    severity: 'BLOCKED',
    description: 'Recursive silent deletion on a system drive root. This will destroy the operating system and all data.',
    recommendation: 'Never perform recursive deletes on drive roots. Target specific subdirectories only.',
  },
  {
    regex: /del\s+\/q\s+\/s\s+[A-Za-z]:\\/i,
    severity: 'BLOCKED',
    description: 'Recursive silent deletion on a system drive root (alternate flag order).',
    recommendation: 'Never perform recursive deletes on drive roots. Target specific subdirectories only.',
  },
  {
    regex: /rd\s+\/s\s+\/q\s+[A-Za-z]:\\/i,
    severity: 'BLOCKED',
    description: 'Recursive silent directory removal on a system drive root.',
    recommendation: 'Never remove drive root directories. Target specific subdirectories only.',
  },
  {
    regex: /rmdir\s+\/s\s+\/q\s+[A-Za-z]:\\/i,
    severity: 'BLOCKED',
    description: 'Recursive silent directory removal on a system drive root.',
    recommendation: 'Never remove drive root directories. Target specific subdirectories only.',
  },
  {
    regex: /Remove-Item\s+.*-Recurse.*[A-Za-z]:\\\s*/i,
    severity: 'BLOCKED',
    description: 'PowerShell recursive removal on a drive root.',
    recommendation: 'Never recursively remove drive roots. Scope removal to specific subdirectories.',
  },

  // -- format commands --
  {
    regex: /\bformat\s+[A-Za-z]:/i,
    severity: 'BLOCKED',
    description: 'Disk format command detected. This will destroy all data on the target volume.',
    recommendation: 'Format commands must never appear in deployment scripts.',
  },

  // -- reg delete on critical HKLM root keys --
  {
    regex: /reg\s+delete\s+HKLM\\SYSTEM(?:\s|$|\\)/i,
    severity: 'BLOCKED',
    description: 'Registry delete on HKLM\\SYSTEM root. This can render Windows unbootable.',
    recommendation: 'Never delete the HKLM\\SYSTEM root key. Target specific subkeys if absolutely necessary.',
  },
  {
    regex: /reg\s+delete\s+HKLM\\SOFTWARE(?:\s|$|\\$)/i,
    severity: 'BLOCKED',
    description: 'Registry delete on HKLM\\SOFTWARE root. This will destroy all installed software configuration.',
    recommendation: 'Never delete the HKLM\\SOFTWARE root key. Target specific subkeys if absolutely necessary.',
  },

  // -- disabling firewall --
  {
    regex: /netsh\s+advfirewall\s+set\s+allprofiles\s+state\s+off/i,
    severity: 'BLOCKED',
    description: 'Disabling Windows Firewall on all profiles. This exposes the host to network attacks.',
    recommendation: 'Never disable the firewall globally. Add specific rules for required traffic instead.',
  },
  {
    regex: /netsh\s+advfirewall\s+set\s+(domainprofile|privateprofile|publicprofile)\s+state\s+off/i,
    severity: 'BLOCKED',
    description: 'Disabling Windows Firewall on a specific profile. This exposes the host to network attacks on that profile.',
    recommendation: 'Never disable the firewall. Add specific firewall rules for required traffic.',
  },
  {
    regex: /Set-NetFirewallProfile\s+.*-Enabled\s+False/i,
    severity: 'BLOCKED',
    description: 'PowerShell command disabling Windows Firewall profile.',
    recommendation: 'Never disable the firewall. Use New-NetFirewallRule for specific exceptions.',
  },

  // -- bcdedit modifications --
  {
    regex: /bcdedit/i,
    severity: 'BLOCKED',
    description: 'Boot Configuration Data edit detected. Incorrect changes can prevent Windows from booting.',
    recommendation: 'BCD modifications must not be performed via deployment scripts. Use proper imaging workflows.',
  },

  // -- diskpart clean --
  {
    regex: /diskpart/i,
    severity: 'BLOCKED',
    description: 'DiskPart utility detected. DiskPart can destroy disk partitions and all data.',
    recommendation: 'DiskPart must never be invoked from deployment scripts. Use proper imaging workflows.',
  },

  // -- subnet-wide / broadcast operations --
  {
    regex: /ping\s+.*\.255/i,
    severity: 'BLOCKED',
    description: 'Pinging a broadcast address (x.x.x.255). This is a subnet-wide broadcast operation.',
    recommendation: 'Do not send broadcast pings. Target specific hosts only.',
  },
  {
    regex: /ping\s+.*255\.255\.255\.255/i,
    severity: 'BLOCKED',
    description: 'Pinging the global broadcast address. This reaches every host on the local network.',
    recommendation: 'Never ping the broadcast address from deployment scripts.',
  },
  {
    regex: /for\s+\/L\s+.*\bping\b/i,
    severity: 'BLOCKED',
    description: 'Loop-based ping sweep detected (for /L ... ping). This scans an entire subnet range.',
    recommendation: 'Do not perform ping sweeps. Target only the specific devices in your deployment list.',
  },
  {
    regex: /1\.\.254.*ping|ping.*1\.\.254/i,
    severity: 'BLOCKED',
    description: 'PowerShell range-based ping sweep (1..254). This scans an entire subnet.',
    recommendation: 'Do not scan subnets. Target specific hostnames from the approved device list.',
  },
  {
    regex: /for\s+.*%.*in\s*\(\s*\d+\s*,\s*1\s*,\s*254\s*\).*ping/i,
    severity: 'BLOCKED',
    description: 'Batch subnet sweep using a for loop with ping.',
    recommendation: 'Do not perform subnet sweeps in deployment scripts.',
  },

  // -- psexec to wildcard --
  {
    regex: /psexec\s+.*\\\\[*]/i,
    severity: 'BLOCKED',
    description: 'PsExec targeting wildcard machines (\\\\*). This will execute on every discoverable host.',
    recommendation: 'Never use wildcard targets with PsExec. Specify exact hostnames.',
  },
  {
    regex: /psexec\s+.*\\\\\*/i,
    severity: 'BLOCKED',
    description: 'PsExec targeting wildcard machines. This will execute on every discoverable host.',
    recommendation: 'Never use wildcard targets with PsExec. Specify exact hostnames.',
  },

  // -- wmic /node:* wildcard --
  {
    regex: /wmic\s+.*\/node:\s*[*"]\*[*"]/i,
    severity: 'BLOCKED',
    description: 'WMIC targeting wildcard node. This will query/modify every discoverable machine.',
    recommendation: 'Specify explicit hostnames with /node. Never use wildcards.',
  },
  {
    regex: /wmic\s+.*\/node:\s*\*/i,
    severity: 'BLOCKED',
    description: 'WMIC targeting wildcard node. This will affect every reachable machine.',
    recommendation: 'Specify explicit hostnames with /node. Never use wildcards.',
  },

  // -- Invoke-Command -ComputerName * wildcard --
  {
    regex: /Invoke-Command\s+.*-ComputerName\s+\*/i,
    severity: 'BLOCKED',
    description: 'Invoke-Command targeting wildcard ComputerName. This will execute on all domain machines.',
    recommendation: 'Specify explicit hostnames with -ComputerName. Never use wildcards.',
  },

  // -- Stop-Service * wildcard --
  {
    regex: /Stop-Service\s+\*/i,
    severity: 'BLOCKED',
    description: 'Stop-Service with wildcard. This will stop ALL services on the machine.',
    recommendation: 'Specify the exact service name. Never use wildcards with Stop-Service.',
  },
  {
    regex: /Stop-Service\s+["']\*["']/i,
    severity: 'BLOCKED',
    description: 'Stop-Service with quoted wildcard. This will stop ALL services on the machine.',
    recommendation: 'Specify the exact service name. Never use wildcards with Stop-Service.',
  },

  // -- Generic wildcard computer targeting --
  {
    regex: /\\\\[*]\s/i,
    severity: 'BLOCKED',
    description: 'UNC path with wildcard target (\\\\*). This targets all network hosts.',
    recommendation: 'Use explicit hostnames in UNC paths. Never use wildcard targets.',
  },
  {
    regex: /-ComputerName\s+["']?\*["']?/i,
    severity: 'BLOCKED',
    description: 'PowerShell -ComputerName parameter with wildcard. This targets all discoverable computers.',
    recommendation: 'Specify explicit hostnames. Never use wildcard computer names.',
  },

  // -- Set-ExecutionPolicy Unrestricted -Force --
  {
    regex: /Set-ExecutionPolicy\s+Unrestricted\s+.*-Force/i,
    severity: 'BLOCKED',
    description: 'Forcing Unrestricted execution policy. This disables all PowerShell script security.',
    recommendation: 'Use RemoteSigned or AllSigned execution policies. Never force Unrestricted.',
  },
  {
    regex: /Set-ExecutionPolicy\s+Bypass\s+.*-Force/i,
    severity: 'BLOCKED',
    description: 'Forcing Bypass execution policy. This completely disables PowerShell script security checks.',
    recommendation: 'Use RemoteSigned or AllSigned execution policies. Never force Bypass.',
  },

  // -- Mass Wake-on-LAN / broadcast WoL --
  {
    regex: /ff[:\-]ff[:\-]ff[:\-]ff[:\-]ff[:\-]ff.*255\.255\.255\.255/i,
    severity: 'BLOCKED',
    description: 'Broadcast Wake-on-LAN magic packet to entire subnet.',
    recommendation: 'Send WoL packets to specific MAC addresses via directed broadcast or unicast only.',
  },
];

// ---- DANGER (HIGH) ---- requires manual override ----

const DANGER_PATTERNS: PatternRule[] = [
  // -- reg add / reg delete on any HKLM key --
  {
    regex: /reg\s+add\s+HKLM/i,
    severity: 'DANGER',
    description: 'Adding a registry key under HKLM. This modifies machine-wide configuration.',
    recommendation: 'Verify the exact key path is necessary. Prefer HKCU modifications when possible.',
  },
  {
    regex: /reg\s+delete\s+HKLM/i,
    severity: 'DANGER',
    description: 'Deleting a registry key under HKLM. This modifies machine-wide configuration.',
    recommendation: 'Verify the exact key path is necessary. Ensure you are not deleting critical subkeys.',
  },

  // -- net stop on any service --
  {
    regex: /net\s+stop\s+\S+/i,
    severity: 'DANGER',
    description: 'Stopping a Windows service. Service disruption can affect hospital workflows.',
    recommendation: 'Verify the service is non-critical and scoped to the target device only.',
  },

  // -- sc config service modifications --
  {
    regex: /sc\s+config\s+/i,
    severity: 'DANGER',
    description: 'Modifying service configuration (startup type, binary path, etc.).',
    recommendation: 'Review the exact service and configuration change carefully. Test on a non-production device.',
  },
  {
    regex: /sc\s+delete\s+/i,
    severity: 'DANGER',
    description: 'Deleting a Windows service registration.',
    recommendation: 'Ensure the service is not required by any hospital application.',
  },

  // -- schtasks /create --
  {
    regex: /schtasks\s+\/create/i,
    severity: 'DANGER',
    description: 'Creating a scheduled task. Persistent scheduled tasks can execute arbitrary commands later.',
    recommendation: 'Review the scheduled task action, trigger, and run-as identity carefully.',
  },
  {
    regex: /Register-ScheduledTask/i,
    severity: 'DANGER',
    description: 'PowerShell scheduled task registration. Persistent tasks execute arbitrary commands later.',
    recommendation: 'Review the task action, trigger, and principal carefully.',
  },

  // -- wmic commands --
  {
    regex: /\bwmic\b/i,
    severity: 'DANGER',
    description: 'WMIC command detected. WMI can query and modify system configuration remotely.',
    recommendation: 'Verify WMIC is scoped to the target device. Prefer modern PowerShell cmdlets.',
  },

  // -- Invoke-WmiMethod --
  {
    regex: /Invoke-WmiMethod/i,
    severity: 'DANGER',
    description: 'PowerShell WMI method invocation. Can execute commands and modify system state remotely.',
    recommendation: 'Ensure the target is explicitly scoped. Review the method and arguments.',
  },
  {
    regex: /Invoke-CimMethod/i,
    severity: 'DANGER',
    description: 'PowerShell CIM method invocation. Can execute commands and modify system state remotely.',
    recommendation: 'Ensure the target is explicitly scoped. Review the method and arguments.',
  },

  // -- PowerShell remoting --
  {
    regex: /Enter-PSSession/i,
    severity: 'DANGER',
    description: 'Interactive PowerShell remote session. Provides full remote shell access to the target.',
    recommendation: 'Ensure the target hostname is in the allowed device list.',
  },
  {
    regex: /Invoke-Command\b/i,
    severity: 'DANGER',
    description: 'PowerShell remote command execution. Runs arbitrary commands on remote machines.',
    recommendation: 'Verify -ComputerName targets only approved devices. Review the script block.',
  },
  {
    regex: /New-PSSession/i,
    severity: 'DANGER',
    description: 'Creating a persistent PowerShell remote session.',
    recommendation: 'Ensure the session target is in the approved device list and sessions are properly closed.',
  },

  // -- Network configuration changes --
  {
    regex: /\bnetsh\b/i,
    severity: 'DANGER',
    description: 'Network shell (netsh) command. Can modify firewall rules, IP configuration, and network settings.',
    recommendation: 'Review the specific netsh context and command carefully.',
  },
  {
    regex: /\broute\s+add\b/i,
    severity: 'DANGER',
    description: 'Adding a network route. This changes network traffic flow on the host.',
    recommendation: 'Verify the route is necessary and does not redirect hospital traffic.',
  },
  {
    regex: /\broute\s+delete\b/i,
    severity: 'DANGER',
    description: 'Deleting a network route. This can break network connectivity.',
    recommendation: 'Verify the route removal will not disrupt hospital network traffic.',
  },

  // -- Group Policy updates --
  {
    regex: /gpupdate\s+\/force/i,
    severity: 'DANGER',
    description: 'Forcing Group Policy update. This can change security settings, mapped drives, and software installations.',
    recommendation: 'Ensure Group Policy changes have been reviewed and approved by the domain admin team.',
  },

  // -- cipher /w (secure wipe) --
  {
    regex: /cipher\s+\/w/i,
    severity: 'DANGER',
    description: 'Secure wiping free disk space. This is a long-running I/O-intensive operation.',
    recommendation: 'Do not run cipher /w during hospital operating hours. It will degrade disk performance.',
  },

  // -- SYSTEM environment variable modification --
  {
    regex: /setx\s+.*\/M/i,
    severity: 'DANGER',
    description: 'Setting a system-level environment variable (setx /M).',
    recommendation: 'Verify the variable does not conflict with hospital applications.',
  },
  {
    regex: /\[Environment\]::SetEnvironmentVariable\s*\(.*Machine/i,
    severity: 'DANGER',
    description: 'PowerShell system-level environment variable modification.',
    recommendation: 'Verify the variable does not conflict with hospital applications.',
  },

  // -- takeown / icacls on system directories --
  {
    regex: /takeown\s+.*[A-Za-z]:\\Windows/i,
    severity: 'DANGER',
    description: 'Taking ownership of Windows system directory files.',
    recommendation: 'Do not take ownership of OS files unless absolutely necessary and approved.',
  },
  {
    regex: /takeown\s+.*[A-Za-z]:\\Program\s*Files/i,
    severity: 'DANGER',
    description: 'Taking ownership of Program Files directory.',
    recommendation: 'Do not modify ownership of Program Files. Use proper installers.',
  },
  {
    regex: /icacls\s+.*[A-Za-z]:\\Windows/i,
    severity: 'DANGER',
    description: 'Modifying ACLs on Windows system directory.',
    recommendation: 'Do not modify system directory ACLs unless absolutely necessary and approved.',
  },
  {
    regex: /icacls\s+.*[A-Za-z]:\\Program\s*Files/i,
    severity: 'DANGER',
    description: 'Modifying ACLs on Program Files directory.',
    recommendation: 'Do not modify Program Files ACLs. Use proper installers.',
  },
  {
    regex: /\btakeown\b/i,
    severity: 'DANGER',
    description: 'File ownership change command detected.',
    recommendation: 'Verify the target path is scoped narrowly and does not affect system files.',
  },
  {
    regex: /\bicacls\b/i,
    severity: 'DANGER',
    description: 'ACL modification command detected.',
    recommendation: 'Verify the target path and permissions are correct and narrowly scoped.',
  },
];

// ---- WARNING (MEDIUM) ---- informational ----

const WARNING_PATTERNS: PatternRule[] = [
  // -- copy to system directories --
  {
    regex: /\bcopy\b.*[A-Za-z]:\\Windows/i,
    severity: 'WARNING',
    description: 'Copying files to the Windows directory.',
    recommendation: 'Verify the destination path. Prefer application-specific directories.',
  },
  {
    regex: /\bxcopy\b.*[A-Za-z]:\\Windows/i,
    severity: 'WARNING',
    description: 'xcopy to the Windows directory.',
    recommendation: 'Verify the destination path. Prefer application-specific directories.',
  },
  {
    regex: /\brobocopy\b.*[A-Za-z]:\\Windows/i,
    severity: 'WARNING',
    description: 'Robocopy to the Windows directory.',
    recommendation: 'Verify the destination path and robocopy flags. Avoid /MIR on system dirs.',
  },
  {
    regex: /\bcopy\b.*[A-Za-z]:\\Program\s*Files/i,
    severity: 'WARNING',
    description: 'Copying files to Program Files.',
    recommendation: 'Use proper installers (MSI/MSIX) instead of manual file copies.',
  },
  {
    regex: /\bxcopy\b.*[A-Za-z]:\\Program\s*Files/i,
    severity: 'WARNING',
    description: 'xcopy to Program Files.',
    recommendation: 'Use proper installers (MSI/MSIX) instead of manual file copies.',
  },
  {
    regex: /\brobocopy\b.*[A-Za-z]:\\Program\s*Files/i,
    severity: 'WARNING',
    description: 'Robocopy to Program Files.',
    recommendation: 'Use proper installers (MSI/MSIX) instead of manual file copies.',
  },
  {
    regex: /Copy-Item\s+.*[A-Za-z]:\\Windows/i,
    severity: 'WARNING',
    description: 'PowerShell Copy-Item to the Windows directory.',
    recommendation: 'Verify the destination path. Prefer application-specific directories.',
  },
  {
    regex: /Copy-Item\s+.*[A-Za-z]:\\Program\s*Files/i,
    severity: 'WARNING',
    description: 'PowerShell Copy-Item to Program Files.',
    recommendation: 'Use proper installers instead of manual file copies.',
  },

  // -- msiexec silent installs --
  {
    regex: /msiexec\s+.*\/(i|x)\s+.*\/q/i,
    severity: 'WARNING',
    description: 'Silent MSI installation/uninstallation.',
    recommendation: 'Verify the MSI package source is trusted and the product is approved.',
  },
  {
    regex: /msiexec/i,
    severity: 'WARNING',
    description: 'MSI installer invocation detected.',
    recommendation: 'Verify the MSI package is from a trusted source.',
  },

  // -- certutil usage --
  {
    regex: /\bcertutil\b/i,
    severity: 'WARNING',
    description: 'CertUtil usage detected. CertUtil can download files, decode payloads, and manage certificates.',
    recommendation: 'Review the specific certutil arguments. Certutil -urlcache is often used for file download.',
  },

  // -- ping (reconnaissance) --
  {
    regex: /\bping\b/i,
    severity: 'WARNING',
    description: 'Ping command detected. Could be used for network reconnaissance.',
    recommendation: 'Verify the ping target is in the approved device list.',
  },

  // -- taskkill --
  {
    regex: /\btaskkill\b/i,
    severity: 'WARNING',
    description: 'Process termination command detected.',
    recommendation: 'Verify the target process. Avoid killing system-critical processes.',
  },
  {
    regex: /Stop-Process/i,
    severity: 'WARNING',
    description: 'PowerShell process termination detected.',
    recommendation: 'Verify the target process. Avoid killing system-critical processes.',
  },

  // -- net use (drive mapping) --
  {
    regex: /\bnet\s+use\b/i,
    severity: 'WARNING',
    description: 'Network drive mapping or disconnection.',
    recommendation: 'Verify the share path and credentials are appropriate.',
  },

  // -- PowerShell download cradles --
  {
    regex: /Invoke-WebRequest/i,
    severity: 'WARNING',
    description: 'PowerShell web download detected.',
    recommendation: 'Verify the download URL is a trusted internal source.',
  },
  {
    regex: /Invoke-RestMethod/i,
    severity: 'WARNING',
    description: 'PowerShell REST API call detected.',
    recommendation: 'Verify the endpoint URL is a trusted internal source.',
  },
  {
    regex: /\bwget\b/i,
    severity: 'WARNING',
    description: 'wget download detected (PowerShell alias or external tool).',
    recommendation: 'Verify the download URL is a trusted internal source.',
  },
  {
    regex: /\bcurl\b/i,
    severity: 'WARNING',
    description: 'curl download detected.',
    recommendation: 'Verify the URL is a trusted internal source.',
  },
  {
    regex: /Start-BitsTransfer/i,
    severity: 'WARNING',
    description: 'BITS file transfer detected.',
    recommendation: 'Verify the source URL is a trusted internal location.',
  },
  {
    regex: /DownloadString|DownloadFile|WebClient/i,
    severity: 'WARNING',
    description: '.NET web download method detected.',
    recommendation: 'Verify the download URL is a trusted internal source.',
  },
];

// ---------------------------------------------------------------------------
// Scope violation detection
// ---------------------------------------------------------------------------

/**
 * Extracts hostnames referenced in the script via UNC paths (\\HOSTNAME\...),
 * -ComputerName parameters, /node: parameters, and other common patterns.
 */
function extractReferencedHostnames(scriptContent: string): string[] {
  const hostnames = new Set<string>();

  // UNC paths: \\HOSTNAME or \\HOSTNAME\share
  const uncPattern = /\\\\([A-Za-z0-9_\-]+)(?:\\|\/|\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = uncPattern.exec(scriptContent)) !== null) {
    const name = match[1];
    // Skip wildcards and common non-hostname tokens
    if (name !== '*' && name.length > 1) {
      hostnames.add(name.toUpperCase());
    }
  }

  // -ComputerName HOSTNAME or -ComputerName "HOSTNAME"
  const cnPattern = /-ComputerName\s+["']?([A-Za-z0-9_\-]+)["']?/gi;
  while ((match = cnPattern.exec(scriptContent)) !== null) {
    const name = match[1];
    if (name !== '*') {
      hostnames.add(name.toUpperCase());
    }
  }

  // /node:HOSTNAME or /node:"HOSTNAME"
  const nodePattern = /\/node:\s*["']?([A-Za-z0-9_\-]+)["']?/gi;
  while ((match = nodePattern.exec(scriptContent)) !== null) {
    const name = match[1];
    if (name !== '*') {
      hostnames.add(name.toUpperCase());
    }
  }

  // psexec \\HOSTNAME
  const psexecPattern = /psexec\s+.*\\\\([A-Za-z0-9_\-]+)/gi;
  while ((match = psexecPattern.exec(scriptContent)) !== null) {
    const name = match[1];
    if (name !== '*') {
      hostnames.add(name.toUpperCase());
    }
  }

  // shutdown /m \\HOSTNAME
  const shutdownPattern = /shutdown\s+.*\/m\s+\\\\([A-Za-z0-9_\-]+)/gi;
  while ((match = shutdownPattern.exec(scriptContent)) !== null) {
    const name = match[1];
    if (name !== '*') {
      hostnames.add(name.toUpperCase());
    }
  }

  return Array.from(hostnames);
}

/**
 * Detects subnet/range targeting patterns in the script.
 */
function detectSubnetTargeting(line: string, lineNumber: number): ScriptFinding[] {
  const findings: ScriptFinding[] = [];

  // CIDR notation (e.g. 10.0.0.0/24)
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}/.test(line)) {
    findings.push({
      line: lineNumber,
      pattern: 'CIDR notation',
      severity: 'DANGER',
      description: 'CIDR subnet notation detected. This may target an entire network range.',
      recommendation: 'Use explicit hostnames instead of subnet ranges.',
    });
  }

  // IP range patterns (e.g. 10.0.0.1-254 or 10.0.0.*)
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*-\s*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(line)) {
    findings.push({
      line: lineNumber,
      pattern: 'IP range',
      severity: 'DANGER',
      description: 'IP address range detected. This targets multiple hosts.',
      recommendation: 'Use explicit hostnames from the approved device list.',
    });
  }

  // Wildcard IP (e.g. 10.0.0.*)
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\*/.test(line)) {
    findings.push({
      line: lineNumber,
      pattern: 'Wildcard IP',
      severity: 'BLOCKED',
      description: 'Wildcard IP address detected (x.x.x.*). This targets an entire subnet.',
      recommendation: 'Use explicit hostnames from the approved device list.',
    });
  }

  // Broadcast addresses
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.255/.test(line)) {
    findings.push({
      line: lineNumber,
      pattern: 'Broadcast address',
      severity: 'BLOCKED',
      description: 'Broadcast address detected (x.x.x.255). This reaches every host on the subnet.',
      recommendation: 'Target specific hosts only. Never use broadcast addresses.',
    });
  }

  // PowerShell range operator for subnets (e.g. 1..254)
  if (/\d+\.\.\d+/.test(line) && /\d{1,3}\.\d{1,3}\.\d{1,3}/.test(line)) {
    findings.push({
      line: lineNumber,
      pattern: 'PowerShell range sweep',
      severity: 'BLOCKED',
      description: 'PowerShell range operator combined with IP address. Likely a subnet sweep.',
      recommendation: 'Do not perform subnet sweeps. Use the approved device list.',
    });
  }

  return findings;
}

/**
 * Checks for wildcard computer targeting beyond the BLOCKED patterns.
 */
function detectWildcardTargeting(line: string, lineNumber: number): ScriptFinding[] {
  const findings: ScriptFinding[] = [];

  // Get-ADComputer -Filter * (Active Directory wildcard query)
  if (/Get-ADComputer\s+.*-Filter\s+['"]*\*/i.test(line)) {
    findings.push({
      line: lineNumber,
      pattern: 'AD wildcard query',
      severity: 'DANGER',
      description: 'Active Directory wildcard computer query. This retrieves ALL domain computers.',
      recommendation: 'Filter AD queries to specific OUs or hostname patterns.',
    });
  }

  // ForEach-Object with network operations
  if (/Get-ADComputer.*ForEach/i.test(line) || /Get-ADComputer[\s\S]*\|/i.test(line)) {
    findings.push({
      line: lineNumber,
      pattern: 'AD computer pipeline',
      severity: 'WARNING',
      description: 'Active Directory computer query piped to another command.',
      recommendation: 'Ensure the AD query is filtered to only approved devices.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Helper: determine if a line is a comment
// ---------------------------------------------------------------------------

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  // Batch/CMD comments: REM or ::
  if (/^(REM\s|::)/i.test(trimmed)) {
    return true;
  }
  // PowerShell comments: #
  if (trimmed.startsWith('#')) {
    return true;
  }
  // Block comment markers (simplified - does not track state across lines)
  if (trimmed.startsWith('<#') || trimmed.startsWith('#>')) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Severity hierarchy helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<ScriptFinding['severity'], number> = {
  INFO: 0,
  WARNING: 1,
  DANGER: 2,
  BLOCKED: 3,
};

function worstSeverity(
  a: ScriptFinding['severity'],
  b: ScriptFinding['severity'],
): ScriptFinding['severity'] {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

function severityToRiskLevel(severity: ScriptFinding['severity']): ScriptSafetyResult['riskLevel'] {
  switch (severity) {
    case 'BLOCKED':
      return 'CRITICAL';
    case 'DANGER':
      return 'HIGH';
    case 'WARNING':
      return 'MEDIUM';
    case 'INFO':
    default:
      return 'LOW';
  }
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Analyzes a .bat, .cmd, or PowerShell script for dangerous patterns that could
 * affect hospital systems beyond the targeted devices.
 *
 * This is DETERMINISTIC and AI-FREE. It uses only regex pattern matching.
 *
 * @param scriptContent  The raw text content of the script.
 * @param scopePolicy  The scope policy defining allowed operations and targets.
 * @returns A ScriptSafetyResult with all findings, risk level, and safety determination.
 */
export function analyzeScript(
  scriptContent: string,
  scopePolicy: ScopePolicy | null,
): ScriptSafetyResult {
  const findings: ScriptFinding[] = [];
  const blockedPatterns: string[] = [];
  const scopeViolations: string[] = [];

  const allowedHostnames = scopePolicy?.allowedHostnames || [];
  const normalizedAllowed = new Set(allowedHostnames.map((h) => h.toUpperCase().trim()));

  const lines = scriptContent.split(/\r?\n/);

  // Track the worst severity found across all lines
  let overallWorstSeverity: ScriptFinding['severity'] = 'INFO';

  // Track whether we are inside a PowerShell block comment
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1; // 1-indexed for human readability
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed.length === 0) {
      continue;
    }

    // Track PowerShell block comments (<# ... #>)
    if (/<#/.test(trimmed) && !/#>/.test(trimmed)) {
      inBlockComment = true;
      continue;
    }
    if (/#>/.test(trimmed)) {
      inBlockComment = false;
      continue;
    }
    if (inBlockComment) {
      continue;
    }

    // Skip single-line comments
    if (isCommentLine(trimmed)) {
      continue;
    }

    // --- Check BLOCKED patterns ---
    for (const rule of BLOCKED_PATTERNS) {
      if (rule.regex.test(line)) {
        const finding: ScriptFinding = {
          line: lineNumber,
          pattern: rule.regex.source,
          severity: rule.severity,
          description: rule.description,
          recommendation: rule.recommendation,
        };
        findings.push(finding);
        blockedPatterns.push(`Line ${lineNumber}: ${rule.description}`);
        overallWorstSeverity = worstSeverity(overallWorstSeverity, rule.severity);
      }
    }

    // --- Check DANGER patterns ---
    for (const rule of DANGER_PATTERNS) {
      if (rule.regex.test(line)) {
        // Avoid duplicate findings if a BLOCKED rule already matched this exact description
        const alreadyBlocked = findings.some(
          (f) => f.line === lineNumber && f.severity === 'BLOCKED' && f.description === rule.description,
        );
        if (!alreadyBlocked) {
          const finding: ScriptFinding = {
            line: lineNumber,
            pattern: rule.regex.source,
            severity: rule.severity,
            description: rule.description,
            recommendation: rule.recommendation,
          };
          findings.push(finding);
          overallWorstSeverity = worstSeverity(overallWorstSeverity, rule.severity);
        }
      }
    }

    // --- Check WARNING patterns ---
    for (const rule of WARNING_PATTERNS) {
      if (rule.regex.test(line)) {
        const finding: ScriptFinding = {
          line: lineNumber,
          pattern: rule.regex.source,
          severity: rule.severity,
          description: rule.description,
          recommendation: rule.recommendation,
        };
        findings.push(finding);
        overallWorstSeverity = worstSeverity(overallWorstSeverity, rule.severity);
      }
    }

    // --- Subnet/range targeting ---
    const subnetFindings = detectSubnetTargeting(line, lineNumber);
    for (const sf of subnetFindings) {
      findings.push(sf);
      scopeViolations.push(`Line ${lineNumber}: ${sf.description}`);
      overallWorstSeverity = worstSeverity(overallWorstSeverity, sf.severity);
      if (sf.severity === 'BLOCKED') {
        blockedPatterns.push(`Line ${lineNumber}: ${sf.description}`);
      }
    }

    // --- Wildcard targeting ---
    const wildcardFindings = detectWildcardTargeting(line, lineNumber);
    for (const wf of wildcardFindings) {
      findings.push(wf);
      scopeViolations.push(`Line ${lineNumber}: ${wf.description}`);
      overallWorstSeverity = worstSeverity(overallWorstSeverity, wf.severity);
    }
  }

  // --- Enforce scope policy restrictions ---
  if (scopePolicy) {
    // Check for broadcast commands if blocked by policy
    if (scopePolicy.blockBroadcastCommands) {
      const broadcastPatterns = [
        /ping\s+.*\.255/i,
        /ping\s+.*255\.255\.255\.255/i,
        /for\s+\/L\s+.*\bping\b/i,
        /1\.\.254.*ping|ping.*1\.\.254/i,
      ];
      
      const broadcastLines = scriptContent.split(/\r?\n/).filter((line, idx) => 
        broadcastPatterns.some(pattern => pattern.test(line))
      );
      
      if (broadcastLines.length > 0) {
        const violation = 'Scope policy blocks broadcast commands, but script contains broadcast operations.';
        scopeViolations.push(violation);
        blockedPatterns.push(violation);
        findings.push({
          line: 0,
          pattern: 'blockBroadcastCommands policy',
          severity: 'BLOCKED',
          description: violation,
          recommendation: 'Remove all broadcast operations (ping .255, etc.) or disable the blockBroadcastCommands policy.',
        });
        overallWorstSeverity = 'BLOCKED';
      }
    }

    // Check for subnet-wide operations if blocked by policy
    if (scopePolicy.blockSubnetWideOperations) {
      const subnetPatterns = [
        /for\s+\/L\s+.*\bping\b/i,
        /1\.\.254/i,
        /wmic\s+.*\/node:\s*[*"]\*[*"]/i,
        /Invoke-Command\s+.*-ComputerName\s+\*/i,
        /\\\\[*]/i,
      ];
      
      const subnetLines = scriptContent.split(/\r?\n/).filter((line, idx) => 
        subnetPatterns.some(pattern => pattern.test(line))
      );
      
      if (subnetLines.length > 0) {
        const violation = 'Scope policy blocks subnet-wide operations, but script contains subnet scanning or wildcard targeting.';
        scopeViolations.push(violation);
        blockedPatterns.push(violation);
        findings.push({
          line: 0,
          pattern: 'blockSubnetWideOperations policy',
          severity: 'BLOCKED',
          description: violation,
          recommendation: 'Remove all subnet-wide operations (ping sweeps, wildcards, etc.) or disable the blockSubnetWideOperations policy.',
        });
        overallWorstSeverity = 'BLOCKED';
      }
    }

    // Check for registry writes if blocked by policy
    if (scopePolicy.blockRegistryWrites) {
      const registryWritePatterns = [
        /reg\s+add\s+HKLM\\SYSTEM/i,
        /Set-ItemProperty\s+.*HKLM:\\SYSTEM/i,
        /New-ItemProperty\s+.*HKLM:\\SYSTEM/i,
        /reg\s+add\s+HKEY_LOCAL_MACHINE\\SYSTEM/i,
      ];
      
      const registryLines = scriptContent.split(/\r?\n/).filter((line, idx) => 
        registryWritePatterns.some(pattern => pattern.test(line))
      );
      
      if (registryLines.length > 0) {
        const violation = 'Scope policy blocks registry writes to HKLM\\SYSTEM, but script contains such operations.';
        scopeViolations.push(violation);
        blockedPatterns.push(violation);
        findings.push({
          line: 0,
          pattern: 'blockRegistryWrites policy',
          severity: 'BLOCKED',
          description: violation,
          recommendation: 'Remove all HKLM\\SYSTEM registry write operations or disable the blockRegistryWrites policy.',
        });
        overallWorstSeverity = 'BLOCKED';
      }
    }

    // Check for service stops if blocked by policy
    if (scopePolicy.blockServiceStops) {
      const serviceStopPatterns = [
        /net\s+stop\s+/i,
        /Stop-Service\s+/i,
        /sc\s+stop\s+/i,
      ];
      
      const serviceStopLines = scriptContent.split(/\r?\n/).filter((line, idx) => 
        serviceStopPatterns.some(pattern => pattern.test(line))
      );
      
      if (serviceStopLines.length > 0) {
        const violation = 'Scope policy blocks service stops, but script contains service stop commands.';
        scopeViolations.push(violation);
        blockedPatterns.push(violation);
        findings.push({
          line: 0,
          pattern: 'blockServiceStops policy',
          severity: 'BLOCKED',
          description: violation,
          recommendation: 'Remove all service stop commands (net stop, Stop-Service, etc.) or disable the blockServiceStops policy.',
        });
        overallWorstSeverity = 'BLOCKED';
      }
    }
  }

  // --- Scope violation: hostnames not in allowed list ---
  const referencedHostnames = extractReferencedHostnames(scriptContent);
  for (const hostname of referencedHostnames) {
    if (!normalizedAllowed.has(hostname)) {
      const violation = `Hostname "${hostname}" is referenced in the script but is NOT in the allowed device list.`;
      scopeViolations.push(violation);
      findings.push({
        line: 0, // Cannot reliably attribute to a single line; appears in scope violations
        pattern: 'hostname scope check',
        severity: 'DANGER',
        description: violation,
        recommendation: `Add "${hostname}" to the allowed device list or remove references to it from the script.`,
      });
      overallWorstSeverity = worstSeverity(overallWorstSeverity, 'DANGER');
    }
  }

  // --- Determine overall safety ---
  const hasBlocked = blockedPatterns.length > 0;
  const isSafe = !hasBlocked;
  const riskLevel = severityToRiskLevel(overallWorstSeverity);

  // --- Build summary ---
  const summary = buildSummary(findings, blockedPatterns, scopeViolations, isSafe, riskLevel);

  return {
    isSafe,
    riskLevel,
    findings,
    summary,
    blockedPatterns,
    scopeViolations,
  };
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(
  findings: ScriptFinding[],
  blockedPatterns: string[],
  scopeViolations: string[],
  isSafe: boolean,
  riskLevel: ScriptSafetyResult['riskLevel'],
): string {
  const blockedCount = findings.filter((f) => f.severity === 'BLOCKED').length;
  const dangerCount = findings.filter((f) => f.severity === 'DANGER').length;
  const warningCount = findings.filter((f) => f.severity === 'WARNING').length;

  const parts: string[] = [];

  if (findings.length === 0) {
    parts.push('No dangerous patterns detected. Script appears safe for deployment.');
    return parts.join(' ');
  }

  parts.push(`Script analysis complete. Risk level: ${riskLevel}.`);
  parts.push(`Found ${findings.length} finding(s): ${blockedCount} blocked, ${dangerCount} danger, ${warningCount} warning.`);

  if (!isSafe) {
    parts.push(`DEPLOYMENT BLOCKED: ${blockedPatterns.length} pattern(s) must be resolved before this script can be deployed to hospital systems.`);
  }

  if (scopeViolations.length > 0) {
    parts.push(`SCOPE VIOLATIONS: ${scopeViolations.length} scope issue(s) detected. The script may affect devices outside the approved target list.`);
  }

  if (dangerCount > 0 && isSafe) {
    parts.push('Manual review and override required for DANGER-level findings before deployment.');
  }

  return parts.join(' ');
}
