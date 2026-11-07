@echo off
rem ---------------------------------------------------------------------------
rem  Detect a working route to github.com and expose:
rem     GIT_PROXY_ARG   e.g. -c http.proxy=http://127.0.0.1:7890 -c https.proxy=...
rem     ROUTE           human readable description
rem  Must be called from a script that already enabled delayed expansion.
rem  NOTE: deliberately no setlocal, the variables are meant to leak to caller.
rem ---------------------------------------------------------------------------
set "GIT_PROXY_ARG="
set "ROUTE="
set "OK="

rem 1) direct
call :probe ""
if defined OK goto :eof

rem 2) HTTPS_PROXY / HTTP_PROXY environment variables
if defined HTTPS_PROXY call :probe "%HTTPS_PROXY%"
if defined OK goto :eof
if defined HTTP_PROXY call :probe "%HTTP_PROXY%"
if defined OK goto :eof

rem 3) Windows system proxy (Clash "system proxy" writes here)
set "SYS="
set "EN="
for /f "tokens=1,2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable 2^>nul ^| find /i "ProxyEnable"') do set "EN=%%C"
for /f "tokens=1,2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer 2^>nul ^| find /i "ProxyServer"') do set "SYS=%%C"
if /I "%EN%"=="0x1" if defined SYS call :probe "http://%SYS%"
if defined OK goto :eof

rem 4) common local proxy ports
for %%P in (7890 7891 7897 1080 2080 8080 5335) do (
    if not defined OK call :probe "http://127.0.0.1:%%P"
)
goto :eof

:probe
set "PCODE="
if "%~1"=="" (
    for /f "delims=" %%C in ('curl -sS -o NUL -w "%%{http_code}" --max-time 6 https://github.com 2^>nul') do set "PCODE=%%C"
) else (
    for /f "delims=" %%C in ('curl -sS -o NUL -w "%%{http_code}" --max-time 6 -x "%~1" https://github.com 2^>nul') do set "PCODE=%%C"
)
if "!PCODE!"=="200" (
    set "OK=1"
    if "%~1"=="" (
        set "ROUTE=direct (no proxy)"
    ) else (
        set "ROUTE=proxy %~1"
        set "GIT_PROXY_ARG=-c http.proxy=%~1 -c https.proxy=%~1"
    )
)
goto :eof
