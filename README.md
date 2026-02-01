<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ZxJ354NyPZQcWB9WkqM5JquC1JNMLShH

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Build a Windows .exe (Electron)

This project can be packaged as a Windows installer using Electron Builder.

### Local build (Windows recommended)

1. Install dependencies:
   `npm install`
2. Build the installer:
   `npm run build:app`
3. Find the installer in:
   `release/Secure-Deployment-Runner-Setup-<version>.exe`

### GitHub Actions artifact

On pushes to `main`, pull requests, or when manually triggered, the workflow **Build Windows EXE**
creates a Windows installer and uploads it as a workflow artifact. Download it from
the workflow run page under **Artifacts**.
