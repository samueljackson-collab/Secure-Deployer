
# Secure Deployment Runner

A graphical user interface to manage and monitor the remote deployment of software packages using a PowerShell-based backend. This tool provides a centralized dashboard for IT administrators to track compliance, push updates, and manage devices across a network efficiently and securely.

## ✨ Features

-   **Live Imaging Monitor**: Real-time rack view of devices undergoing imaging, with live progress bars and post-imaging compliance checks.
-   **CSV-Based Device Loading**: Easily import target devices for deployment operations using a simple CSV file.
-   **Real-Time Deployment Tracking**: Monitor the status of each device in real-time with a comprehensive progress dashboard and a live log viewer.
-   **Detailed Compliance Scanning**: Automatically checks device compliance against target BIOS, DCU, and Windows versions, as well as security policies like disk encryption and endpoint protection status.
-   **Full Fleet Re-Scan**: Initiate a comprehensive compliance and status scan for all devices currently in the deployment runner with a single click, protected by a confirmation dialog to prevent accidental execution.
-   **Granular & Bulk Actions**: Perform actions on individual devices or in bulk, including:
    -   Running Updates
    -   Executing Post-Imaging Scripts
    -   Re-validating Compliance
    -   Rebooting Devices
    -   Sending Wake-on-LAN Signals
    -   Cancelling ongoing tasks
-   **Secure Credential Handling**: Utilizes a modal for single-use, session-based administrative credentials, ensuring they are not stored or exposed.
-   **Deployment History & Analytics**: View a history of past deployment runs with detailed analytics, success rate trends, and common failure points.

## 🚀 Getting Started

1.  **Navigate to the Image Monitor**: View devices as they come online during the imaging process. Once imaging and compliance checks are complete, transfer them to the Deployment Runner.
2.  **Navigate to the Deployment Runner**:
    -   **Load Devices**: Either use the devices transferred from the monitor or upload a `.csv` file containing device `Hostname` and `MAC` addresses.
    -   **Configure Settings**: Adjust advanced settings like connection retries and auto-reboot behavior if needed.
    -   **Start Scan**: Click "Start Scan" and enter secure, session-only administrative credentials when prompted. The application will begin connecting to devices and checking their compliance status.
3.  **Manage Devices**: Once the scan is complete, use the individual or bulk actions to bring devices into compliance.

## 🛠️ Technology Stack

-   **Frontend**: React, TypeScript, Tailwind CSS
-   **Data Parsing**: Papaparse
-   **Backend (Simulated)**: The application is designed to interface with a PowerShell backend for all remote device interactions.
