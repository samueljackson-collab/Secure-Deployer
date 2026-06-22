export interface RiskWarning {
    pattern: string;
    description: string;
    line?: number;
    severity: 'medium' | 'high';
}

export interface ScriptAnalysisResult {
    level: 'low' | 'medium' | 'high';
    warnings: RiskWarning[];
    isValid: boolean;
}

const RISKY_PATTERNS: Array<{ regex: RegExp; pattern: string; description: string; severity: 'medium' | 'high' }> = [
    { regex: /\bRemove-Item\b/i, pattern: 'Remove-Item', description: 'Permanently deletes files or registry keys.', severity: 'high' },
    { regex: /\bStop-Process\b/i, pattern: 'Stop-Process', description: 'Forcibly terminates a running process.', severity: 'high' },
    { regex: /\brm\s+-rf?\b/i, pattern: 'rm -rf', description: 'Recursive force-delete of files and directories.', severity: 'high' },
    { regex: /\bFormat-Volume\b/i, pattern: 'Format-Volume', description: 'Formats a disk volume — irreversible data loss.', severity: 'high' },
    { regex: /\bClear-Disk\b/i, pattern: 'Clear-Disk', description: 'Wipes an entire disk.', severity: 'high' },
    { regex: /\breg\s+delete\b/i, pattern: 'reg delete', description: 'Deletes Windows registry keys.', severity: 'high' },
    { regex: /\bNet\s+user\b.*\/delete\b/i, pattern: 'net user /delete', description: 'Deletes a user account from the system.', severity: 'high' },
    { regex: /\bSet-ItemProperty\b.*\bHKLM\b/i, pattern: 'Set-ItemProperty (HKLM)', description: 'Modifies a system-level registry value.', severity: 'medium' },
    { regex: /\bDisable-WindowsOptionalFeature\b/i, pattern: 'Disable-WindowsOptionalFeature', description: 'Removes a Windows feature permanently.', severity: 'medium' },
    { regex: /\bUninstall-WindowsFeature\b/i, pattern: 'Uninstall-WindowsFeature', description: 'Removes a Windows Server role or feature.', severity: 'medium' },
    { regex: /\bSet-ExecutionPolicy\b.*\b(Unrestricted|Bypass)\b/i, pattern: 'Set-ExecutionPolicy Unrestricted/Bypass', description: 'Removes or bypasses script execution restrictions.', severity: 'medium' },
    { regex: /\bInvoke-Expression\b|\biex\b/i, pattern: 'Invoke-Expression / iex', description: 'Executes arbitrary string as code — potential injection vector.', severity: 'medium' },
    { regex: /\bDownloadString\b|\bDownloadFile\b/i, pattern: 'WebClient Download', description: 'Downloads and potentially executes remote content.', severity: 'medium' },
    { regex: /\bStart-Process\b.*-Verb\s+RunAs\b/i, pattern: 'Start-Process -Verb RunAs', description: 'Launches a process with elevated privileges.', severity: 'medium' },
    { regex: /\bnetsh\s+firewall\b|\bnetsh\s+advfirewall\b/i, pattern: 'netsh firewall', description: 'Modifies Windows Firewall rules.', severity: 'medium' },
];

export function analyzeScriptRisks(content: string): ScriptAnalysisResult {
    if (!content.trim()) {
        return { level: 'low', warnings: [], isValid: false };
    }

    const lines = content.split('\n');
    const warnings: RiskWarning[] = [];

    for (const { regex, pattern, description, severity } of RISKY_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('#')) continue;
            if (regex.test(line)) {
                warnings.push({ pattern, description, line: i, severity });
                break;
            }
        }
    }

    const hasHigh = warnings.some(w => w.severity === 'high');
    const hasMedium = warnings.some(w => w.severity === 'medium');

    return {
        level: hasHigh ? 'high' : hasMedium ? 'medium' : 'low',
        warnings,
        isValid: validateScriptSyntax(content),
    };
}

export function extractRiskyPatterns(content: string): RiskWarning[] {
    return analyzeScriptRisks(content).warnings;
}

export function validateScriptSyntax(content: string): boolean {
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    return openBraces === closeBraces && openParens === closeParens;
}
