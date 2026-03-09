
import type { Device } from '../src/types';
import { sleep } from '../utils/helpers';

// --- PowerShell Command Generation ---

/**
 * Builds a simulated PowerShell command string for a given action and device.
 */
export const generatePsCommand = (action: string, device: Device): string => {
    const target = device.hostname || device.mac;
    switch (action) {
        case 'update-bios':
            return `Invoke-Command -ComputerName ${target} -ScriptBlock { & 'C:\\Tools\\BIOSUpdate.exe' /silent /reboot }`;
        case 'update-dcu':
            return `Invoke-Command -ComputerName ${target} -ScriptBlock { & 'C:\\Program Files\\Dell\\CommandUpdate\\dcu-cli.exe' /applyUpdates -silent }`;
        case 'update-windows':
            return `Invoke-Command -ComputerName ${target} -ScriptBlock { Install-WindowsUpdate -AcceptAll -AutoReboot }`;
        case 'reboot':
            return `Restart-Computer -ComputerName ${target} -Force`;
        case 'wake-on-lan':
            return `Send-WakeOnLan -MacAddress '${device.mac}'`;
        case 'validate':
            return `Invoke-Command -ComputerName ${target} -ScriptBlock { Get-ComputerInfo | Select-Object BiosVersion, WindowsVersion, OsVersion }`;
        case 'execute-script':
            return `Invoke-Command -ComputerName ${target} -FilePath '${device.scriptFile?.name ?? 'script.ps1'}'`;
        default:
            return `Invoke-Command -ComputerName ${target} -ScriptBlock { Write-Host "Action: ${action}" }`;
    }
};

// --- PowerShell Execution Simulation ---

export interface PsExecutionResult {
    command: string;
    output: string;
    exitCode: number;
    durationMs: number;
}

/**
 * Simulates async PowerShell remote execution with a realistic delay and output.
 */
export const simulatePsExecution = async (command: string): Promise<PsExecutionResult> => {
    const startTime = Date.now();
    const delayMs = 800 + Math.random() * 1200;
    await sleep(delayMs);

    const success = Math.random() > 0.1;
    const durationMs = Date.now() - startTime;

    if (success) {
        return {
            command,
            output: `[${new Date().toISOString()}] Executed successfully.\nCommand: ${command}\nStatus: OK`,
            exitCode: 0,
            durationMs,
        };
    } else {
        return {
            command,
            output: `[${new Date().toISOString()}] Execution failed.\nCommand: ${command}\nError: Access denied or target unreachable.`,
            exitCode: 1,
            durationMs,
        };
    }
};
