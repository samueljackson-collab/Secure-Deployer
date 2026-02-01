<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Secure Deployer

Secure Deployer is a React + Vite dashboard for coordinating device deployment runs. It validates device inventories from CSV files, captures operator credentials for the session, and visualizes progress, logs, and deployment history so you can keep rollouts on track. 

## Highlights

- Upload a device inventory CSV and validate MAC address formats before deployment.
- Capture session credentials in a dedicated modal before starting a run.
- Track deployment progress, device status, and failures in real time.
- Review a centralized log stream for actions, warnings, and errors.
- See a history of recent runs with compliance metrics and success rates.

## Tech Stack

- React 19 + TypeScript
- Vite 6
- PapaParse for CSV ingestion
- React Markdown for rich log and status rendering

## Getting Started

### Prerequisites

- Node.js (latest LTS recommended)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file and add your Gemini API key:

```bash
GEMINI_API_KEY=your_api_key_here
```

### Run the app locally

```bash
npm run dev
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local dev server. |
| `npm run build` | Build the production bundle. |
| `npm run preview` | Preview the production build locally. |

## Project Structure

```text
.
├── components/           # UI building blocks (tables, progress, logs, modals)
├── services/             # Service helpers
├── App.tsx               # Primary application flow
└── types.ts              # Shared types and enums
```

## Notes

- The app expects a device CSV that includes hostname and MAC address columns (case-insensitive matches).
- MAC addresses are normalized and validated before deployments are queued.

