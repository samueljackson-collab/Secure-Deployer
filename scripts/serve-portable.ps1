#Requires -Version 5.1
<#
.SYNOPSIS
    Secure Deployment Runner — PowerShell HTTP server (USB portable)
.DESCRIPTION
    Serves the built dist/ folder using System.Net.HttpListener.
    Falls back when Python is not available. Works on Windows 10/11
    with no additional software installed.
.PARAMETER Port
    TCP port to listen on. Default: 3000
.PARAMETER DistPath
    Absolute path to the dist/ folder to serve. Default: auto-detected
    from script location (../dist relative to scripts/).
.EXAMPLE
    .\serve-portable.ps1
    .\serve-portable.ps1 -Port 8080
    .\serve-portable.ps1 -Port 3000 -DistPath "D:\dist"
#>

param(
    [int]$Port = 3000,
    [string]$DistPath = ""
)

$ErrorActionPreference = 'Stop'

# Resolve dist path
if ([string]::IsNullOrEmpty($DistPath)) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $DistPath  = Join-Path $ScriptDir "..\dist"
    $DistPath  = (Resolve-Path $DistPath -ErrorAction SilentlyContinue)?.Path
}

if (-not $DistPath -or -not (Test-Path $DistPath)) {
    Write-Host "[ERROR] dist/ folder not found at: $DistPath" -ForegroundColor Red
    Write-Host "        Run 'npm run build' first to generate dist/." -ForegroundColor Yellow
    exit 1
}

$BaseUrl = "http://localhost:$Port/"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Secure Deployment Runner - PowerShell HTTP Server" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Serving : $DistPath"
Write-Host "  URL     : $BaseUrl"
Write-Host "  Stop    : Press Ctrl+C"
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Open browser
Start-Process $BaseUrl

# MIME type map
$MimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css'
    '.js'   = 'application/javascript'
    '.mjs'  = 'application/javascript'
    '.json' = 'application/json'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.webmanifest' = 'application/manifest+json'
}

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($BaseUrl)
$Listener.Start()

Write-Host "[INFO] Listening on $BaseUrl" -ForegroundColor Green

try {
    while ($Listener.IsListening) {
        $Context  = $Listener.GetContext()
        $Request  = $Context.Request
        $Response = $Context.Response

        $RawPath = $Request.Url.LocalPath -replace '/', [System.IO.Path]::DirectorySeparatorChar
        $FilePath = Join-Path $DistPath $RawPath.TrimStart([System.IO.Path]::DirectorySeparatorChar)

        # Default to index.html for SPA routing
        if ((Test-Path $FilePath -PathType Container) -or -not (Test-Path $FilePath)) {
            $FilePath = Join-Path $DistPath 'index.html'
        }

        if (Test-Path $FilePath) {
            $Ext         = [System.IO.Path]::GetExtension($FilePath).ToLower()
            $ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { 'application/octet-stream' }
            $Content     = [System.IO.File]::ReadAllBytes($FilePath)

            $Response.ContentType   = $ContentType
            $Response.ContentLength64 = $Content.Length
            $Response.StatusCode    = 200
            $Response.OutputStream.Write($Content, 0, $Content.Length)
        } else {
            $Response.StatusCode = 404
            $NotFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $Response.ContentLength64 = $NotFound.Length
            $Response.OutputStream.Write($NotFound, 0, $NotFound.Length)
        }

        $Response.OutputStream.Close()
    }
} finally {
    $Listener.Stop()
    Write-Host "[INFO] Server stopped." -ForegroundColor Yellow
}
