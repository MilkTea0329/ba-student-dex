@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo  ==========================================================
echo   BA Student Dex - push to GitHub and build the IPA
echo  ==========================================================
echo.

echo  [0/3] checking connectivity to github.com...
set "CODE="
for /f "delims=" %%C in ('curl -sS -o NUL -w "%%{http_code}" --max-time 12 https://github.com 2^>nul') do set "CODE=%%C"
if not "!CODE!"=="200" (
    echo.
    echo   [x] github.com is NOT reachable  ^(HTTP: !CODE!^)
    echo.
    echo   Your DNS points github.com at an IP this network cannot reach.
    echo   Do ONE of the following, then run this script again:
    echo.
    echo     A. Double-click  fix-github-hosts.bat  in this folder
    echo        ^(a UAC prompt appears - click Yes^). It picks a working
    echo        GitHub IP and writes it into your hosts file.
    echo.
    echo     B. Turn on your VPN / Cloudflare WARP and retry.
    echo.
    pause
    exit /b 1
)
echo        OK

echo.
echo  [1/3] enter your repository URL
echo        (created at https://github.com/new, must be EMPTY)
echo        example: https://github.com/yourname/ba-student-dex.git
echo.
set /p REPO=Repo URL: 
if "%REPO%"=="" goto empty

echo.
echo  [2/3] configuring remote...
git remote remove origin >nul 2>&1
git remote add origin %REPO%
if errorlevel 1 goto fail
git branch -M main
if errorlevel 1 goto fail
git config http.postBuffer 524288000
git config http.version HTTP/1.1

set /a TRY=0

:push
set /a TRY+=1
echo.
echo  [3/3] pushing (~150 MB, several minutes; a browser window may
echo        open so you can sign in to GitHub)  attempt %TRY%/3 ...
echo.
git push -u origin main
if not errorlevel 1 goto success
if %TRY% GEQ 3 goto allfailed
echo.
echo   ... interrupted. Waiting 15s, then retrying (%TRY%/3 failed^)...
timeout /t 15 >nul
goto push

:success
echo.
echo  ==========================================================
echo   DONE. Open your repository page on GitHub -^> Actions,
echo   wait 3-5 minutes, then download the artifact
echo   "StudentDex-unsigned-ipa" from the finished run.
echo  ==========================================================
echo.
pause
exit /b 0

:allfailed
echo.
echo  [x] Push failed 3 times - the link to GitHub is too unstable.
echo.
echo      Most reliable fix: turn on your VPN / Cloudflare WARP
echo      (check https://github.com opens in the browser), then run
echo      this script again. Or double-click fix-github-hosts.bat.
echo.
pause
exit /b 1

:empty
echo.
echo  Repo URL is empty - nothing done.
pause
exit /b 1

:fail
echo.
echo  FAILED while configuring the remote. Check that the URL ends with .git
echo.
pause
exit /b 1
