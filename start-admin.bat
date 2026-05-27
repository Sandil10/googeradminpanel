@echo off
setlocal

set "ROOT=%~dp0"
set "ADMIN_URL=https://appadmin.infranex.it.com"

echo Stopping old admin panel processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$targets = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*googeradminpanel*' }; " ^
  "foreach ($proc in $targets) { try { Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop } catch {} }"

echo Clearing stale lock file...
if exist "%ROOT%.next\dev\lock" del /f /q "%ROOT%.next\dev\lock" >nul 2>nul

echo Starting Admin API server on port 3002...
start "Googer Admin API"    cmd /k "cd /d "%ROOT%" && npm run server"

echo Waiting for API to start...
timeout /t 3 >nul

echo Starting Admin Panel on port 6001...
start "Googer Admin Panel"  cmd /k "cd /d "%ROOT%" && npm run client"

echo.
echo   API    : http://localhost:3002
echo   Panel  : http://localhost:6001
echo   Public : %ADMIN_URL%
echo.
echo Opening admin panel in 8 seconds...
timeout /t 8 >nul
start "" "%ADMIN_URL%/admin/referrals"
echo You can close this window.

endlocal
