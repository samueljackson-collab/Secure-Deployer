# Secure Deployment Runner — Capacity & Scalability Guide

> **Question answered here:** Can this do 20 devices? 50? As many as you want?
>
> **Short answer:** 20 is routine. 50 is workable in waves. 100+ requires infrastructure changes.
> "Unlimited" is not realistic for a single person in a single browser tab without staged waves
> and backend support. This document explains exactly why, with references to the code that creates
> each limit.

---

## Table of Contents

1. [The Three Axes of Capacity](#1-the-three-axes-of-capacity)
2. [Capacity by Wave Size — Practical Table](#2-capacity-by-wave-size--practical-table)
3. [Code-Backed Limits — What Actually Constrains the System](#3-code-backed-limits--what-actually-constrains-the-system)
4. [Scan Loop Throughput — Sequential vs Parallel](#4-scan-loop-throughput--sequential-vs-parallel)
5. [Update Throughput — Why Bulk Update Is Faster](#5-update-throughput--why-bulk-update-is-faster)
6. [Memory and UI Constraints (Browser)](#6-memory-and-ui-constraints-browser)
7. [History and Archiving Limits](#7-history-and-archiving-limits)
8. [How to Scale — Step-by-Step Paths](#8-how-to-scale--step-by-step-paths)
9. [Multi-Tech Scaling](#9-multi-tech-scaling)
10. [Capacity Summary at a Glance](#10-capacity-summary-at-a-glance)

---

## 1. The Three Axes of Capacity

Capacity in Secure Deployment Runner has three distinct dimensions. Confusing them leads to
wrong answers. All three must be evaluated together.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THREE AXES OF CAPACITY                           │
│                                                                     │
│  AXIS 1: LOGIC THROUGHPUT                                           │
│  How fast can the service layer process devices?                    │
│  Determined by: scan loop design, retry settings, network latency   │
│                                                                     │
│  AXIS 2: UI PERFORMANCE                                             │
│  How many devices can the browser render without degrading?         │
│  Determined by: React render cycles, Recharts chart data, DOM size  │
│                                                                     │
│  AXIS 3: HUMAN CAPACITY                                             │
│  How many devices can one operator manage safely and correctly?     │
│  Determined by: wave discipline, attention, error rate tolerance    │
└─────────────────────────────────────────────────────────────────────┘
```

Each axis has a different limit. The practical capacity is bounded by the tightest axis for your
specific situation.

---

## 2. Capacity by Wave Size — Practical Table

| Wave Size | Logic Throughput | UI Performance | Human Management | Overall Risk | Recommended For |
|---|---|---|---|---|---|
| 1–5 devices | Instant | No impact | Very easy | Very Low | Initial testing, learning, pilot |
| 6–10 devices | < 1 min scan | Smooth | Easy | Very Low | New tech first runs |
| 11–25 devices | 2–4 min scan | Smooth | Manageable | Low | Daily standard operation |
| 26–50 devices | 5–10 min scan | Slight lag | Requires discipline | Medium | Experienced operator, planned waves |
| 51–100 devices | 10–20 min scan | Noticeable lag | Difficult single-person | High | Multiple techs or automation required |
| 101–250 devices | 20–50 min scan | Significant lag | Not recommended single-person | Very High | Requires backend + parallelism |
| 250+ devices | Hours | Browser may freeze | Not viable single-person | Critical | Full infrastructure overhaul needed |

> **Important:** These are estimates based on the sequential scan loop with default settings
> (retryDelay=2s, maxRetries=3). A device that goes through all retries costs:
> `3 retries × 2s delay = 6 seconds minimum` before being marked Offline, plus scan time.
> A device that connects cleanly costs approximately 4–8 seconds.
> For a 50-device wave: `50 × 6s = ~5 minutes minimum` (clean connections), up to `50 × 20s = ~17 minutes` (heavy retries).

---

## 3. Code-Backed Limits — What Actually Constrains the System

### 3.1 No Hard Device Count Cap in the Data Model

**File:** `src/types.ts` and `contexts/AppContext.tsx`

The `Device` interface and `state.runner.devices` array have **no hardcoded maximum**. You can
theoretically load thousands of device records into the array. The limit is not in the data
structure — it is in the scan loop, the browser renderer, and the human operator.

```typescript
// contexts/AppContext.tsx — runner state
runner: {
  devices: Device[];   // ← plain array, no size limit
  logs: string[];
  // ...
}
```

### 3.2 Rack Grid: 16 Devices Per Visual Rack

**File:** `components/ImageRack.tsx`

Image Monitor renders devices in rack grids of 16 slots. This is a **visual grouping limit**, not
a functional limit. If you have 32 devices, you get two rack grids. If you have 64, you get four.
The 16-slot number matches a standard half-rack visual representation; it has no impact on
functional capacity.

```tsx
// components/ImageRack.tsx — rack display constant
const SLOTS_PER_RACK = 16;
// Devices are chunked: devices.slice(rackIndex * 16, (rackIndex + 1) * 16)
// Multiple rack grids render automatically for > 16 devices
```

**Impact:** None on actual throughput. 64 devices = 4 rack grids, all functional.

### 3.3 Deployment History: Last 10 Runs

**File:** `contexts/AppContext.tsx`

After a run is archived, the history array is capped to the 10 most recent entries. Older runs
are dropped from in-memory state. This is a **display and memory limit**, not a processing limit.

```typescript
// contexts/AppContext.tsx — ARCHIVE_RUN reducer case
case 'ARCHIVE_RUN': {
  const newRun = generateRunArchive(state.runner.devices, /* ... */);
  return {
    ...state,
    runner: {
      ...state.runner,
      history: [newRun, ...state.runner.history].slice(0, 10),  // ← cap at 10
    }
  };
}
```

**Impact:** Historical data beyond 10 runs is lost unless exported to CSV via DeploymentHistory.
For audit purposes, always export after each run before starting the next.

**Scaling path:** Change `slice(0, 10)` to a larger number, or implement a database-backed
history store that persists indefinitely.

### 3.4 Sequential Scan Loop (The Primary Throughput Bottleneck)

**File:** `services/deploymentService.ts:runDeploymentFlow()`

This is the most important capacity constraint. The scan loop processes devices **one at a time**
using a `for...of` loop with `await`. This means each device must complete its scan before the
next device begins.

```typescript
// services/deploymentService.ts — runDeploymentFlow (simplified)
export const runDeploymentFlow = async (devices, credentials, settings, callbacks) => {
  for (const device of devices) {           // ← SEQUENTIAL: one at a time
    if (isCancelled()) break;
    await validateDevice(device, credentials, settings, callbacks);
    // Each device scan: 4–20 seconds depending on retries
  }
};
```

**Why sequential?** This is intentional for two reasons:
1. **Network safety:** Scanning 100 devices simultaneously would flood the provisioning network
   with ARP/WoL/TCP traffic simultaneously.
2. **Visibility:** Sequential scanning gives the operator clean, readable log output — one device
   at a time rather than interleaved noise from 50 parallel connections.

**Throughput calculation:**

```
Devices per run = wave_size
Time per device = connection_time + check_time + retry_overhead

Best case (clean connection, no retries): ~4 seconds per device
Worst case (3 retries × 2s delay): ~6–12 seconds per device

50 devices (best case):  50 × 4s  = ~3.5 minutes
50 devices (worst case): 50 × 12s = ~10 minutes
100 devices (best case): 100 × 4s = ~7 minutes
100 devices (worst case): 100 × 12s = ~20 minutes
```

### 3.5 Parallel Bulk Update (The Speed Advantage)

**File:** `contexts/AppContext.tsx:BULK_UPDATE`

Unlike the scan loop, bulk update runs all selected devices **in parallel** using `Promise.all()`.
This means updating 20 devices takes about the same wall-clock time as updating 1 device.

```typescript
// contexts/AppContext.tsx — BULK_UPDATE reducer case
case 'BULK_UPDATE': {
  const updatePromises = selectedDevices.map(device =>
    updateDevice(device, state.runner.settings, callbacks)  // ← all start simultaneously
  );
  await Promise.all(updatePromises);    // ← waits for ALL to complete in parallel
}
```

**Throughput implication:** If your scan identifies 40 devices needing BIOS + Windows updates,
running Bulk Update on all 40 takes approximately the same time as running a single device update
(roughly 15–30 seconds simulated). In a real backend, this would be network/storage bounded, but
the concurrency model allows horizontal scaling.

**Caution:** Running parallel updates on 100+ real devices simultaneously could saturate shared
update file servers or overwhelm SCCM distribution points. In production, apply a concurrency
limit (e.g., `p-limit` npm package) to control simultaneous update threads.

---

## 4. Scan Loop Throughput — Sequential vs Parallel

### Current implementation (sequential)

```
Device 1: [WoL][Connect][Info][BIOS][DCU][Win] = ~8s
Device 2:                                        [WoL][Connect][Info][BIOS][DCU][Win] = ~8s
Device 3:                                                                               [WoL]...

Timeline: ──D1──────D2──────D3──────D4──────D5──────
                                              Total for 5 devices: ~40s
```

### How to parallelise (Scaling Path 1)

Replace the `for...of` sequential loop with a `Promise.all` with a controlled concurrency limit:

```typescript
// PROPOSED CHANGE — services/deploymentService.ts
// Replace sequential for loop with concurrent batches

import pLimit from 'p-limit';

export const runDeploymentFlow = async (devices, credentials, settings, callbacks) => {
  const limit = pLimit(5);  // ← process 5 devices simultaneously

  const tasks = devices.map(device =>
    limit(() => validateDevice(device, credentials, settings, callbacks))
  );

  await Promise.all(tasks);
};
```

**Effect with concurrency=5:**

```
Device 1: [WoL][Connect][Info][BIOS][DCU][Win] = ~8s
Device 2: [WoL][Connect][Info][BIOS][DCU][Win] = ~8s     ← starts at same time as D1
Device 3: [WoL][Connect][Info][BIOS][DCU][Win] = ~8s     ← starts at same time as D1
Device 4: [WoL][Connect][Info][BIOS][DCU][Win] = ~8s     ← starts at same time as D1
Device 5: [WoL][Connect][Info][BIOS][DCU][Win] = ~8s     ← starts at same time as D1
Device 6:                                        [WoL]... ← starts when a slot opens

Timeline: ──[D1-5 simultaneous]──[D6-10]──[D11-15]──
                                          Total for 50 devices: ~80s (vs ~400s sequential)
```

**Speed improvement with concurrency=5:** approximately 5× faster scan time for large cohorts.

**Risk:** Requires careful network capacity planning and log readability improvements in the UI.

---

## 5. Update Throughput — Why Bulk Update Is Faster

The bulk update path (`BULK_UPDATE` in `contexts/AppContext.tsx`) uses `Promise.all`, meaning
all selected devices update simultaneously. This is already implemented and available today.

```
Sequential update (individual, one device at a time):
  D1: [BIOS][DCU][Win] = ~20s
  D2:                   [BIOS][DCU][Win] = ~20s
  D3:                                     [BIOS][DCU][Win] = ~20s
  20 devices sequential = ~400s = ~6.5 minutes

Parallel update (Bulk Update, all at once):
  D1: [BIOS][DCU][Win] = ~20s
  D2: [BIOS][DCU][Win] = ~20s   ← simultaneous
  D3: [BIOS][DCU][Win] = ~20s   ← simultaneous
  ...
  20 devices parallel = ~20–30s (bounded by slowest device, not total count)
```

**Recommendation:** Always use Bulk Update when you have a homogeneous cohort (all `Scan Complete`,
similar update needs). This is the single most effective capacity multiplier available today
without any code changes.

---

## 6. Memory and UI Constraints (Browser)

### React state size

The `state.runner.devices` array holds full `Device` objects per device. Each Device object
includes:

```typescript
// Approximate per-device memory footprint (src/types.ts)
{
  id, hostname, mac, status,          // ~200 bytes
  biosVersion, dcuVersion, winVersion,// ~60 bytes
  ipAddress, serialNumber, model,     // ~150 bytes
  assetTag, ramAmount, diskSpace,     // ~80 bytes
  encryptionStatus, crowdstrikeStatus, sccmStatus,  // ~60 bytes
  scriptFile, availableFiles, installedPackages, runningPrograms,  // variable
  updatesNeeded, complianceChecks,    // ~100 bytes
  // Total: ~1–2 KB per device (without File objects)
}
```

**Memory estimate:** 500 devices × 2 KB = ~1 MB of device state. This is well within browser
limits. Memory is not the primary constraint for typical deployments.

### DOM rendering

`components/DeviceStatusTable.tsx` renders one table row per device. For large cohorts:

- **< 100 devices:** No noticeable rendering lag on modern hardware.
- **100–500 devices:** Initial render may take 500ms–2s. Status update re-renders will be slower.
- **500+ devices:** Recommend implementing virtual scrolling (e.g., `react-window` or
  `react-virtualized`) to render only visible rows.

### Log panel growth

`state.runner.logs` is an unbounded string array. Each device scan adds ~10–20 log entries.
For 100 devices, that is ~1,500–2,000 log lines. The `LogViewer` component renders all of them.

**Scaling path for logs:**
- Cap logs at last N entries: `logs.slice(-500)` in the reducer
- Or implement a virtualized log viewer

### Recharts chart data

`components/DeploymentHistory.tsx` passes all history runs to bar/trend charts. With 10 runs
capped by the history limit, chart data is small. If the cap is increased significantly,
charts may become slow to re-render with large datasets.

---

## 7. History and Archiving Limits

| Limit | Value | Location | Scaling Path |
|---|---|---|---|
| History runs in memory | 10 | `contexts/AppContext.tsx:slice(0,10)` | Increase cap; add DB backend |
| Log lines in memory | Unbounded | `state.runner.logs` array | Add `slice(-N)` cap in reducer |
| CSV export | Per-run, manual | `DeploymentHistory.tsx` export button | Add scheduled auto-export |
| Device records after run | Persist until removed | `state.runner.devices` | No persistent storage currently |

**Critical note for operators:** Device state and run history are **in-memory only**. If you close
or refresh the browser tab, all current state is lost (unless `useLocalStorage` hook persists it —
check `hooks/useLocalStorage.ts` for current persistence scope). Always export run history to CSV
before closing the session.

---

## 8. How to Scale — Step-by-Step Paths

### Scale Path 1: Wave Discipline (No Code Changes Required)

Use today. Works with any cohort size by managing work in staged batches.

```
Wave Strategy for 100 devices (single tech):
  ┌─────────────────────────────────────────────────────┐
  │ Wave 1: Devices 1–25   → Scan → Update → Verify    │
  │ Wave 2: Devices 26–50  → Scan → Update → Verify    │
  │ Wave 3: Devices 51–75  → Scan → Update → Verify    │
  │ Wave 4: Devices 76–100 → Scan → Update → Verify    │
  │                                                     │
  │ Each wave: ~10–20 min scan + ~5–10 min remediation  │
  │ Total: ~60–120 minutes for 100 devices, one person  │
  └─────────────────────────────────────────────────────┘

Benefits:
  • Errors are isolated per wave
  • Smaller queues are cognitively manageable
  • Log output is readable
  • No code changes required
```

### Scale Path 2: Parallelise the Scan Loop

**Code change:** `services/deploymentService.ts:runDeploymentFlow()`

Replace sequential `for...of` with `pLimit`-controlled `Promise.all` (see Section 4 example).

**Result:** 5× scan throughput with concurrency=5; 10× with concurrency=10.
**Risk:** Log output becomes interleaved; UI status updates occur simultaneously for multiple
devices. May require UI changes to handle concurrent state dispatches cleanly.

**Effort:** Medium (1–2 days; requires updating the dispatch callback pattern to be thread-safe
within the async concurrent context).

### Scale Path 3: Add Virtual Scrolling to Device Table

**Code change:** `components/DeviceStatusTable.tsx`

Replace the flat `devices.map(...)` render with `react-window` or `react-virtualized`.

```tsx
// Current (renders all rows)
{devices.map(device => <DeviceRow key={device.id} device={device} />)}

// Proposed (renders only visible rows)
import { FixedSizeList } from 'react-window';
<FixedSizeList height={600} itemCount={devices.length} itemSize={80}>
  {({ index, style }) => (
    <DeviceRow style={style} device={devices[index]} />
  )}
</FixedSizeList>
```

**Result:** 500+ devices render with no noticeable lag.
**Effort:** Low (1 day; mostly a component swap).

### Scale Path 4: Multiple Browser Tabs (No Code Changes)

If the app is served on LAN (see README Setup section), two techs can open separate tabs or
separate browser windows and load different device cohorts simultaneously.

```
Tech A browser: loads devices 1–50  → scans independently
Tech B browser: loads devices 51–100 → scans independently

No coordination needed — each browser maintains its own isolated state.
Combined throughput: 2×
```

**Limitation:** Credentials, settings, and history are not shared between tabs (each tab has
independent React state unless `useLocalStorage` synchronizes). Export and reconcile run data
manually at shift end.

### Scale Path 5: Backend API and Worker Pool

**Full infrastructure change.** Replace the mock service layer with a real Node.js / Python / Go
API server. The frontend sends device lists and action requests; the backend manages the actual
scan/update worker pool.

```
┌──────────────┐  HTTP/WS  ┌──────────────────────┐
│ React UI     │──────────▶│ API Server           │
│ (browser)    │◀──────────│ Node.js / Python     │
└──────────────┘  events   └──────────────────────┘
                                      │
                              ┌───────┴────────┐
                              │ Worker Pool    │
                              │ 10 concurrent  │
                              │ WinRM sessions │
                              └───────┬────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │ Device 1  Device 2  Device 3 ... N │
                    │ (WinRM connections)                │
                    └────────────────────────────────────┘
```

**Result:** 100+ devices scanned concurrently; persistent history database; RBAC; audit logs.
**Effort:** High (weeks to months; full backend development project).

### Scale Path 6: Increase History Cap and Add Persistence

**Code change (2 lines):** `contexts/AppContext.tsx`

```typescript
// Change history cap from 10 to 100
history: [newRun, ...state.runner.history].slice(0, 100),

// Add local storage persistence via useLocalStorage hook
// (hooks/useLocalStorage.ts already exists — wire it to history state)
```

**Result:** Longer run history for trend analysis; history survives browser refresh.
**Effort:** Very low (< 1 hour).

---

## 9. Multi-Tech Scaling

When one person is not enough, here are the coordination patterns:

### Pattern A: Split by cohort (today, no infra change)

```
Imaging tech:
  Runs AutoTag for all devices → monitors Image Monitor
  Transfers completed batches to runners

Deployment operator:
  Receives CSV or transferred devices → runs scans and updates

Works because: imaging and deployment are separate phases with a clean handoff point.
```

### Pattern B: Split by rack (multiple techs, multiple sessions)

```
Tech A: handles racks 1–4  (devices 1–64)   → separate browser session
Tech B: handles racks 5–8  (devices 65–128) → separate browser session
Tech C: handles racks 9–12 (devices 129–192) → separate browser session

Shift lead: coordinates transfer timing and reconciles end-of-shift archives
```

### Pattern C: Shift-based hand off

```
Shift 1 (morning): intake + imaging + initial scan
Shift 2 (afternoon): remediation + re-scan + archive + removal

Key: Shift 1 exports CSV of Scan Complete devices with known update needs
     Shift 2 imports that CSV and picks up from remediation phase
```

---

## 10. Capacity Summary at a Glance

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CAPACITY SUMMARY                                      │
├─────────────┬─────────────┬───────────────────────────────────────────── │
│ Device Count│ Feasibility │ Notes                                        │
├─────────────┼─────────────┼──────────────────────────────────────────────│
│ 1–10        │ ✅ Easy     │ Default settings, any tech, no waves needed  │
│ 11–25       │ ✅ Standard │ One wave, normal daily operation             │
│ 26–50       │ ✅ Workable │ 2 waves of 25; use Bulk Update, monitor logs │
│ 51–100      │ ⚠️ Moderate │ 4+ waves or 2 techs; scan time 20–40 min    │
│ 101–250     │ ⚠️ Demanding│ Parallelism needed; 2+ techs; strict waves  │
│ 251–500     │ 🔴 Hard     │ Requires scan loop parallelism + virt scroll │
│ 500+        │ 🔴 Advanced │ Backend API + worker pool; frontend alone    │
│             │             │ will not sustain this reliably               │
└─────────────┴─────────────┴──────────────────────────────────────────────┘

KEY BOTTLENECKS AND THEIR SOLUTIONS:
  Sequential scan loop  → Parallelise with pLimit (Scale Path 2)
  16-slot rack view     → Visual only; no functional limit (ignore this)
  10-run history cap    → Increase slice cap + add persistence (Scale Path 6)
  Browser DOM rendering → Add virtual scrolling (Scale Path 3)
  Single-operator limit → Wave discipline (Scale Path 1) + multi-tech (Section 9)
  No persistence        → Export CSV after every run (immediate mitigation)
  Real infra at scale   → Backend API + worker pool (Scale Path 5)
```
