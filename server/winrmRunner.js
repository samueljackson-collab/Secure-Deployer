import winrm from 'nodejs-winrm';

const DEFAULT_PORT = 5985;

/**
 * Runs a PowerShell script on a remote Windows host over WinRM.
 * Returns the captured stdout/stderr; throws if the shell itself can't be created.
 */
export async function runPowerShellScript({ host, username, password, port, scriptContent }) {
    const encoded = Buffer.from(scriptContent, 'utf16le').toString('base64');
    const command = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;

    const auth = 'Basic ' + Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
    const params = {
        host,
        port: port || DEFAULT_PORT,
        path: '/wsman',
        auth,
    };

const WINRM_TIMEOUT_MS = 120000;
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);

export async function runPowerShellScript({ host, username, password, port, scriptContent }) {
    params.shellId = await withTimeout(winrm.shell.doCreateShell(params), WINRM_TIMEOUT_MS, 'CreateShell');
    try {
        params.command = command;
        params.commandId = await withTimeout(winrm.command.doExecuteCommand(params), WINRM_TIMEOUT_MS, 'ExecuteCommand');
        const result = await withTimeout(winrm.command.doReceiveOutput(params), WINRM_TIMEOUT_MS, 'ReceiveOutput');
        return result;
    } finally {
        await winrm.shell.doDeleteShell(params).catch(() => {});
    }
}
