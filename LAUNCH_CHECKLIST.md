# Secure Deployer — Production Launch Checklist

**Branch:** `claude/personal-launch-readiness-QHBOl`

## Pre-Launch Setup

- [ ] Node 20+ installed (`node --version`)
- [ ] `npm install`
- [ ] `npm run dev` — app opens at http://localhost:5173
- [ ] No red console errors on startup

> No API key required — the app uses a simulated service layer.

## Feature Verification

| Feature | Steps | Expected Result | Pass/Fail |
|---------|-------|-----------------|----------|
| App loads | Open http://localhost:5173 | Dashboard with neon-green accent, no blank screen | |
| Image Monitor tab | Click "Image Monitor" | Device rack grid renders | |
| Add imaging device | Click "Add Device", fill hostname + MAC | Device card appears | |
| Deployment Runner tab | Click "Deployment Runner" | DeviceStatusTable + CSV upload visible | |
| CSV import | Upload CSV with `Hostname,MAC` columns | Devices populate the runner table | |
| **Script Analysis Modal** | Imaging Script tab → click "Run on All" | ScriptAnalysisModal opens with risk badge | |
| High-risk detection | Paste `Remove-Item -Recurse C:\Windows` → Run | Modal shows **High Risk**, red "Proceed Anyway" | |
| Low-risk pass | Use default diagnostic script → Run | Modal shows **Low Risk**, green "Run Script" | |
| Script execution | Approve from ScriptAnalysisModal | Live Execution Monitor overlay animates | |
| PXE Task Sequence | Click PXE tab | Task sequence viewer renders | |
| Remote Desktop | Click Remote Desktop tab | Remote panel renders | |
| Analytics | Click Analytics tab | Recharts charts render | |
| Templates | Click Templates tab | 3 built-in templates listed | |
| Compliance modal | Click a compliance badge (after scan) | Details modal opens | |
| Credential modal | Click Deploy in runner | Credential input modal appears | |

## Script Analysis Verification

- [ ] `Remove-Item`, `Stop-Process`, `Format-Volume` → **HIGH** risk
- [ ] `Invoke-Expression`, `Set-ExecutionPolicy Unrestricted` → **MEDIUM** risk
- [ ] `echo`, `copy`, `dism` commands → **LOW** risk
- [ ] Unbalanced braces → `validateScriptSyntax()` returns `false`

## Performance

- [ ] App loads < 3s
- [ ] No lag switching between 8 tabs
- [ ] Analytics charts render smoothly
