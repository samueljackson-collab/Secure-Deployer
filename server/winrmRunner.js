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

    params.shellId = await winrm.shell.doCreateShell(params);
    try {
        params.command = command;
        params.commandId = await winrm.command.doExecuteCommand(params);
        const result = await winrm.command.doReceiveOutput(params);
        return result;
    } finally {
        await winrm.shell.doDeleteShell(params).catch(() => {});
    }
}
