@echo off
setlocal

set "ROOT=%~dp0"
set "MAIN_APP_DIR=C:\Users\Administrator\Documents\new\googernew-main"
set "MAIN_TUNNEL_CONFIG=%MAIN_APP_DIR%\config.yml"
set "TUNNEL_ID=70dad40c-325d-41c2-a3c7-ccf45815a215"
set "ADMIN_URL=https://appadmin.infranex.it.com"
set "LOCAL_URL=http://localhost:6001"
set "API_URL=http://localhost:3002"
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
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":3002 "') do taskkill /F /PID %%P >nul 2>nul

echo Clearing stale admin frontend build output...
if exist "%ROOT%.next" rd /s /q "%ROOT%.next" >nul 2>nul

echo Starting Admin API server on port 3002...
start "Googer Admin API" cmd /k "cd /d "%ROOT%" && set "BACKEND_URL=http://localhost:3002" && npm run start"
timeout /t 4 /nobreak >nul

echo Building Admin Panel for preview...
call cmd /c "cd /d "%ROOT%" && set "BACKEND_URL=http://localhost:3002" && npm run build"
if errorlevel 1 (
  echo Admin panel build failed.
  pause
  exit /b 1
)

echo Starting Admin Panel on port 6001...
start "Googer Admin Panel" cmd /k "cd /d "%ROOT%" && set "BACKEND_URL=http://localhost:3002" && npm run client:start"

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
