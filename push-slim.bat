@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set "ROOT=%CD%"

echo.
echo  ==========================================================
echo   BA Student Dex - SLIM push  (~45 MB, only what CI needs)
echo  ==========================================================
echo.
echo   This pushes ONLY the iOS project + workflow, so the upload
echo   is 3x smaller than the full repo and much more likely to
echo   survive an unstable connection to GitHub.
echo.
echo   The resulting repo still builds a complete IPA: all data,
echo   avatars and portraits are inside StudentDex/Resources/Web.
echo.

set /p REPO=Repo URL (https://github.com/user/repo.git): 
if "%REPO%"=="" goto empty

echo.
echo  [1/3] exporting StudentDex + .github (no network)...
set "WORK=%TEMP%\ba-slim"
if exist "%WORK%" rmdir /s /q "%WORK%"
mkdir "%WORK%"
git archive --format=tar -o "%WORK%\src.tar" HEAD StudentDex .github README.md
if errorlevel 1 goto archivefail
cd /d "%WORK%"
tar -xf src.tar
if errorlevel 1 goto archivefail
del src.tar
echo        done

echo  [2/3] creating local commit...
git init -b main >nul 2>&1
git add -A
git -c user.name="ba-dex" -c user.email="ba-dex@local" commit -q -m "BA Student Dex - build sources"
if errorlevel 1 goto fail
git remote remove origin >nul 2>&1
git remote add origin %REPO%
git config http.postBuffer 524288000
git config http.version HTTP/1.1

set /a TRY=0
:push
set /a TRY+=1
echo.
echo  [3/3] pushing (attempt %TRY%/3, a browser window may open for
echo        GitHub sign-in)...
echo.
git push -u origin main
if not errorlevel 1 goto done
if %TRY% GEQ 3 goto pushfail
echo   ... interrupted, retrying in 15s
timeout /t 15 >nul
goto push

:done
echo.
echo  ==========================================================
echo   PUSHED. Open your repository -^> Actions -^> "Build unsigned IPA"
echo   wait 3-5 min, download artifact "StudentDex-unsigned-ipa".
echo  ==========================================================
echo.
pause
exit /b 0

:empty
echo  Repo URL is empty - nothing done.
pause
exit /b 1

:archivefail
echo  [x] git archive failed. Nothing was pushed.
cd /d "%ROOT%"
pause
exit /b 1

:fail
echo  [x] local git init failed. Nothing was pushed.
pause
exit /b 1

:pushfail
echo.
echo  [x] Push failed 3 times - the link to GitHub is still unstable.
echo      Turn on your own VPN (the one you normally use), confirm that
echo      https://github.com opens in the browser, then run this again.
echo.
pause
exit /b 1
