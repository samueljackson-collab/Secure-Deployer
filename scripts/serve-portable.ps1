<#
.SYNOPSIS
    Secure Deployment Runner - Portable Server
    Serves the built app using only PowerShell (no Python or Node required).

.USAGE
    powershell -ExecutionPolicy Bypass -File scripts\serve-portable.ps1
    powershell -ExecutionPolicy Bypass -File scripts\serve-portable.ps1 -Port 8080

.DESCRIPTION
    Starts a lightweight HTTP server using .NET HttpListener.
    Requires the dist/ folder to exist (run 'npm run build' first).
#>
param(
    [int]$Port = 3000
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DistPath  = Join-Path $ScriptDir "..\dist"
$DistPath  = [System.IO.Path]::GetFullPath($DistPath)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Secure Deployment Runner - Portable Mode" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Serving from: $DistPath" -ForegroundColor White
Write-Host "  Access at:    http://localhost:$Port" -ForegroundColor Green
Write-Host ""
Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path (Join-Path $DistPath "index.html"))) {
    Write-Host "[ERROR] dist\index.html not found." -ForegroundColor Red
    Write-Host "        Run 'npm run build' first." -ForegroundColor Red
    exit 1
}

# MIME type map
$MimeTypes = @{
    '.html'  = 'text/html; charset=utf-8'
    '.js'    = 'application/javascript'
    '.mjs'   = 'application/javascript'
    '.css'   = 'text/css'
    '.svg'   = 'image/svg+xml'
    '.png'   = 'image/png'
    '.ico'   = 'image/x-icon'
    '.json'  = 'application/json'
    '.woff'  = 'font/woff'
    '.woff2' = 'font/woff2'
    '.map'   = 'application/json'
    '.txt'   = 'text/plain'
}

# Open browser
Start-Process "http://localhost:$Port" -ErrorAction SilentlyContinue

# Start HTTP listener
$Listener = [System.Net.HttpListener]::new()
$Listener.Prefixes.Add("http://localhost:$Port/")
$Listener.Start()

Write-Host "[OK] Server started." -ForegroundColor Green

try {
    while ($Listener.IsListening) {
        $Context  = $Listener.GetContext()
        $Request  = $Context.Request
        $Response = $Context.Response

        $LocalPath = $Request.Url.LocalPath.TrimStart('/')
        if (-not $LocalPath) { $LocalPath = 'index.html' }

        $FilePath = Join-Path $DistPath $LocalPath

        # SPA fallback — serve index.html for unknown routes
        if (-not (Test-Path $FilePath -PathType Leaf)) {
            $FilePath = Join-Path $DistPath 'index.html'
        }

        $Bytes = [System.IO.File]::ReadAllBytes($FilePath)
        $Ext   = [System.IO.Path]::GetExtension($FilePath).ToLower()
        $Mime  = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { 'application/octet-stream' }

        $Response.ContentType        = $Mime
        $Response.ContentLength64    = $Bytes.Length
        $Response.Headers['Cache-Control'] = 'no-cache'
        $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
        $Response.Close()
    }
} finally {
    $Listener.Stop()
    Write-Host "[INFO] Server stopped." -ForegroundColor Yellow
}
