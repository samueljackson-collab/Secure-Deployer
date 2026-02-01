# FamilyBridge Photos

A self-hosted family photo sharing application designed with elderly users as the primary audience. FamilyBridge Photos prioritizes accessibility, simplicity, and security, providing a private platform for families to upload, organize, browse, and back up their photos without relying on third-party cloud services.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Accessibility](#accessibility)
- [Architecture](#architecture)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)
- [Backup System](#backup-system)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Design Principles](#design-principles)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## Overview

FamilyBridge Photos addresses a common problem: elderly family members who want to view and share family photos but find mainstream photo services too complex, too small to read, or lacking in privacy. This application provides:

- **Self-hosted privacy**: Photos never leave your own server
- **Elder-friendly interface**: Large buttons, high-contrast colors, and simplified navigation
- **Calendar-based browsing**: Navigate photos by date with an intuitive calendar view
- **Secure access**: Authentication-protected image delivery with signed URLs
- **Automated backups**: rsync-based full and incremental backup with verification

## Features

### Photo Management
- **Photo Upload**: Drag-and-drop or click-to-upload with real-time progress feedback
- **Grid and List Views**: Toggle between visual grid layouts and detailed list views
- **Calendar View**: Browse photos organized by date on an interactive calendar
- **Photo Counts by Date**: Visual indicators showing how many photos exist on each day
- **Success Notifications**: Clear feedback when uploads complete

### Elder-Friendly UI Components
- **Large Buttons**: Oversized, high-contrast call-to-action buttons with clear labels
- **Sidebar Navigation**: Hierarchical navigation with generous spacing and readable text
- **High Contrast Design**: WCAG AAA compliant color scheme (8.63:1 contrast ratio)
- **Focus Indicators**: Visible keyboard focus rings for accessibility
- **Simplified Layout**: Clean, uncluttered interface with clear visual hierarchy

### Backup & Storage
- **Full Backup**: Complete rsync-based synchronization of all photos
- **Incremental Backup**: Hard-link-based incremental backups saving disk space
- **Checksum Verification**: Post-sync verification using checksum-based dry runs
- **Background Processing**: Non-blocking backup operations via FastAPI background tasks
- **CLI Tool**: Command-line backup script for scheduled cron jobs

### Security
- **Bearer Token Authentication**: All API requests authenticated via JWT tokens
- **Signed Image URLs**: Backend-generated expiring URLs for secure image access
- **Authenticated Image Proxy**: Images fetched through API client with credentials, never exposed as bare URLs
- **Credential Isolation**: Authentication tokens stored in localStorage with per-request injection

## Accessibility

FamilyBridge Photos is built to meet WCAG 2.1 AAA standards:

| Element | Specification | Value |
|---------|---------------|-------|
| Primary color | Deep blue on white | `#0D47A1` on `#FFFFFF` |
| Contrast ratio | Against white backgrounds | **8.63:1** (exceeds AAA 7:1 requirement) |
| Body text | Near-black on white | `#0A0A0A` on `#FFFFFF` |
| Button size | Minimum touch target | 48px height with `py-4 px-6` |
| Focus indicators | Ring offset pattern | 4px blue ring with 2px offset |
| Font family | System fonts | Inter, system-ui, -apple-system |
| Font weight | Button text | Semi-bold (600) for readability |
| Hover states | Color darkening | `#083878` for clear interaction feedback |

### Accessibility Decisions

- **Primary buttons** use `bg-blue-800` / `border-blue-900` to guarantee 4.5:1+ contrast against white
- **Body text** uses near-black (`#0A0A0A`) instead of pure black to reduce visual harshness
- **Focus-visible** states use `ring-4` with `ring-offset-2` for keyboard navigation
- **ARIA attributes** are applied throughout (`aria-label`, `aria-disabled`, `role="status"`)
- **Semantic HTML** used for navigation (`<nav>`) and status messages (`role="status"`)

## Architecture

```
┌──────────────────────────────────┐
│           Frontend               │
│  React + TypeScript + Tailwind   │
│                                  │
│  ┌──────────┐  ┌──────────────┐  │
│  │  Photos   │  │   Elderly    │  │
│  │  Page     │  │  Components  │  │
│  │ (Grid/    │  │ (LargeButton │  │
│  │  List/    │  │  SidebarNav) │  │
│  │  Calendar)│  │              │  │
│  └────┬─────┘  └──────────────┘  │
│       │                          │
│  ┌────┴─────┐                    │
│  │ API Layer│ (Axios + Auth)     │
│  └────┬─────┘                    │
└───────┼──────────────────────────┘
        │  HTTP (Bearer Token)
┌───────┼──────────────────────────┐
│  ┌────┴─────┐                    │
│  │ FastAPI  │  Backend           │
│  │ Router   │  Python 3.11+     │
│  └────┬─────┘                    │
│       │                          │
│  ┌────┴──────────┐               │
│  │ Backup Service│               │
│  │ (rsync-based) │               │
│  └───────────────┘               │
└──────────────────────────────────┘
        │
   ┌────┴────┐
   │ Storage │ (Local / NAS)
   └─────────┘
```

### Request Flow

1. User interacts with the React frontend
2. Frontend API layer attaches Bearer token to all requests
3. Backend validates authentication and processes the request
4. Images are served through signed URLs or authenticated blob proxying
5. Backups run as background tasks triggered via API or scheduled CLI

## System Requirements

### Frontend
- **Node.js**: Version 18.x or higher
- **Modern Browser**: Chrome, Firefox, Edge, or Safari (latest versions)
- **Screen Resolution**: Optimized for tablets and desktops (1024px+ recommended)

### Backend
- **Python**: 3.11 or higher
- **rsync**: Required for backup operations
- **Storage**: Local disk or NAS mount for photo storage

## Installation

### Frontend Setup

1. **Navigate to the frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**

   Create a `.env` file:
   ```bash
   VITE_API_URL=http://localhost:8000/api
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

### Backend Setup

1. **Navigate to the backend directory**
   ```bash
   cd backend
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate    # Linux/macOS
   venv\Scripts\activate       # Windows
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the API server**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Configuration

### Environment Variables

#### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `/api` |

#### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `PHOTO_STORAGE_PATH` | Path to photo storage directory | `./photos` |
| `BACKUP_DESTINATION` | Path to backup destination | `./backups` |
| `SECRET_KEY` | JWT signing secret | (required) |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:5173` |

## Usage Guide

### Uploading Photos

1. Navigate to the **Photos** page
2. Click the upload area or drag-and-drop image files
3. Wait for the upload progress indicator to complete
4. A green success message confirms the upload

Supported formats: JPEG, PNG, WebP, GIF, HEIC

### Browsing Photos

#### Grid View
- Click the **Grid** button in the header
- Photos display as thumbnails in a responsive grid
- Click any photo to view it full-size

#### List View
- Click the **List** button in the header
- Photos display with metadata (date, name, size)
- Useful for finding specific photos by name

#### Calendar View
- Navigate the interactive calendar
- Days with photos show a photo count badge
- Click a date to view all photos from that day
- Navigate months using the calendar controls

### Running Backups

#### Via API
```bash
curl -X POST http://localhost:8000/api/backup/photos \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Returns `202 Accepted` — backup runs in the background.

#### Via CLI
```bash
# Full backup
python scripts/backup_sync.py /path/to/photos /path/to/backup --mode full

# Full backup with verification
python scripts/backup_sync.py /path/to/photos /path/to/backup --mode full --verify

# Incremental backup
python scripts/backup_sync.py /path/to/photos /path/to/backup \
  --mode incremental --previous-backup /path/to/previous/backup

# Incremental backup with verification
python scripts/backup_sync.py /path/to/photos /path/to/backup \
  --mode incremental --previous-backup /path/to/previous/backup --verify
```

## API Reference

### Image Endpoints

#### Get Signed Image URL
```
GET /api/images/{path}/signed-url
```
Returns a time-limited signed URL for secure image access.

**Response:**
```json
{
  "url": "https://storage.example.com/photos/image.jpg?token=..."
}
```

#### Get Image (Authenticated Proxy)
```
GET /api/images/{path}
```
Returns the image binary through an authenticated proxy. Used internally by the frontend to avoid exposing bare image URLs.

**Response:** Image binary (JPEG, PNG, etc.)

### Backup Endpoints

#### Trigger Photo Backup
```
POST /api/backup/photos
```
Starts a background backup job.

**Response (202 Accepted):**
```json
{
  "status": "success",
  "message": "Photo backup started"
}
```

### Authentication

All API endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are stored in `localStorage` under the key `authToken` and automatically attached to all frontend API requests via an Axios interceptor.

## Backup System

### Full Backup

Performs a complete mirror sync using `rsync -a --delete`:
- Archives all files with permissions preserved
- Deletes files at destination that no longer exist at source
- Ensures an exact copy of the photo library

### Incremental Backup

Uses `rsync --link-dest` to create space-efficient incremental snapshots:
- Unchanged files are hard-linked to the previous backup
- Only modified files consume additional disk space
- Each backup appears as a complete snapshot

### Verification

Optional post-sync verification (`--verify` flag):
- Runs `rsync --checksum --dry-run` to detect mismatches
- Compares checksums between source and destination
- Raises an error if any files are out of sync
- Zero additional data transfer (read-only comparison)

### Backup Schedule (Recommended)

Add to crontab for automated backups:

```cron
# Daily full backup at 2 AM
0 2 * * * /path/to/venv/bin/python /path/to/scripts/backup_sync.py /photos /backup --mode full --verify

# Hourly incremental backup
0 * * * * /path/to/venv/bin/python /path/to/scripts/backup_sync.py /photos /backup/hourly --mode incremental --previous-backup /backup/latest --verify
```

## Project Structure

```
FamilyBridge-Photos/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Photos/
│   │   │       └── PhotosPage.tsx       # Main photo gallery page
│   │   ├── components/
│   │   │   ├── photos/
│   │   │   │   ├── PhotoUpload.tsx      # Image upload component
│   │   │   │   ├── PhotoCalendar.tsx    # Calendar-based photo browser
│   │   │   │   └── photoCalendar.css    # Calendar styles
│   │   │   └── elderly/
│   │   │       ├── LargeButton.tsx      # High-contrast large buttons
│   │   │       └── SidebarNav.tsx       # Accessible sidebar navigation
│   │   └── api/
│   │       └── services.ts             # Authenticated API client
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── routers/
│   │       ├── __init__.py
│   │       └── backup.py               # Backup API endpoints
│   └── scripts/
│       └── backup_sync.py              # CLI backup tool (rsync)
├── styles/
│   └── elderphoto.css                  # Global accessible styles
├── ELDERPHOTO_README.md                # Accessibility design notes
├── IMPLEMENTATION_SUMMARY.md           # WCAG contrast verification
└── README.md
```

## Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| React 18+ | UI framework |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| Axios | HTTP client with interceptors |
| react-calendar | Interactive calendar component |
| Tailwind CSS | Utility-first styling |

### Backend

| Technology | Purpose |
|------------|---------|
| Python 3.11+ | Runtime |
| FastAPI | Async web framework |
| Uvicorn | ASGI server |
| rsync | Backup synchronization |
| argparse | CLI argument parsing |

## Design Principles

### 1. Elder-First Design
Every UI decision prioritizes elderly users:
- **Large touch targets**: Minimum 48px interactive elements
- **High contrast**: 8.63:1 ratio exceeds WCAG AAA requirements
- **Clear typography**: Semi-bold labels, system fonts, generous spacing
- **Simple navigation**: Flat hierarchy, obvious labels, no hidden menus
- **Feedback**: Explicit success/error messages, never silent failures

### 2. Privacy by Default
- Self-hosted: no external data sharing
- Authenticated access: every image request requires a valid token
- Signed URLs: time-limited access tokens for image delivery
- No analytics: no tracking, no telemetry

### 3. Reliability
- Automated backups: never lose a photo
- Incremental snapshots: space-efficient backup history
- Verification: checksum-based validation after every sync
- Idempotent operations: safe to run backups repeatedly

### 4. Simplicity
- Minimal dependencies
- No database required for basic operation
- File-system-based storage
- CLI tools for automation

## Security

### Authentication Flow

1. User logs in and receives a JWT token
2. Token is stored in `localStorage`
3. Axios interceptor attaches `Authorization: Bearer <token>` to every request
4. Backend validates the token before serving any content

### Image Security

Images are never exposed as public URLs. Two secure delivery methods are supported:

1. **Signed URLs**: Backend generates time-limited URLs. The frontend requests a signed URL and uses it in `<img>` tags. URLs expire after a configured duration.

2. **Authenticated Proxy**: The frontend fetches image data as a blob through the authenticated API client, then creates a local `objectURL` for rendering. This ensures Authorization headers accompany every image request.

### Path Security

Image paths are normalized and encoded before being sent to the API:
- Leading slashes are stripped
- Path segments are individually URL-encoded
- Empty segments are filtered out

## Troubleshooting

### Common Issues

**Photos not displaying**
- Verify the backend is running and accessible
- Check that the `VITE_API_URL` points to the correct backend address
- Confirm the authentication token is valid (check browser localStorage)
- Inspect the browser console for 401/403 errors

**Upload failing**
- Ensure the file is a supported image format (JPEG, PNG, WebP, GIF, HEIC)
- Check backend logs for storage permission issues
- Verify the upload endpoint is accessible

**Calendar not showing photo counts**
- Confirm the `monthData` prop contains correctly formatted ISO-8601 dates (`YYYY-MM-DD`)
- Check that photo data is being fetched from the API

**Backup verification failing**
- Ensure rsync is installed (`which rsync`)
- Check source and destination paths exist and are accessible
- Review rsync stderr output in the error message for specifics
- Ensure sufficient disk space at the destination

**Large buttons not rendering correctly**
- Verify Tailwind CSS classes are being processed
- Check that the Inter font is loaded (falls back to system-ui)

### Backend Logs

The backup service logs to Python's standard logging. To increase verbosity:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## License

This project is provided as-is for personal and family use.

## Contributing

Contributions are welcome, especially improvements to accessibility and elder-friendly design patterns.

## Support

For issues and feature requests, please open an issue on the GitHub repository.
