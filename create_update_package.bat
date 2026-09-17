@echo off
chcp 65001 >nul
title ساخت پکیج آپدیت برای کاربران (TM / LeadApp)
cls

echo ====================================================================
echo        در حال ساخت خودکار پکیج آپدیت برای ارسال به کاربران...
echo ====================================================================
echo.

set "PKG_DIR=%~dp0LeadApp_Update"
set "FILES_DIR=%PKG_DIR%\update_files"

echo [1/5] ایجاد پوشه‌های مقصد پکیج آپدیت...
if not exist "%PKG_DIR%" mkdir "%PKG_DIR%"
if not exist "%FILES_DIR%\src" mkdir "%FILES_DIR%\src"
if not exist "%FILES_DIR%\public\js" mkdir "%FILES_DIR%\public\js"

echo [2/5] کپی کردن دقیق فایل‌های تغییر یافته...
copy /Y "%~dp0src\server.js" "%FILES_DIR%\src\server.js" >nul
if exist "%~dp0src\vendor" xcopy /E /I /Y "%~dp0src\vendor" "%FILES_DIR%\src\vendor" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [✓] src\server.js با موفقیت کپی شد.
) else (
    echo   [X] خطا در کپی src\server.js!
)

copy /Y "%~dp0public\index.html" "%FILES_DIR%\public\index.html" >nul
if %errorlevel% equ 0 (
    echo   [✓] public\index.html با موفقیت کپی شد.
) else (
    echo   [X] خطا در کپی public\index.html!
)

if not exist "%FILES_DIR%\public\css" mkdir "%FILES_DIR%\public\css"
copy /Y "%~dp0public\css\style.css" "%FILES_DIR%\public\css\style.css" >nul
copy /Y "%~dp0public\js\app.js" "%FILES_DIR%\public\js\app.js" >nul
copy /Y "%~dp0public\js\data-engine.js" "%FILES_DIR%\public\js\data-engine.js" >nul
copy /Y "%~dp0public\js\gdrive-sync.js" "%FILES_DIR%\public\js\gdrive-sync.js" >nul
copy /Y "%~dp0public\manifest.json" "%FILES_DIR%\public\manifest.json" >nul
copy /Y "%~dp0public\icon.svg" "%FILES_DIR%\public\icon.svg" >nul
copy /Y "%~dp0public\sw.js" "%FILES_DIR%\public\sw.js" >nul
if %errorlevel% equ 0 (
    echo   [✓] تمام فایل‌های جاوااسکریپت و PWA با موفقیت کپی شدند.
) else (
    echo   [X] خطا در کپی برخی از فایل‌ها!
)

echo.
echo [3/5] بررسی اسکریپت‌های نصب و فایل‌های راهنما در پکیج...
if exist "%PKG_DIR%\Update_Installer.bat" echo   [✓] Update_Installer.bat موجود است.
if exist "%PKG_DIR%\نصب_آپدیت.bat" echo   [✓] نصب_آپدیت.bat موجود است.
if exist "%PKG_DIR%\لیست_تغییرات_و_راهنما.txt" echo   [✓] لیست_تغییرات_و_راهنما.txt موجود است.

echo.
echo [4/5] فشرده‌سازی و ایجاد فایل زیپ LeadApp_Update.zip ...
powershell -Command "if (Test-Path '%~dp0LeadApp_Update.zip') { Remove-Item -Force '%~dp0LeadApp_Update.zip' }; Compress-Archive -Path '%PKG_DIR%\*' -DestinationPath '%~dp0LeadApp_Update.zip' -Force" >nul 2>&1
if exist "%~dp0LeadApp_Update.zip" (
    echo   [✓] فایل فشرده LeadApp_Update.zip با موفقیت ساخته شد!
) else (
    echo   [i] فایل زیپ ساخته نشد؛ می‌توانید پوشه LeadApp_Update را مستقیماً زیپ کرده یا ارسال فرمایید.
)

echo.
echo ====================================================================
echo   عملیات ساخت پکیج با موفقیت به پایان رسید!
echo ====================================================================
echo.
echo شما می‌توانید:
echo  1. فایل فشرده آماده: %~dp0LeadApp_Update.zip
echo  یا
echo  2. کل پوشه: %PKG_DIR%
echo.
echo را به کاربران خود تحویل دهید. کاربر تنها کافی است فایل
echo «نصب_آپدیت.bat» یا «Update_Installer.bat» را اجرا کند.
echo.
pause
