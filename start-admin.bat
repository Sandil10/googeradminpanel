@echo off
setlocal

set "ROOT=%~dp0"
set "MAIN_APP_DIR=D:\googer-recovery-code\googernew-main"
set "MAIN_TUNNEL_CONFIG=%MAIN_APP_DIR%\config.yml"
set "TUNNEL_ID=70dad40c-325d-41c2-a3c7-ccf45815a215"
set "ADMIN_URL=https://appadmin.infranex.it.com"
set "LOCAL_URL=http://127.0.0.1:6001"
set "API_URL=http://127.0.0.1:3001"
set "CLOUDFLARED_CMD="

where cloudflared >nul 2>nul
if not errorlevel 1 set "CLOUDFLARED_CMD=cloudflared"

if not defined CLOUDFLARED_CMD if exist "%MAIN_APP_DIR%\cloudflared.exe" (
  set "CLOUDFLARED_CMD=%MAIN_APP_DIR%\cloudflared.exe"
)
if not defined CLOUDFLARED_CMD if exist "C:\Users\Administrator\Desktop\Googer Launchers\tools\cloudflared.exe" (
  set "CLOUDFLARED_CMD=C:\Users\Administrator\Desktop\Googer Launchers\tools\cloudflared.exe"
)
if not defined CLOUDFLARED_CMD if exist "%USERPROFILE%\.cloudflared\cloudflared.exe" (
  set "CLOUDFLARED_CMD=%USERPROFILE%\.cloudflared\cloudflared.exe"
)
if not defined CLOUDFLARED_CMD (
  echo cloudflared not found.
  pause
  exit /b 1
)

echo Stopping old admin panel processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*googeradminpanel*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }"
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":6001 "') do taskkill /F /PID %%P >nul 2>nul
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":3001 "') do taskkill /F /PID %%P >nul 2>nul

echo Preparing admin panel live-reload mode...
if exist "%ROOT%.next\dev\lock" del /f /q "%ROOT%.next\dev\lock" >nul 2>nul

echo Starting Admin API server on port 3001...
start "Googer Admin API" cmd /k "cd /d "%ROOT%" && set "PORT=3001" && set "BACKEND_URL=http://127.0.0.1:3001" && npm run server"
timeout /t 4 /nobreak >nul

echo Starting Admin Panel with hot reload on port 6001...
start "Googer Admin Panel" cmd /k "cd /d "%ROOT%" && set "BACKEND_URL=http://127.0.0.1:3001" && set CHOKIDAR_USEPOLLING=1&& set WATCHPACK_POLLING=true&& npm run client"

echo Starting shared Cloudflare named tunnel...
start "Googer Admin Tunnel" cmd /k "cd /d "%MAIN_APP_DIR%" && "%CLOUDFLARED_CMD%" tunnel --config "%MAIN_TUNNEL_CONFIG%" run %TUNNEL_ID%"

echo Waiting for admin panel port 6001...
set /a ADMIN_WAIT=0
:wait_admin_ready
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ready = Test-NetConnection -ComputerName 127.0.0.1 -Port 6001 -InformationLevel Quiet; if ($ready) { exit 0 } else { exit 1 }" >nul 2>nul
if not errorlevel 1 goto admin_ready
set /a ADMIN_WAIT+=1
if %ADMIN_WAIT% GEQ 90 (
  echo [WARN] Admin panel did not become ready within 90 seconds.
  goto admin_ready
)
timeout /t 1 /nobreak >nul
goto wait_admin_ready
:admin_ready

echo.
echo API    : %API_URL%
echo Panel  : %LOCAL_URL%
echo Public : %ADMIN_URL%
echo.
start "" "%LOCAL_URL%"
start "" "%ADMIN_URL%"
echo Admin panel is running. You can close this launcher window.
pause

endlocal
