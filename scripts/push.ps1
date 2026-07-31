<#
  push.ps1 — GitHub REST API push (no git CLI on this machine).

  Uploads the whole working tree as one commit on `main`:
  blobs -> tree -> commit -> update ref. Unchanged files are matched by their
  git blob SHA against the remote tree and reused, so images are not re-uploaded.

  Usage:  powershell -File scripts/push.ps1 -Message "커밋 메시지"
#>
param(
  [Parameter(Mandatory = $true)][string]$Message,
  [string]$Owner  = 'eunbi0701',
  [string]$Repo   = 'labubu',
  [string]$Branch = 'main'
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) { throw ".env not found at $envFile" }
$token = ((((Get-Content $envFile -Raw) -split 'GITHUB_TOKEN=', 2)[1] -split "`n")[0]).Trim().Trim('"').Trim("'")
if (-not $token) { throw 'GITHUB_TOKEN missing from .env' }

$api = "https://api.github.com/repos/$Owner/$Repo"
$headers = @{ Authorization = "token $token"; 'User-Agent' = 'labubu-push'; Accept = 'application/vnd.github+json' }

function Invoke-GH($Method, $Url, $Body) {
  if ($null -ne $Body) {
    Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers -ContentType 'application/json' `
      -Body ([Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 6 -Compress)))
  } else {
    Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers
  }
}

# --- collect working files (mirrors .gitignore) ---------------------------
$skipNames = @('.env', 'Thumbs.db', 'Desktop.ini', '.DS_Store', '_debug.html')
$files = Get-ChildItem -Path $root -Recurse -File -Force | Where-Object {
  $_.FullName -notmatch '\\\.git\\' -and
  $skipNames -notcontains $_.Name -and
  $_.Name -notlike '.env.*'
}
if (-not $files) { throw 'no files to push' }

# --- remote tree: path -> blob sha (to skip unchanged uploads) -------------
$remote = @{}
try {
  (Invoke-GH GET "$api/git/trees/$($Branch)?recursive=1").tree |
    Where-Object { $_.type -eq 'blob' } | ForEach-Object { $remote[$_.path] = $_.sha }
} catch { Write-Host 'remote tree unavailable — uploading every file' }

$sha1 = [Security.Cryptography.SHA1]::Create()
$entries = @()
$uploaded = 0

foreach ($f in $files) {
  $rel = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
  $bytes = [IO.File]::ReadAllBytes($f.FullName)

  # git blob id = sha1("blob <len>\0" + content)
  $header = [Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)`0")
  $buf = New-Object byte[] ($header.Length + $bytes.Length)
  [Array]::Copy($header, 0, $buf, 0, $header.Length)
  [Array]::Copy($bytes, 0, $buf, $header.Length, $bytes.Length)
  $blobSha = -join ($sha1.ComputeHash($buf) | ForEach-Object { $_.ToString('x2') })

  if ($remote[$rel] -ne $blobSha) {
    $blobSha = (Invoke-GH POST "$api/git/blobs" @{ content = [Convert]::ToBase64String($bytes); encoding = 'base64' }).sha
    $uploaded++
    Write-Host "  + $rel"
  }
  $entries += @{ path = $rel; mode = '100644'; type = 'blob'; sha = $blobSha }
}

$head = (Invoke-GH GET "$api/git/ref/heads/$Branch").object.sha
# no base_tree: the tree is exactly the working set, so deletions propagate
$tree = (Invoke-GH POST "$api/git/trees" @{ tree = $entries }).sha
$commit = (Invoke-GH POST "$api/git/commits" @{ message = $Message; tree = $tree; parents = @($head) })
Invoke-GH PATCH "$api/git/refs/heads/$Branch" @{ sha = $commit.sha } | Out-Null

Write-Host "pushed $($commit.sha.Substring(0,7)) to $Owner/$Repo@$Branch ($uploaded file(s) uploaded, $($entries.Count) tracked)"
