@echo off
setlocal
cd /d "%~dp0"

echo.
echo  ==========================================================
echo   BA Student Dex - push to GitHub and build the IPA
echo  ==========================================================
echo.
echo  1. Open https://github.com/new and create an EMPTY repo
echo     (do NOT add README / .gitignore / license)
echo  2. Paste its URL below, e.g.
echo     https://github.com/yourname/ba-student-dex.git
echo.
set /p REPO=Repo URL: 

if "%REPO%"=="" goto empty

echo.
echo  [1/2] configuring remote...
git remote remove origin >nul 2>&1
git remote add origin %REPO%
if errorlevel 1 goto fail
git branch -M main
if errorlevel 1 goto fail

echo  [2/2] pushing (~150 MB, a few minutes; a browser window may
echo        open so you can sign in to GitHub)...
echo.
git push -u origin main
if errorlevel 1 goto fail

echo.
echo  ==========================================================
echo   DONE. Open your repository page -> Actions ->
echo   "Build unsigned IPA", wait 3-5 min, then download
echo   the artifact "StudentDex-unsigned-ipa".
echo  ==========================================================
echo.
pause
exit /b 0

:empty
echo.
echo  Repo URL is empty - nothing done.
pause
exit /b 1

:fail
echo.
echo  FAILED. Check the error above (wrong URL / not signed in /
echo  network). Nothing on your device was changed.
pause
exit /b 1
