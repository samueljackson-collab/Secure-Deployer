# Secure Deployment Runner — Wiki Home

> **Hospital Network Device Deployment & Imaging Management Platform**
>
> Production-hardened. AI-free. USB-portable. Built for hospital IT teams
> who deploy software on networks where system failure affects patient care.

---

## What Is This?

Secure Deployment Runner is an Electron desktop application that gives hospital IT teams a single tool for:

1. **Imaging Monitoring** — Watch SCCM/MDT task sequences in real time as devices are imaged
2. **Deployment Management** — Scan and update BIOS, DCU, and Windows across a fleet of Dell devices
3. **Script Safety** — Automatically analyze deployment scripts for dangerous patterns before they execute
4. **Scope Control** — Guarantee that operations only affect the specific devices you selected

It runs entirely from a USB drive, requires no internet connection, makes no external API calls, and stores no credentials on disk.

---

## Quick Navigation

| Section | What You'll Find |
|---------|-----------------|
| [Getting Started](./Getting-Started.md) | Prerequisites, installation, first run walkthrough |
| [Architecture](./Architecture.md) | System design, component map, data flow, tech stack decisions |
| [Implementation](./Implementation.md) | Build guide, configuration reference, USB deployment setup |
| [Operations](./Operations.md) | Day-to-day runbook, monitoring, maintenance, incident response |
| [Security](./Security.md) | Hardening details, credential handling, CSP, compliance |
| [Troubleshooting](./Troubleshooting.md) | Common issues, decision trees, log analysis, FAQ |
| [Reference](./Reference.md) | CSV format, status codes, script patterns, device types, glossary |
| [Advanced](./Advanced.md) | Extending the analyzer, adding form factors, CI/CD, customization |
| [Meta](./Meta.md) | Changelog, ADRs, contributing guide, interview talking points |

---

## Core Concepts

### Two Views, One Tool

The application has two primary views accessible via a tab toggle:

- **Image Monitor** — Ingests device metadata JSON files produced by the `Gather-DeviceMetadata.bat` script during SCCM/MDT imaging. Shows live progress, device hardware details, and imaging status. When imaging is complete, devices can be "promoted" to the Deployment Runner.

- **Deployment Runner** — Manages the post-imaging lifecycle: Wake-on-LAN, remote connectivity, compliance scanning (BIOS/DCU/Windows versions), and scripted updates. Devices can be loaded from CSV or promoted from the Image Monitor.

### Script Safety Analyzer

Every deployment script is run through a deterministic, regex-based static analyzer before execution. The analyzer checks for 60+ patterns across three severity tiers:

| Tier | Effect | Examples |
|------|--------|----------|
| **BLOCKED** | Script cannot execute | `format`, `diskpart`, subnet broadcasts, wildcard targeting |
| **DANGER** | Manual override required | Registry writes, service stops, remote execution |
| **WARNING** | Informational | File copies to system dirs, silent installers, network commands |

There is no AI involved. Analysis is purely pattern-matching — deterministic, reproducible, and offline.

### Device Scope Guard

Before any bulk operation, the Scope Guard requires:

1. Individual checkbox confirmation for each device
2. Typing the exact device count
3. Configuring safety toggles (broadcast blocking, registry write blocking, etc.)

This prevents accidental wide-effect operations on hospital networks.

### Dell Device Form Factor Detection

Hostnames are parsed to identify 10 Dell business device categories, each with a unique SVG icon and color:

| Category | Icon Color | Detection Patterns |
|----------|-----------|-------------------|
| Standard 14" Laptop | Blue | `ELSLE`, `ESLSC`, `L14`, `LAT14` |
| Pro 16" Laptop | Indigo | `EPLPR`, `L16`, `LAT16`, `PRE16` |
| Detachable 2-in-1 | Teal | `EDTCH`, `DET`, `2IN1`, `DTCH` |
| Generic Laptop | Slate | `LAT`, `LAPTOP`, `NB` |
| SFF Desktop | Emerald | `EWSSF`, `SFF` |
| Micro Desktop | Amber | `EWSMF`, `EWSMC`, `MFF`, `MICRO` |
| Tower Desktop | Orange | `EWSTW`, `TWR`, `TOWER` |
| Wyse Thin Client | Cyan | `WYSE`, `WYS`, `THIN`, `TC` |
| VDI Client | Violet | `VDI`, `VIRT`, `VD-` |
| Generic Desktop | Slate | Default fallback |

---

## Key Design Principles

### 1. "Do No Harm" to Hospital Systems

Every feature is designed around the principle that a deployment tool must never put hospital systems at risk. This means:

- Scripts are analyzed before execution, not after
- Operations require per-device verification
- Credentials never touch disk
- No network exposure beyond the target devices

### 2. Zero External Dependencies at Runtime

The application has no runtime network requirements:

- No CDN stylesheets (Tailwind is bundled via PostCSS)
- No AI API calls (Gemini was removed entirely)
- No telemetry or analytics
- No automatic updates

### 3. Deterministic Over Probabilistic

We chose regex pattern matching over AI/ML for script analysis because:

- Hospital environments need predictable, reproducible results
- The same script must produce the same safety result every time
- No model drift, no hallucinations, no network calls
- Every rule can be audited and explained to compliance teams

### 4. Defense in Depth

Security is not a single feature — it's layered throughout:

- Electron process isolation (sandbox + context isolation)
- Content Security Policy (blocks XSS and injection)
- Script Safety Analyzer (blocks destructive scripts)
- Device Scope Guard (blocks wide-effect operations)
- Credential sanitization (blocks credential leakage)
- Network binding (blocks network exposure)
- Certificate validation (blocks MITM attacks)
- Session timeout (blocks unattended access)

---

## Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| UI Framework | React 19 + TypeScript | Type safety, component architecture, hooks |
| Desktop Shell | Electron 35 | Cross-platform desktop packaging with sandbox |
| Build Tool | Vite 6 | Fast builds, localhost-only dev server |
| Styling | Tailwind CSS 3.4 (PostCSS) | Utility-first, fully offline (no CDN) |
| CSV Parsing | PapaParse 5.5 | Robust CSV handling with header detection |
| Packaging | electron-builder 24 | Portable and installer builds for USB |

---

## Who Should Use This Wiki

| Audience | Start Here |
|----------|-----------|
| **First-time users** | [Getting Started](./Getting-Started.md) |
| **Operators running deployments** | [Operations](./Operations.md) |
| **IT managers evaluating the tool** | [Security](./Security.md) |
| **Developers extending the tool** | [Architecture](./Architecture.md) then [Advanced](./Advanced.md) |
| **Troubleshooting an issue** | [Troubleshooting](./Troubleshooting.md) |
| **Preparing for an interview** | [Meta](./Meta.md) |
