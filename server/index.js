import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPowerShellScript } from './winrmRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCRIPTS = {
    dcu: path.join(__dirname, 'scripts', 'dcu.ps1'),
    windowsUpdate: path.join(__dirname, 'scripts', 'winupdate.ps1'),
};

const CONCURRENCY = 10;

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/bulk-update', (req, res) => {
    const { targets, credentials, scripts } = req.body || {};

    if (!Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ error: 'No targets provided.' });
    }
    if (!credentials || !credentials.username || !credentials.password) {
        return res.status(400).json({ error: 'Credentials are required.' });
    }
    const scriptKeys = (Array.isArray(scripts) ? scripts : []).filter((s) => SCRIPTS[s]);
    if (scriptKeys.length === 0) {
        return res.status(400).json({ error: 'No valid scripts selected.' });
    }

    const scriptContents = scriptKeys.map((key) => ({
        key,
        content: fs.readFileSync(SCRIPTS[key], 'utf8'),
    }));

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });

    const send = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const { username, password } = credentials;

    let cursor = 0;
    let active = 0;
    let finished = 0;

    const next = () => {
        if (cursor >= targets.length) {
            if (active === 0 && finished === targets.length) {
                send('done', {});
                res.end();
            }
            return;
        }
        const target = targets[cursor++];
        active++;
        runTarget(target).finally(() => {
            active--;
            finished++;
            next();
        });
    };

    const runTarget = async (target) => {
        const host = target.ipAddress || target.hostname || target.host;
        send('status', { target, scriptKey: null, status: 'connecting' });

        for (const { key, content } of scriptContents) {
            send('status', { target, scriptKey: key, status: 'running' });
            try {
                const result = await runPowerShellScript({
                    host,
                    username,
                    password,
                    scriptContent: content,
                });
                const ok = !result.stderr || result.stderr.trim() === '';
                send('status', {
                    target,
                    scriptKey: key,
                    status: ok ? 'success' : 'failed',
                    log: result.stdout,
                    error: ok ? null : result.stderr,
                });
            } catch (err) {
                send('status', {
                    target,
                    scriptKey: key,
                    status: 'failed',
                    log: '',
                    error: err.message || String(err),
                });
            }
        }
    };

    req.on('close', () => {
        // Client disconnected; in-flight WinRM calls will complete and be discarded.
    });

    for (let i = 0; i < CONCURRENCY; i++) next();
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
    console.log(`Bulk update relay listening on port ${PORT}`);
});
