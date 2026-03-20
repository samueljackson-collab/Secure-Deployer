# Secure Deployment Runner — Capacity Analysis and Scalability Guide

> **Scope:** Device queue limits, wave sizing, in-browser performance bounds, code-backed constraints, and the scaling path to production backend integration.

---

## Table of Contents

1. [Current Architecture Constraints](#1-current-architecture-constraints)
2. [Device Queue Limits](#2-device-queue-limits)
3. [Wave Sizing Guidance](#3-wave-sizing-guidance)
4. [Memory and Performance Bounds](#4-memory-and-performance-bounds)
5. [Scan Loop Throughput](#5-scan-loop-throughput)
6. [Image Monitor Capacity](#6-image-monitor-capacity)
7. [Deployment History Retention](#7-deployment-history-retention)
8. [Recommended Operational Profiles](#8-recommended-operational-profiles)
9. [Scaling Path to Production](#9-scaling-path-to-production)
10. [Known Bottlenecks and Mitigations](#10-known-bottlenecks-and-mitigations)

---

## 1. Current Architecture Constraints

The Secure Deployment Runner is currently a **single-page React application** running entirely in the browser. All state is held in memory via `useReducer` in `contexts/AppContext.tsx`. There is no server-side persistence, no background worker, and no parallelism in the scan loop.

This means:

- **State lives in the browser tab.** A page refresh resets the runner queue (run archives are also lost unless exported to CSV before refresh).
- **Scan loop is sequential.** `runDeploymentFlow()` iterates devices in a `for` loop — one device is processed at a time.
- **No hard device cap.** There is no enforced maximum, but practical limits apply based on browser memory and scan time.

---

## 2. Device Queue Limits

### Hard Limits

There are no hard-coded `maxDevices` guards in the current codebase. The reducer will accept any number of devices dispatched via `ADD_DEVICES`.

### Practical Limits

| Context | Practical Maximum | Notes |
|---|---|---|
| CSV import — single file | ~500 rows | Papa Parse streams fine; reducer processes synchronously. Above ~500, initial render may be slow. |
| Runner queue — stable UX | ~100 devices | DeviceStatusTable renders all rows in the DOM. 200+ causes perceptible scroll lag. |
| Runner queue — degraded UX | 100–300 devices | Functional but sluggish. Virtualization not yet implemented. |
| Runner queue — not recommended | > 300 devices | High risk of browser memory pressure and sluggish state updates. Split into waves. |
| Image Monitor — rack grid | 16 slots per rack | `ImageRack.tsx` renders 16-slot grids; additional racks added dynamically. Tested to ~64 concurrent imaging devices. |

### Code Reference

```typescript
// contexts/AppContext.tsx — ADD_DEVICES reducer case
case 'ADD_DEVICES':
  const newDevices = action.payload.filter(
    d => !state.runner.devices.some(existing => existing.macAddress === d.macAddress)
  );
  return { ...state, runner: { ...state.runner, devices: [...state.runner.devices, ...newDevices] } };
```

The deduplication filter runs on every `ADD_DEVICES` dispatch. At 500+ existing devices, this O(N²) filter becomes the first visible performance bottleneck. Mitigation: use a `Map` keyed by MAC for O(1) lookup (planned, Sprint +3).

---

## 3. Wave Sizing Guidance

A **wave** is a subset of the total device cohort processed in a single scan run. Waves reduce queue spikes, isolate failures, and keep the UI responsive.

### Recommended Wave Sizes

| Site / Scenario | Wave Size | Rationale |
|---|---|---|
| Lab / Dev (mock service) | 10–20 | Fast feedback; low risk |
| Office — stable LAN | 20–50 | Standard patch window throughput |
| Large office / campus | 30–75 | Balance between throughput and visibility |
| Remote / unstable WAN | 10–20 | Smaller cohort absorbs higher offline rates |
| Incident recovery | 5–10 | Tight control; maximum visibility per device |

### When to Split a Large Cohort

Split if any of the following are true:
- Total cohort > 100 devices
- Estimated scan time > 2 hours (see [Scan Loop Throughput](#5-scan-loop-throughput))
- Expected offline rate > 10% (high noise — small waves isolate failures faster)
- Mixed status classes in queue (e.g., some devices need BIOS update, others need Windows only)

### Wave Sequencing Pattern

```
Wave 1: 20 devices — initial scan
         → remediate Scan Complete cohort
         → re-scan wave 1
         → archive wave 1

Wave 2: next 20 devices — run in parallel to wave 1 re-scan if operator capacity allows
         → ...

Final wave: verify all waves closed; produce combined shift summary
```

---

## 4. Memory and Performance Bounds

### JavaScript Heap Estimate

| Component | Approx. Memory | Notes |
|---|---|---|
| Base React + Vite app | ~15–25 MB | Bundle size with code splitting |
| AppContext state — 100 devices | ~2–5 MB | `Device` objects + compliance results + logs |
| AppContext state — 500 devices | ~10–20 MB | Scales linearly with log verbosity |
| Log buffer — 10,000 entries | ~5 MB | Each `LogEntry` is a small object; pruning not implemented |
| Run history — 10 runs | ~1–3 MB | `generateRunArchive()` produces compact summaries |
| Recharts analytics render | ~5–10 MB | In-memory chart data; cleared on tab switch |

### Observed UX Thresholds (Mock Service, Chrome 120)

| Device Count | Initial Render | Scan Progress Updates | Bulk Action Dispatch |
|---|---|---|---|
| 10 | Instant | Smooth | Instant |
| 50 | < 100ms | Smooth | < 50ms |
| 100 | ~200ms | Minor lag | ~100ms |
| 250 | ~500ms | Noticeable lag | ~300ms |
| 500 | ~1–2s | Sluggish | ~500ms |

> These figures use the simulated mock service. Real-backend scan dispatches would be event-driven (WebSocket or SSE) and would not exhibit the same sequential update pattern.

### Log Buffer Growth

The log buffer (`state.runner.logs`) grows unbounded during a scan. With verbose logging at 500 devices (multiple log entries per device), the buffer can reach 5,000–10,000 entries. No automatic pruning is currently implemented.

**Mitigation (current):** Click **Clear Logs** between waves.
**Planned:** Auto-prune buffer to last 1,000 entries per run (Sprint +2).

---

## 5. Scan Loop Throughput

`runDeploymentFlow()` processes devices **sequentially** in a `for...of` loop. Each device scan includes simulated delays (mocking real-world WoL + connect + validation latency).

### Time Estimates per Device (Mock Service)

| Scenario | Estimated Time per Device | Source |
|---|---|---|
| Success (all checks pass, no retries) | 5–12 seconds | `sleep()` delays in `validateDevice()` |
| Scan Complete (one check fails) | 8–15 seconds | Same + extra status transitions |
| Offline (retries exhausted) | `maxRetries × retryDelay` + overhead | E.g., 3 retries × 2s = ~10s + overhead |
| Update + reboot cycle | 30–60 seconds additional | `updateDevice()` sleep delays |

### Total Run Time Estimate

```
Estimated run time = devices × avg_per_device_time

Examples:
  20 devices × 10s average = ~3.3 minutes
  50 devices × 10s average = ~8.3 minutes
  100 devices × 12s average = ~20 minutes (with some retries)
```

> **Implication:** Waves > 50 devices in a single run will take 10–20+ minutes to complete. For time-constrained windows, keep waves at 20–30 devices.

### Parallelisation Path (Planned — Sprint +3)

Replacing the sequential `for` loop with a bounded-concurrency parallel runner (e.g., `Promise.all` with a semaphore) would allow N devices to be processed simultaneously. At concurrency=5, a 50-device wave would complete in ~1/5 of the current time.

This requires service layer refactoring — specifically, separating per-device dispatch from the loop control, and ensuring reducer updates are safe under concurrent dispatch. See `docs/AUTOMATION.md` for automation tier context.

---

## 6. Image Monitor Capacity

### Rack Grid

`ImageRack.tsx` renders 16 slots per rack. Racks are added dynamically as devices arrive. There is no enforced rack count limit.

| Devices imaging concurrently | Racks displayed | UX impact |
|---|---|---|
| 1–16 | 1 rack | Ideal |
| 17–32 | 2 racks | Fine |
| 33–64 | 3–4 racks | Scrollable; minor render cost |
| 65–128 | 5–8 racks | Functional; visible DOM size |
| > 128 | 9+ racks | Not recommended; consider staggered intake |

### Polling Interval

Image Monitor simulates a share poll every 30 seconds (`setInterval` in `ImageMonitor.tsx`). This interval is not configurable in the current UI but can be changed in the component source.

For high-throughput environments where devices finish imaging rapidly, reducing the poll to 10–15 seconds improves handoff latency without significant performance impact (the mock poll is a no-op; real backend polling cost depends on share response time).

---

## 7. Deployment History Retention

`state.runner.history` retains the last **10 run archives**. This is enforced in the reducer:

```typescript
// contexts/AppContext.tsx — ARCHIVE_RUN reducer case (simplified)
case 'ARCHIVE_RUN':
  const newHistory = [generateRunArchive(state), ...state.runner.history].slice(0, 10);
  return { ...state, runner: { ...state.runner, history: newHistory } };
```

Beyond 10 runs, the oldest is evicted. **Export run archives to CSV before the session ends** if retention beyond 10 runs is needed.

**Future:** Persist history to `localStorage` or a server-side store (planned, Sprint +3 with backend adapter).

---

## 8. Recommended Operational Profiles

| Profile | Wave Size | Max Retries | Retry Delay | Auto Reboot | Expected Run Time |
|---|---|---|---|---|---|
| Lab / fast feedback | 10–15 | 1 | 1s | Off | ~2–3 min |
| Office — stable LAN | 30–50 | 2–3 | 2s | On | ~8–15 min |
| Large campus | 50–75 | 3 | 2–3s | On | ~15–25 min |
| Remote / WAN | 10–20 | 4–5 | 6–10s | On | ~15–30 min |
| Incident recovery | 5–10 | 5 | 8s | Off | ~10–20 min |

Settings are configurable in **Advanced Settings** (gear icon in Deployment Runner) and stored in `state.runner.settings` without code changes.

---

## 9. Scaling Path to Production

The current mock service is designed with production-aligned contracts. The scaling path follows these phases:

### Phase 1 — Current (Mock / PWA)
- All logic in browser; sequential scan; mock delays; Math.random() outcomes
- Suitable for: operator training, workflow validation, UI prototyping
- Limit: ~100 devices per wave, single operator per session

### Phase 2 — Backend Adapter POC (Sprint +3)
- Replace `services/deploymentService.ts` mock internals with real API calls
- Same TypeScript interfaces; same action dispatch pattern
- Scan loop remains sequential but drives real PowerShell/WinRM
- Limit: bounded by real network latency and WinRM concurrency

### Phase 3 — Parallel Scan + Persistence (Sprint +3–4)
- Bounded-concurrency scan loop (concurrency=5–10)
- State persistence via server-side session or database
- Multi-operator support (shared state via WebSocket broadcast)
- Limit: scales with backend host resources

### Phase 4 — Zero-Touch + Automation (Sprint +5)
- PXE imaging triggers scan automatically on device completion
- No manual transfer step — imaging-to-scan pipeline is event-driven
- See `docs/AUTOMATION.md` for full tier breakdown

---

## 10. Known Bottlenecks and Mitigations

| Bottleneck | Location | Impact | Mitigation |
|---|---|---|---|
| Sequential scan loop | `services/deploymentService.ts:runDeploymentFlow` | Linear time growth with queue size | Parallelise in Sprint +3 |
| O(N²) deduplication filter | `contexts/AppContext.tsx:ADD_DEVICES` | Slow CSV import at 500+ devices | Replace with MAC-keyed Map |
| Unbounded log buffer | `state.runner.logs` | Memory growth during long runs | Auto-prune to 1,000 entries (Sprint +2) |
| No list virtualisation | `components/DeviceStatusTable.tsx` | DOM lag at 200+ devices | Implement windowed list (e.g., react-window) when needed |
| In-memory state only | `contexts/AppContext.tsx` | Page refresh loses all state | Persist to localStorage (Sprint +3) |
| Single-tab operation | Browser | No multi-operator parallel workflow | Server-side session + WebSocket broadcast (Phase 3) |

---

*Document owner: Platform engineer. Update when device cohort sizes or service architecture change. See `README.md` for full documentation index.*
# Capacity & Scalability Guide

> **Scope:** This document covers wave sizing recommendations, code-backed resource limits, performance considerations, and scaling paths for the Secure Deployment Runner. It is intended for platform engineers and shift leads planning large-scale deployments.

---

## Code-Backed Limits

These limits are enforced directly in the application code and should be understood before planning deployment waves.

| Resource | Limit | Source | Notes |
|---|---|---|---|
| Run history retained | 10 runs | `contexts/AppContext.tsx` — history state management | Oldest run is dropped when the 11th is appended. Export CSVs before archiving. |
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
