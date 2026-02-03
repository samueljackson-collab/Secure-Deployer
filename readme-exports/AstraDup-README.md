# AstraDup: Cross-Storage AI Deduplication Tracker

AstraDup is a cross-storage duplication tracker for videos, images, and documents. It provides an AI-assisted workflow to scan multiple storage sources, compare duplicate candidates, and enrich metadata so you can confidently reclaim space without losing important files.

## Table of Contents

- [Overview](#overview)
- [Key Capabilities](#key-capabilities)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Configuration Categories](#configuration-categories)
  - [Scan Types](#scan-types)
  - [Storage Sources](#storage-sources)
  - [AI Analysis Tools](#ai-analysis-tools)
  - [Comparison and Resolution](#comparison-and-resolution)
  - [Settings](#settings)
- [Generated Output and Data Flow](#generated-output-and-data-flow)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [API Configuration](#api-configuration)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

AstraDup is designed to help teams reduce duplicate media across local drives, NAS devices, and cloud providers. It goes beyond basic file hashing by combining multi-modal signals (hashes, embeddings, and metadata) with AI-assisted enrichment to identify real duplicates, even when files are re-encoded, renamed, or lightly edited.

Core workflow:

1. Select the file type to scan (video, image, or document).
2. Choose storage sources to include in the scan.
3. Review duplicates, compare files side-by-side, and decide what to keep.
4. Use AI tools to enrich metadata or analyze content when needed.

## Key Capabilities

- **Multi-type scans**: Separate flows for videos, images, and documents.
- **Cross-storage coverage**: Local drives, NAS, and popular cloud providers.
- **Duplicate comparison**: Side-by-side detail views with similarity signals.
- **AI Analyzer**: Image, video, and web analysis powered by large language models.
- **Metadata enrichment**: Suggested titles, plots, genres, and actors for videos.
- **Operational safeguards**: Confirmation dialogs before destructive actions.

## System Requirements

- **Node.js**: 18.x or higher
- **Modern browser**: Latest Chrome, Edge, Firefox, or Safari
- **API key**: Required for AI-powered analysis features

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/samueljackson-collab/AstraDup-Cross-Storage-Video-Files-duplication-tracker.git astra-dup
   cd astra-dup
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API key**

   Create a `.env.local` file in the project root:
   ```bash
   VITE_API_KEY=your_api_key_here
   ```

4. **Run the app**
   ```bash
   npm run dev
   ```

5. **Open your browser** at the URL shown in the terminal (typically `http://localhost:3000`).

### Production Build

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Getting Started

### Quick Start

1. Open the app and go to **Duplicate Scan**.
2. Pick **Videos**, **Images**, or **Documents**.
3. Select storage sources to scan (local, NAS, or cloud).
4. Start the scan and review duplicate sets.
5. Compare pairs and decide which file to keep.

### Example Workflow

**Goal**: Clean up duplicate videos across a NAS and cloud storage.

1. Go to **Duplicate Scan** and select **Videos**.
2. Choose **NAS** and your cloud provider as sources.
3. Start the scan and wait for results.
4. Use the comparison view to inspect metadata and similarity signals.
5. Keep the best-quality version and remove the rest.

## Usage Guide

### Interface Overview

| Page | Purpose |
|------|---------|
| **Dashboard** | Snapshot of scan statistics and recent activity |
| **Duplicate Scan** | Step-by-step scan flow (type, sources, scan, results) |
| **Comparison** | Deep dive into a specific duplicate pair with side-by-side details |
| **AI Analyzer** | Standalone image, video, and web analysis tools |
| **Settings** | Configure detection thresholds, performance, and metadata sources |
| **File Detail** | Detailed view of a single file with metadata and history |
| **Video Detail** | Extended detail view for video files with frame analysis |

### Duplicate Scan Flow

The scan operates in four sequential steps:

1. **Select File Type**: Choose Videos, Images, or Documents. Each file type uses different detection strategies optimized for that media format.

2. **Choose Storage Sources**: Toggle which storage locations to include in the scan. You can combine local drives, NAS shares, and cloud providers in a single scan to find cross-storage duplicates.

3. **Run Scan**: The scanner processes selected sources and identifies duplicate candidates. A progress indicator and estimated time remaining are displayed during the scan.

4. **Review Results**: Inspect duplicate pairs grouped by similarity. Navigate to the comparison view for side-by-side analysis, or click into file detail pages for deeper inspection.

### Comparison View

The comparison page shows two candidate files side by side with:

- **File metadata**: Resolution, codec, duration, file size, creation date
- **Similarity signals**: Hash matches, perceptual similarity scores, metadata overlap
- **Confidence meters**: Visual indicators of how likely the files are true duplicates
- **Action buttons**: Keep or delete with confirmation prompts before any destructive action

### AI Analyzer

The AI Analyzer provides three standalone analysis tools:

- **Image Analysis**: Upload a still image and ask natural language questions about its content, composition, or subject matter.
- **Video Analysis**: Upload a video file, extract representative frames, and generate summaries, scene descriptions, or content tags.
- **Web Analysis**: Submit a question and retrieve grounded web results with AI-generated summaries.

### Dashboard

The dashboard provides an at-a-glance overview of:

- Total files scanned across all sources
- Number of duplicate sets identified
- Storage space potentially reclaimable
- Recent scan history with status indicators

## Configuration Categories

### Scan Types

| Type | Focus | Detection Signals |
|------|-------|-------------------|
| Video | Video files (MP4, MKV, AVI, MOV, etc.) | Perceptual hash (pHash), difference hash (dHash), scene embeddings, audio fingerprint, face clusters |
| Image | Photo files (JPEG, PNG, HEIC, RAW, etc.) | Perceptual hash (pHash), difference hash (dHash), EXIF metadata, object tags |
| Document | Document files (PDF, DOCX, TXT, etc.) | Text content hash, keyword density, content similarity scoring |

### Storage Sources

| Source | Description |
|--------|-------------|
| Local Drive | Files stored on the current machine's internal or external drives |
| NAS | Network-attached storage shares accessible via SMB, NFS, or similar protocols |
| Google Drive | Cloud drive integration for scanning remote files |
| Dropbox | Cloud storage integration for Dropbox accounts |
| OneDrive | Microsoft cloud storage integration |

### AI Analysis Tools

| Tool | Description |
|------|-------------|
| Image Analysis | AI-powered image understanding with custom prompts for content, composition, and subject identification |
| Video Analysis | Frame-based AI analysis for generating summaries, scene descriptions, and content tags |
| Web Analysis | Grounded search queries for real-time answers backed by web results |

### Comparison and Resolution

When reviewing duplicate candidates, the comparison view provides:

- **Side-by-side details**: Resolution, codec, duration, bitrate, file size, and full metadata
- **Similarity signals**: Individual confidence scores for each detection method (hash, perceptual, metadata)
- **Confidence meters**: Aggregated visual indicator of overall duplicate confidence
- **Keep/delete actions**: Explicit user decisions with confirmation prompts before any file operations

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Similarity threshold | Minimum confidence score to flag files as duplicates | 80% |
| Matching modalities | Number of signals that must agree before flagging | 2 |
| Parallel workers | Number of concurrent scan threads for throughput | 4 |
| GPU acceleration | Toggle hardware-accelerated analysis for large scans | Off |
| Reference databases | External metadata sources for enrichment (IMDb, TMDb, custom APIs) | None |

## Generated Output and Data Flow

AstraDup is currently a front-end prototype with a mocked API layer for demonstration purposes. Scans, file details, and duplicate pairs are simulated so the UI workflow can be exercised without connecting to real storage backends.

### Current Architecture

```
┌──────────────────────────────────┐
│         React Frontend           │
│   (Dashboard, Scan, Compare,     │
│    Analyzer, Settings)           │
│                                  │
│   ┌──────────┐  ┌────────────┐  │
│   │   Pages   │  │ Components │  │
│   │ (7 route  │  │ (shared UI │  │
│   │  views)   │  │  elements) │  │
│   └────┬─────┘  └────────────┘  │
│        │                         │
│   ┌────┴──────────────────────┐  │
│   │      Services Layer       │  │
│   │  ┌─────────┐ ┌─────────┐ │  │
│   │  │ Mock API│ │AI Service│ │  │
│   │  │ (demo   │ │ (LLM    │ │  │
│   │  │  data)  │ │  calls)  │ │  │
│   │  └─────────┘ └─────────┘ │  │
│   └───────────────────────────┘  │
└──────────────────────────────────┘
```

### Data Flow

- **Mock data** is defined in `services/api.ts` and returned with simulated delays to mimic real API behavior
- **AI requests** call language models via `services/aiService.ts` for image, video, and web analysis
- **Delete actions** in the comparison view are UX-only (no real file operations are performed)

### Production Integration Path

To connect AstraDup to real storage backends:

1. Replace `services/api.ts` with implementations for each storage provider
2. Add authentication flows for cloud storage (OAuth for Google Drive, Dropbox, OneDrive)
3. Implement server-side hashing and similarity detection
4. Add audit logging for all delete operations
5. Wire up the settings page to persist configuration

## Project Structure

```
astra-dup/
├── App.tsx                 # Application routing and layout
├── index.tsx               # Application entry point
├── index.html              # HTML template
├── types.ts                # Shared TypeScript type definitions
├── metadata.json           # Application metadata
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
├── pages/
│   ├── Dashboard.tsx       # Scan statistics and recent activity
│   ├── ScanPage.tsx        # Step-by-step duplicate scan flow
│   ├── ComparisonPage.tsx  # Side-by-side duplicate comparison
│   ├── AnalyzerPage.tsx    # AI analysis tools (image, video, web)
│   ├── Settings.tsx        # Detection and performance configuration
│   ├── FileDetail.tsx      # Single file detail view
│   └── VideoDetail.tsx     # Extended video detail with frame analysis
├── components/             # Shared UI components
└── services/
    ├── api.ts              # Mock API layer (demo data)
    └── aiService.ts        # AI model integration
```

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool and dev server |
| AI SDK | latest | Language model integration for analysis |
| React Router | 6.23.x | Client-side routing |

## API Configuration

AstraDup uses AI language models for analysis and enrichment features. Provide an API key via environment variables:

```bash
# .env.local
VITE_API_KEY=your-api-key-here
```

If the key is missing, the UI will still load, but AI analysis requests will fail with an error message.

### Rate Limits

Be aware of API rate limits from your AI provider:
- Free tiers typically have limited requests per minute
- Consider caching analysis results for frequently compared files
- Batch enrichment requests where possible

## Troubleshooting

### Common Issues

**"VITE_API_KEY environment variable not set"**
- Ensure `.env.local` exists in the project root
- Confirm the variable name is `VITE_API_KEY`
- Restart the dev server after editing the file

**AI analysis fails**
- Validate your API key and network connectivity
- Confirm the AI model is available to your account
- Check browser console for specific error messages

**No scan results**
- The current implementation uses mock data; results are simulated
- Replace `services/api.ts` with real backend integrations to scan live data

**Upload errors in the Analyzer**
- Ensure the file type matches the selected tool (images for Image Analysis, videos for Video Analysis)
- For videos, verify the browser can decode the file format (H.264/H.265 recommended)

**Settings not persisting**
- Settings are stored in browser localStorage
- Private browsing mode may prevent persistence
- Clear localStorage if settings become corrupted

### Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| API key not set | Missing `.env.local` | Create file with `VITE_API_KEY` |
| Analysis failed | Network or API error | Check connectivity and API key |
| File not supported | Unsupported format | Use supported media formats |
| Scan timeout | Large storage source | Increase parallel workers in Settings |

## Best Practices

### Deduplication Workflow

1. **Validate before deleting**: Always review both files in the comparison view before removing anything
2. **Use AI enrichment**: Add titles and metadata before archiving to improve future searchability
3. **Start small**: Run scans on one storage source first before combining multiple sources
4. **Check similarity scores**: High confidence (90%+) indicates near-certain duplicates; lower scores may be similar but distinct files
5. **Archive before deleting**: Keep a backup of files you plan to remove until you are certain they are duplicates

### Production Deployment

- Add audit logs for all delete operations
- Implement rollback capability for accidental deletions
- Use server-side hashing for large files to avoid browser memory limits
- Connect to real storage APIs with proper OAuth authentication
- Set up scheduled scans for ongoing deduplication

### Security Considerations

- Never commit API keys to version control
- Use environment variables for all credentials
- Implement proper authentication before connecting to cloud storage
- Review cloud provider permissions carefully (read-only access is sufficient for scanning)

---

## License

This project is provided as-is for deduplication and storage management workflows.

## Contributing

Contributions are welcome. Please keep documentation updated with any UI or workflow changes.

## Support

For issues and feature requests, please open an issue on the GitHub repository.
