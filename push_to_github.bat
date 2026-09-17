@echo off
chcp 65001 >nul
title Push TM to GitHub Pages
cls
echo ====================================================================
echo                 Push TM to GitHub Pages
echo ====================================================================
echo.
echo 1. Make sure you created a new repository on GitHub (Public).
echo 2. Copy the repo URL (e.g. https://github.com/Username/TM.git)
echo.
set /p REPO_URL=Enter GitHub Repository URL: 

if "%REPO_URL%"=="" (
    echo No URL provided. Exiting...
    pause
    exit /b 1
)

git remote remove origin 2>nul
git remote add origin %REPO_URL%
echo.
echo Pushing code to GitHub (main branch)...
git push -u origin main
if %errorlevel% equ 0 (
    echo.
    echo ====================================================================
    echo    Successfully pushed to GitHub!
    echo ====================================================================
    echo.
    echo Next Step on GitHub.com:
    echo  1. Open your repository on GitHub.com
    echo  2. Go to Settings -^> Pages
    echo  3. Under Source, choose "GitHub Actions" (or Deploy from branch -^> /docs)
    echo.
    echo Your HTTPS site will be ready in 1 minute!
) else (
    echo.
    echo Push failed. Please check your GitHub credentials or repository URL.
)
echo.
pause