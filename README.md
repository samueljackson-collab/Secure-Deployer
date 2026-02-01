# Secure Deployment Runner

A modern, web-based graphical user interface for managing and monitoring remote software deployments across enterprise networks. Built with React and TypeScript, this tool provides real-time progress tracking, Wake-on-LAN support, secure credential handling, and comprehensive deployment analytics.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [CSV File Format](#csv-file-format)
- [Configuration Options](#configuration-options)
- [Understanding Device Status](#understanding-device-status)
- [Deployment Analytics](#deployment-analytics)
- [Security Features](#security-features)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Troubleshooting](#troubleshooting)

## Overview

Secure Deployment Runner is designed for IT administrators and system engineers who need to deploy software updates, patches, or configuration scripts across multiple devices in an enterprise environment. The application provides a centralized dashboard to:

- Upload and validate device lists from CSV files
- Execute deployment scripts remotely on target machines
- Monitor real-time deployment progress for each device
- Track system compliance (BIOS, DCU, Windows versions)
- View detailed logs and analytics for each deployment run

## Features

### Core Functionality

- **CSV-Based Device Management**: Import device lists via CSV files containing hostnames and MAC addresses
- **Remote Script Execution**: Deploy `.bat` or `.cmd` scripts to target machines
- **Wake-on-LAN (WoL)**: Remotely wake devices before deployment
- **Real-Time Progress Tracking**: Monitor each device's status as deployments progress
- **Bulk Operations**: Select multiple devices for bulk updates, cancellations, or Wake-on-LAN

### System Compliance Checking

The tool scans each device for compliance with target versions:
- **BIOS Version**: Checks against target version (default: A25)
- **Dell Command Update (DCU)**: Validates DCU version (default: 5.2.0)
- **Windows Version**: Ensures Windows feature update level (default: 23H2)

### Analytics & History

- **Deployment History**: Stores the last 10 deployment runs
- **Success Rate Trends**: Visual charts showing compliance trends over time
- **Update Analytics**: Track which updates (BIOS, DCU, Windows) are most commonly needed
- **Failure Analysis**: Breakdown of failures by reason (offline, cancelled, failed)

### User Interface

- **Dark Theme**: Modern, eye-friendly dark interface
- **Responsive Design**: Works on desktop and tablet screens
- **Live Log Viewer**: Real-time scrolling log output with color-coded severity levels
- **Desktop Notifications**: Browser notifications for deployment completion events
- **Collapsible Sections**: Keep the interface clean by collapsing unused panels

## System Requirements

- **Node.js**: Version 18.x or higher
- **Modern Web Browser**: Chrome, Firefox, Edge, or Safari (latest versions)
- **Network Access**: Connectivity to target devices for deployment operations

## Installation

1. **Clone or download the repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

### Production Build

To create a production-ready build:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## Getting Started

### Step 1: Prepare Your Device List

Create a CSV file containing the devices you want to deploy to. The file must include columns for hostname and MAC address. See the [CSV File Format](#csv-file-format) section for details.

### Step 2: Prepare Your Deployment Script

Create a `.bat` or `.cmd` script containing the commands you want to execute on each target device.

### Step 3: Configure and Deploy

1. Open the Secure Deployment Runner in your browser
2. Upload your device list CSV file
3. Upload your deployment script
4. Configure retry settings if needed
5. Click "Start System Scan" to begin

## Usage Guide

### Main Interface Sections

#### Configuration Panel (Left Side)

1. **Select Device List**: Upload a CSV file containing your target devices
2. **Select Deployment Package**: Upload the `.bat` or `.cmd` script to execute
3. **Enter Credentials**: Credentials are securely prompted when deployment begins
4. **Advanced Settings**: Configure connection retry behavior
   - **Max Retries**: Number of connection attempts per device (default: 3)
   - **Retry Delay**: Seconds between retry attempts (default: 2)

#### Deployment Status Panel (Right Side)

- **Progress Bar**: Visual representation of overall deployment progress
- **Device Status Table**: Detailed status for each device
- **Live Logs**: Real-time deployment activity logs

### Deployment Workflow

1. **Initialization**: Files are validated and parsed
2. **Wake-on-LAN**: WoL packets sent to all devices
3. **Boot Wait**: System waits for devices to boot (30 seconds)
4. **Connection**: Establishes connection to each device
5. **System Scan**: Checks BIOS, DCU, and Windows versions
6. **Update Execution**: Applies necessary updates (manual trigger per device)

### Bulk Actions

Select multiple devices using the checkboxes, then use the bulk action toolbar to:
- **Update All**: Apply updates to all selected devices
- **Cancel All**: Cancel operations on selected devices
- **Wake-on-LAN**: Send wake packets to selected devices

## CSV File Format

Your CSV file should contain at minimum two columns:

| Column | Required | Accepted Names |
|--------|----------|----------------|
| Hostname | Yes | `hostname`, `computername`, `devicename`, `computer`, `name`, `device` |
| MAC Address | Yes | `macaddress`, `mac address`, `mac` |

### Example CSV

```csv
Hostname,MAC Address
DESKTOP-001,AA:BB:CC:DD:EE:01
LAPTOP-002,AA:BB:CC:DD:EE:02
WORKSTATION-003,AA-BB-CC-DD-EE-03
```

### MAC Address Formats

The following MAC address formats are accepted:
- Colon-separated: `AA:BB:CC:DD:EE:FF`
- Hyphen-separated: `AA-BB-CC-DD-EE-FF`
- No separator: `AABBCCDDEEFF`

### Device Type Detection

The tool automatically detects device types based on hostname patterns:
- **Laptop**: Hostnames containing `ELSLE` or `ESLSC`
- **Desktop**: All other hostnames (including `EWSLE` patterns)

## Configuration Options

### Retry Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Max Retries | 3 | Maximum connection attempts before marking device as offline |
| Retry Delay | 2 seconds | Wait time between retry attempts |

### Target Versions

The application checks devices against these target versions (configurable in code):

| Component | Target Version |
|-----------|----------------|
| BIOS | A25 |
| DCU | 5.2.0 |
| Windows | 23H2 |

## Understanding Device Status

| Status | Description |
|--------|-------------|
| Pending | Device queued for processing |
| Waking Up | Wake-on-LAN packet sent |
| Connecting | Establishing connection |
| Retrying... | Connection failed, retrying |
| Checking Info | Gathering system information |
| Checking BIOS | Verifying BIOS version |
| Checking DCU | Verifying DCU version |
| Checking Windows | Verifying Windows version |
| Scan Complete | Scan finished, updates may be needed |
| Updating | Update process in progress |
| Updating BIOS | BIOS update in progress |
| Updating DCU | DCU update in progress |
| Updating Windows | Windows update in progress |
| Success | All checks passed or updates completed |
| Failed | Operation failed |
| Offline | Device unreachable after all retries |
| Cancelled | Operation cancelled by user |

## Deployment Analytics

### Analytics Dashboard

After completing deployments, view analytics including:

- **Success Trend**: Shows if your fleet compliance is improving, stable, or declining
- **Average Success Rate**: Overall success percentage across all runs

### Visual Charts

1. **Success Rate Trend Chart**: Bar chart showing success rates over the last 10 runs
2. **Required Updates Trend**: Stacked chart showing BIOS, DCU, and Windows update requirements
3. **Failure Reasons Trend**: Breakdown of offline, cancelled, and failed devices

### Individual Run Details

Each deployment run shows:
- Timestamp
- Total devices processed
- Compliant count
- Needs action count
- Failed count
- Visual progress bar

## Security Features

### Secure Credential Handling

- Credentials are prompted via a secure modal before each deployment
- Credentials are stored only in application memory during the session
- Credentials are never persisted to disk or local storage
- Single-use authentication model for each deployment session

### Input Validation

- CSV files are validated for required columns
- MAC addresses are normalized and validated (12 hex characters)
- Empty or invalid entries are skipped with warnings logged

## Project Structure

```
secure-deployment-runner/
├── App.tsx                 # Main application component
├── index.tsx               # Application entry point
├── index.html              # HTML template
├── types.ts                # TypeScript type definitions
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies and scripts
├── components/
│   ├── Header.tsx          # Application header with WoL button
│   ├── StepCard.tsx        # Configuration step cards
│   ├── DeploymentProgress.tsx  # Progress bar component
│   ├── DeviceStatusTable.tsx   # Device list table
│   ├── DeviceIcon.tsx      # Device type icons
│   ├── LogViewer.tsx       # Live log display
│   ├── BulkActions.tsx     # Bulk operation toolbar
│   ├── DeploymentHistory.tsx   # History and analytics
│   ├── DeploymentAnalytics.tsx # Analytics charts (empty)
│   ├── CredentialsForm.tsx # Credential input form
│   └── SecureCredentialModal.tsx # Modal for credentials
└── services/
    └── aiService.ts        # External service integration
```

## Technology Stack

| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| PapaParse | CSV parsing |
| React-Markdown | Markdown rendering |
| Tailwind CSS | Styling (inline classes) |

## Troubleshooting

### Common Issues

**CSV file not loading**
- Ensure the file has a `.csv` extension
- Verify the file contains required columns (hostname and MAC address)
- Check for empty rows or invalid MAC addresses in the logs

**Devices showing as offline**
- Verify network connectivity to target devices
- Ensure Wake-on-LAN is enabled in device BIOS
- Check if firewalls are blocking connections
- Increase max retries in advanced settings

**Deployment cancelled unexpectedly**
- Check the live logs for error messages
- Verify credentials are correct
- Ensure sufficient permissions for remote operations

**No notifications appearing**
- Allow notifications in your browser for the application URL
- Check browser notification settings

### Log Levels

| Level | Color | Description |
|-------|-------|-------------|
| INFO | Blue | General information messages |
| SUCCESS | Green | Successful operations |
| WARNING | Yellow | Non-critical issues |
| ERROR | Red | Critical failures |

---

## License

This project is provided as-is for enterprise deployment management purposes.

## Support

For issues and feature requests, please contact your system administrator or the development team.
