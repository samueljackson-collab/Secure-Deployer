# Capacity & Scalability Guide

> **Scope:** This document covers wave sizing recommendations, code-backed resource limits, performance considerations, and scaling paths for the Secure Deployment Runner. It is intended for platform engineers and shift leads planning large-scale deployments.

---

## Code-Backed Limits

These limits are enforced directly in the application code and should be understood before planning deployment waves.

| Resource | Limit | Source | Notes |
|---|---|---|---|
| Run history retained | 10 runs | `services/deploymentService.ts` — `generateRunArchive()` | Oldest run is dropped when the 11th is appended. Export CSVs before archiving. |
| Image Monitor rack slots | 16 slots | `components/ImageRack.tsx` — rack grid layout | Devices beyond slot 16 are not displayed in the rack view. |
| CSV import row limit | Unlimited (parser) | `services/deploymentService.ts` — `parseDevicesFromCsv()` | No hard row cap, but performance degrades beyond ~200 devices in the browser. |
| Max retries per device | Configurable (default: 3) | `state.runner.settings.maxRetries` | Configurable via Advanced Settings without code changes. |
| Retry delay | Configurable (default: 2 s) | `state.runner.settings.retryDelay` | Configurable via Advanced Settings without code changes. |

---

## Wave Sizing Recommendations

### Standard Wave (Recommended)

| Parameter | Recommended Value | Rationale |
|---|---|---|
| Devices per wave | 20–30 | Balances throughput with visibility; operator can monitor status for each device. |
| Concurrent racks | 1–2 | Each rack holds 16 slots; two racks = up to 32 simultaneous imaging devices. |
| Run duration estimate | 45–90 min | Depends on update complexity and network latency. |
| Retries per device | 3 | Handles transient offline events without blocking the queue for too long. |
| Retry delay | 2–5 s | Enough buffer for network recovery; longer delays increase total run time linearly. |

### Large Wave (Advanced)

| Parameter | Recommended Value | Notes |
|---|---|---|
| Devices per wave | 50–100 | Only advisable when network is stable and update payloads are small. |
| Concurrent racks | 2–4 | Requires physical capacity; monitor slot utilization. |
| Retries per device | 2 | Reduce retries to keep queue moving; pull offline devices for manual triage. |
| Retry delay | 1–2 s | Lower delay to speed queue; risk of false-offline on slow-booting devices. |

> **Warning:** Waves above 100 devices in the current sequential scan implementation will have long total run times. See [Scaling Paths](#scaling-paths) for the planned parallelization roadmap.

---

## Performance Characteristics

### Sequential Scan Model (Current)

The current implementation scans devices **sequentially** — one at a time — via `runDeploymentFlow()` in `services/deploymentService.ts`.

**Estimated time per device (mock, default settings):**
- Wake-on-LAN + connect: ~2–4 s
- Compliance checks (BIOS/DCU/Windows/BitLocker/CrowdStrike/SCCM): ~3–6 s
- Total per device: ~5–10 s

**Estimated total run time:**
| Wave Size | Estimated Duration |
|---|---|
| 10 devices | ~1–2 min |
| 30 devices | ~3–5 min |
| 60 devices | ~6–10 min |
| 100 devices | ~10–17 min |

> **Note:** These are mock service estimates. Real-world WinRM connections, PowerShell execution, and network latency will significantly extend these times.

### Browser Memory Considerations

| Device Count | Memory Impact | Notes |
|---|---|---|
| < 50 devices | Negligible | Normal operation. |
| 50–150 devices | Low | Log entries and state accumulation begin to be noticeable. |
| 150–300 devices | Medium | Consider clearing run history and exporting logs periodically. |
| > 300 devices | High | Not recommended in browser/PWA mode without testing. Tauri native mode handles larger state more efficiently. |

---

## Retry Tuning Guide

Retry settings (`maxRetries` and `retryDelay`) are the primary knobs for balancing thoroughness against run duration.

| Scenario | maxRetries | retryDelay | Effect |
|---|---|---|---|
| Stable network, fast devices | 2 | 1 s | Fast queue; low tolerance for transient failures. |
| Standard lab environment | 3 | 2 s | Balanced default. |
| High-latency or unreliable network | 5 | 5 s | Thorough; significantly increases run time for large waves. |
| Post-reboot re-scan | 5 | 10 s | Devices may take time to boot; longer delays prevent false-offline. |

---

## Scaling Paths

### Near-Term: Parallelized Scan Loop (Planned — Sprint +3)

The current sequential scan is a known bottleneck. The planned approach is to introduce a **concurrent scan pool** in `runDeploymentFlow()`:

- Configurable concurrency (e.g., 5 devices in parallel by default)
- Backpressure mechanism to prevent overwhelming the network
- Per-device semaphore to avoid log interleaving

**Expected impact:** 5× throughput improvement for a concurrency of 5; 10× for 10 concurrent scans.

**Files to modify when implementing:**
- `services/deploymentService.ts` — `runDeploymentFlow()` and `validateDevice()`
- `state.runner.settings` — add `concurrency` setting
- `components/BulkActions.tsx` — expose concurrency setting in Advanced Settings

### Medium-Term: Backend Adapter (Planned — Sprint +3)

Replacing the mock service with a real API adapter will shift compute to the server:

- Real WinRM connections execute on the backend (Tauri/Rust or a dedicated server)
- Frontend receives status events via WebSocket or SSE
- Parallelism is managed server-side; frontend just tracks state

### Long-Term: Distributed Scan Agent (Post-Sprint +5)

For enterprise-scale deployments (1,000+ devices):

- Deploy lightweight scan agents per network segment
- Agents report results to a central coordinator
- Frontend subscribes to aggregated status feed
- No changes required to the React UI layer

---

## Monitoring Capacity-Related Signals

| Signal | Source | Alert Threshold | Action |
|---|---|---|---|
| Offline rate | Deployment history / status table | > 10% offline | Investigate network; reduce wave size |
| Run duration | Run archive timestamps | > 2× expected duration | Review retry settings; check for blocked devices |
| Memory/tab slowness | Browser DevTools | Noticeable lag | Clear run history; reduce cohort size; consider Tauri mode |
| Script failure rate | Batch history | > 15% failure | Review script payload; check execution environment |

---

## Related Documents

- [README.md](../README.md) — Full project overview and roadmap
- [docs/PROCESS.md](./PROCESS.md) — End-to-end operator process SOP
- [docs/AUTOMATION.md](./AUTOMATION.md) — PXE automation tiers
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — Technical architecture and state machine
