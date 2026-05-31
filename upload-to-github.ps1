param(
    [Parameter(Mandatory=$true)]
    [string]$Token,
    [Parameter(Mandatory=$false)]
    [string]$RepoName = "pipi-judge"
)

$ErrorActionPreference = "Stop"
$ProjectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Step 1: Creating GitHub Repo" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Create repo via API
$repoBody = @{
    name = $RepoName
    description = "Pipi Judge - AI couples dispute resolution WeChat mini-program"
    "private" = $false
    auto_init = $false
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers @{
        Authorization = "token $Token"
        Accept = "application/vnd.github.v3+json"
    } -Body $repoBody -ContentType "application/json"
    Write-Host "[OK] Repo created: https://github.com/$($response.owner.login)/$($response.name)`n" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 422) {
        Write-Host "[OK] Repo already exists, skipping creation`n" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to create repo: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Step 2: Uploading files" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Files to skip
$skipFiles = @(
    ".gitignore",
    "push-to-github.ps1",
    "project.private.config.json"
)

$skipDirs = @(
    "node_modules",
    ".git"
)

$baseUri = "https://api.github.com/repos/424174740-lgtm/$RepoName/contents"

function Upload-File {
    param($LocalPath, $ApiPath)

    Write-Host "   Uploading: $ApiPath" -ForegroundColor Gray

    # Read file as bytes and base64 encode
    $bytes = [System.IO.File]::ReadAllBytes($LocalPath)
    $base64 = [Convert]::ToBase64String($bytes)

    # Check if file exists (for nested paths, we need the parent to exist first)
    $commitMsg = if ($ApiPath -match "(.+)\/(.+)$") {
        "Add $($matches[2])"
    } else {
        "Add $ApiPath"
    }

    $body = @{
        message = $commitMsg
        content = $base64
        branch = "main"
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$baseUri/$ApiPath" -Method Put -Headers @{
            Authorization = "token $Token"
            Accept = "application/vnd.github.v3+json"
        } -Body $body -ContentType "application/json" | Out-Null
        Write-Host "   [OK]" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "   [ERROR] $_" -ForegroundColor Red
        return $false
    }
}

# Get all files recursively
$allFiles = Get-ChildItem -Path $ProjectPath -Recurse -File | Where-Object {
    $shouldSkip = $false
    foreach ($skip in $skipFiles) {
        if ($_.Name -eq $skip) { $shouldSkip = $true; break }
    }
    foreach ($skip in $skipDirs) {
        if ($_.DirectoryName -match "\\$skip\\" -or $_.DirectoryName -match "\\$skip$") { $shouldSkip = $true; break }
    }
    -not $shouldSkip
}

$total = $allFiles.Count
$current = 0
$successCount = 0
$failCount = 0

foreach ($file in $allFiles) {
    $current++
    $percent = [math]::Round(($current / $total) * 100)
    Write-Host "[$current/$total] ($percent%) " -NoNewline -ForegroundColor Yellow

    # Calculate API path (relative to project directory, use forward slashes)
    $relativePath = $file.FullName.Substring($ProjectPath.Length + 1)
    $apiPath = $relativePath -replace "\\", "/"

    if (Upload-File -LocalPath $file.FullName -ApiPath $apiPath) {
        $successCount++
    } else {
        $failCount++
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Total: $total | Succeeded: $successCount | Failed: $failCount" -ForegroundColor White
Write-Host "   Repo: https://github.com/424174740-lgtm/$RepoName" -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host "`n   Next: Open https://openai.com/zh-Hans-CN/form/codex-for-oss/ to apply!" -ForegroundColor Green
}

Read-Host "`nPress Enter to exit"
