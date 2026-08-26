# Launches Chrome with the Chrome DevTools Protocol (CDP) remote debugging port enabled,
# pointed at https://crm.dropi.co so the auth extractor can read IndexedDB / localStorage.

Write-Host "Launching Chrome with CDP on port 9222..."

$chrome = $env:CHROME_PATH
if (-not $chrome) {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { $chrome = $c; break } }
}
if (-not $chrome) { Write-Error "Chrome not found. Set CHROME_PATH."; exit 1 }

# IMPORTANT: Use YOUR logged-in profile so GHL sessions are present.
# Change this if you keep your session under a different profile name.
$profile = $env:CDP_PROFILE
if (-not $profile) { $profile = "$env:LOCALAPPDATA\Google\Chrome\User Data\Profile 1" }

if (-not (Test-Path $profile)) {
  Write-Warning "Profile not found: $profile`nUsing default Chrome profile. A fresh Chrome may not be logged in."
  $profile = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default"
}

Write-Host "Chrome:      $chrome"
Write-Host "Profile:     $profile"
Write-Host "Target URL:  https://crm.dropi.co/"

Start-Process -FilePath $chrome -ArgumentList @(
  "--user-data-dir=`"$profile`"",
  "--remote-debugging-port=9222",
  "--no-first-run",
  "--no-default-browser-check",
  "https://crm.dropi.co/"
)

Write-Host ""
Write-Host "Chrome launched. Wait a few seconds, confirm you are logged into GHL,"
Write-Host "then run:  node extract-auth.mjs"
