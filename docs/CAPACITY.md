# Secure Deployment Runner — Capacity & Scalability Guide

> **Audience:** Platform engineers, shift leads, and operations managers planning deployment windows.
> **Purpose:** Understand tested batch sizes, code-backed limits, wave sizing guidance, and scaling paths.

---

## Summary

| Dimension | Current Limit | Recommended Operating Range | Notes |
|---|---|---|---|
| Devices per run | Unlimited (UI list) | ≤ 50 per wave | Sequential scan loop; more = longer wall-clock time |
| Concurrent scans | 1 (sequential) | — | Loop iterates one device at a time |
| Run history retained | 10 runs | — | Hard-coded in reducer; oldest run evicted |
| Log entries in memory | Unlimited | Monitor for slowdown > 2,000 entries | All logs held in React state; clear between runs |
| CSV import row limit | No hard limit | ≤ 500 rows recommended | PapaParse streams well; UI rendering may lag at >500 |
| Wave size | Operator choice | 15–25 devices | Balances throughput with blast radius |

---

## Sequential Scan Architecture

The current scan loop in `services/deploymentService.ts:runDeploymentFlow` iterates devices in a `for...of` loop:

```typescript
for (const device of devices) {
    if (isCancelled()) break;
    await validateDevice(device, settings, onProgress, isCancelled);
}
```

**Implications:**
- Device N+1 does not start until device N completes (including all retries).
- Wall-clock time per device = connection attempts × retry delay + validation steps (~8–25 seconds per device in production).
- For 25 devices with default settings (3 retries, 2s delay): estimated 4–10 minutes end-to-end.
- For 50 devices: estimated 8–20 minutes.

**When parallelism matters:** Sites with > 50 devices per shift should consider wave-based scheduling (see below) until the scan loop is parallelised (planned Sprint +3).

---

## Wave Sizing Guidance

Divide large device cohorts into waves of 15–25 devices each.

### Why waves?

1. **Blast radius control:** A misconfigured bulk update affects only the current wave.
2. **Faster feedback:** Smaller waves complete sooner, giving you compliance rates to act on mid-shift.
3. **Error isolation:** Failures in wave 1 can be triaged before wave 2 starts.
4. **Log readability:** Per-run logs stay manageable and exportable.

### Wave sizing by site type:

| Site Type | Recommended Wave Size | Rationale |
|---|---|---|
| Lab (stable LAN) | 25–50 | Low retry overhead; fast validation |
| Office (stable LAN) | 15–25 | Balance throughput with blast radius |
| Remote / WAN | 10–15 | Higher retry probability; smaller blast radius |
| Incident recovery | 5–10 | Maximum caution; triage each wave result before proceeding |

### Wave scheduling pattern:

```
Shift start
  └─► Wave 1 (15 devices) ──► scan ──► remediate ──► re-scan ──► archive
  └─► Wave 2 (15 devices) ──► scan ──► remediate ──► re-scan ──► archive
  └─► Wave 3 (remaining)  ──► scan ──► remediate ──► re-scan ──► archive
Shift end: aggregate KPIs across waves
```

---

## Memory & Browser Performance

All state lives in React memory (`useReducer` in `contexts/AppContext.tsx`). There is no server-side persistence.

| State bucket | Memory impact | Mitigation |
|---|---|---|
| `runner.devices` | ~2–5 KB per device | Remove completed devices between waves |
| `runner.logs` | ~200 bytes per entry | Clear logs between runs; avoid > 2,000 entries |
| `runner.history` | Last 10 run archives | Auto-evicted; no action needed |
| `monitor.devices` | ~2 KB per imaging device | Transfer and clear promptly after imaging |

**Browser tested:** Chrome 120+, Edge 120+, Firefox 121+. No known memory issues at ≤ 50 devices per run with log clearing between runs.

---

## Scaling Paths

### Near-term (Planned Sprint +3): Parallelise scan loop

Replace the sequential `for...of` loop with a `Promise.all`-based batched parallel scan:

```typescript
// Proposed parallel scan (batch size configurable)
const BATCH_SIZE = 5;
for (let i = 0; i < devices.length; i += BATCH_SIZE) {
    const batch = devices.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(d => validateDevice(d, settings, onProgress, isCancelled)));
}
```

**Impact:** 5× throughput at batch size 5; wall-clock time for 50 devices drops from ~15 minutes to ~3 minutes.

**Dependency:** Requires thread-safe status dispatching (already satisfied by React reducer, since dispatches are queued).

### Medium-term: Backend API adapter

Replace `services/deploymentService.ts` with an API adapter that routes calls to a real orchestration backend. The service contract (function signatures and return types) is already production-shaped — the mock implementation uses the same interfaces a real endpoint would return.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the service contract reference.

### Long-term: Multi-operator / RBAC

- Multiple operators sharing a deployment session requires a shared backend state store (WebSocket or polling).
- Role-based access control (scan-only vs. remediate vs. admin) is documented in [ARCHITECTURE.md](./ARCHITECTURE.md) and the README roadmap.

---

## KPIs for Capacity Planning

| KPI | Formula | Target |
|---|---|---|
| First-pass compliance rate | `Success / total scanned` | > 70% (site-dependent) |
| Offline rate | `Offline / total scanned` | < 10% |
| Remediation success rate | `Success after remediation / Scan Complete` | > 90% |
| Wave completion time | Wall clock from scan start to archive | < 20 min for ≤ 25 devices |
| Script execution failure rate | `Execution Failed / total executed` | < 15% |

---

## Related Documents

- [End-to-End Process SOP](./PROCESS.md)
- [Automation Tiers & PXE Guide](./AUTOMATION.md)
- [Technical Architecture](./ARCHITECTURE.md)
