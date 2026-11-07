@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo  ==========================================================
echo   BA Student Dex - push to GitHub and build the IPA
echo  ==========================================================
echo.

echo  [0/3] looking for a route to github.com ...
call "%~dp0proxy-detect.bat"
if not defined OK (
    echo.
    echo   [x] Cannot reach github.com - neither directly nor through a
    echo       local proxy.
    echo.
    echo   Turn on your Clash / V2Ray client first ^(check that
    echo   https://github.com opens in the browser^), then run again.
    echo.
    pause
    exit /b 1
)
echo        route: !ROUTE!

echo.
echo  [1/3] enter your repository URL
echo        (created at https://github.com/new, must be EMPTY)
echo        example: https://github.com/yourname/ba-student-dex.git
echo.
set /p REPO=Repo URL: 
if "%REPO%"=="" goto empty

echo.
echo  [2/3] configuring remote ...
git remote remove origin >nul 2>&1
git remote add origin %REPO%
if errorlevel 1 goto fail
git branch -M main
if errorlevel 1 goto fail
git config http.postBuffer 524288000
git config http.version HTTP/1.1

if "%DRYRUN%"=="1" (
    echo.
    echo  [dry-run] would run:  git !GIT_PROXY_ARG! push -u origin main
    echo  [dry-run] nothing was pushed.
    exit /b 0
)

set /a TRY=0

:push
set /a TRY+=1
echo.
echo  [3/3] pushing (~150 MB, several minutes; a browser window may
echo        open so you can sign in to GitHub)  attempt %TRY%/3 ...
echo.
git !GIT_PROXY_ARG! push -u origin main
if not errorlevel 1 goto success
if %TRY% GEQ 3 goto allfailed
echo.
echo   ... interrupted. Waiting 15s, then retrying...
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
echo  [x] Push failed 3 times.
echo      - if it says "could not read Username": the GitHub sign-in
echo        window did not complete, run again and finish the login
echo      - if it times out: the proxy node is unstable, switch node
echo        or use push-slim.bat (35 MB instead of 150 MB)
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
echo  FAILED while configuring the remote. Check the URL ends with .git
echo.
pause
exit /b 1
