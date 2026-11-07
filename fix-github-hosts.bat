@echo off
setlocal EnableDelayedExpansion
set "HOSTS=%WINDIR%\System32\drivers\etc\hosts"
set "MARKER=# ba-student-dex github.com override"

net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [x] Administrator rights are required.
    echo      A UAC prompt will appear - please click "Yes".
    echo.
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

if /I "%~1"=="-remove" goto uninstall

echo.
echo  ==========================================================
echo   Fix github.com connectivity (hosts override)
echo  ==========================================================
echo.
echo  Probing GitHub edge IPs, this may take ~20 seconds...
echo.

set "CHOSEN="
for %%I in (20.27.177.113 140.82.121.4 140.82.112.4 140.82.114.4 140.82.113.4) do (
    if not defined CHOSEN (
        set "CODE="
        for /f "delims=" %%C in ('curl -sS -o NUL -w "%%{http_code}" --max-time 6 --resolve github.com:443:%%I https://github.com 2^>nul') do set "CODE=%%C"
        if "!CODE!"=="200" (
            set "CHOSEN=%%I"
            echo    %%I  ... OK
        ) else (
            echo    %%I  ... unreachable
        )
    )
)

if not defined CHOSEN (
    echo.
    echo  [x] None of the GitHub IPs are reachable from this network.
    echo      Please turn on a VPN / Cloudflare WARP and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo  Selected IP: !CHOSEN!
copy /Y "%HOSTS%" "%HOSTS%.bak" >nul

findstr /V /C:"ba-student-dex" /C:" github.com" "%HOSTS%" > "%TEMP%\hosts.new"
copy /Y "%TEMP%\hosts.new" "%HOSTS%" >nul
del "%TEMP%\hosts.new" >nul 2>&1

echo.>>"%HOSTS%"
echo %MARKER%>>"%HOSTS%"
echo !CHOSEN! github.com>>"%HOSTS%"

ipconfig /flushdns >nul

echo.
echo  Verifying...
for /f "delims=" %%C in ('curl -sS -o NUL -w "%%{http_code} %%{time_total}s" --max-time 15 https://github.com 2^>nul') do set "RESULT=%%C"
echo    https://github.com  ->  !RESULT!
echo.
echo  [OK] Done. Original hosts file backed up to:
echo       %HOSTS%.bak
echo.
echo  Now run push-to-github.bat again.
echo  (To undo later: run this file with  -remove  parameter)
echo.
pause
exit /b 0

:uninstall
echo.
echo  Removing the github.com override...
copy /Y "%HOSTS%" "%HOSTS%.bak" >nul
findstr /V /C:"ba-student-dex" /C:" github.com" "%HOSTS%" > "%TEMP%\hosts.new"
copy /Y "%TEMP%\hosts.new" "%HOSTS%" >nul
del "%TEMP%\hosts.new" >nul 2>&1
ipconfig /flushdns >nul
echo  [OK] Removed. A backup is kept at %HOSTS%.bak
echo.
pause
exit /b 0
