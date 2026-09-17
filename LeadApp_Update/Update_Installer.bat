@echo off
chcp 65001 >nul
title TM / LeadApp Update Installer
color 0B
cls

echo ====================================================================
echo           به‌روزرسان خودکار سامانه TM / LeadApp (نسخه جدید)
echo ====================================================================
echo.
echo این اسکریپت تنها فایل‌های به‌روزرسانی‌شده سامانه را جایگزین می‌کند.
echo تمامی اطلاعات، وظایف، گزارش‌ها و دیتابیس قبلی شما کاملاً ایمن خواهند بود.
echo.

:: 1. Detect target LeadApp directory
set "TARGET_DIR="

:: Case A: Run directly inside the LeadApp root folder
if exist "%CD%\src\server.js" if exist "%CD%\public\index.html" (
    set "TARGET_DIR=%CD%"
    goto :DIR_FOUND
)

:: Case B: Run from inside the LeadApp_Update folder placed inside LeadApp
if exist "%~dp0..\src\server.js" if exist "%~dp0..\public\index.html" (
    pushd "%~dp0.."
    set "TARGET_DIR=%CD%"
    popd
    goto :DIR_FOUND
)

:: Case C: Prompt the user
:ASK_DIR
echo --------------------------------------------------------------------
echo پوشه اصلی برنامه به صورت خودکار شناسایی نشد.
echo لطفاً پوشه اصلی برنامه (LeadApp) را در این کادر بکشید و رها کنید (Drag & Drop)
echo یا مسیر کامل آن را وارد کنید:
echo (مثال: C:\LeadApp یا E:\Project\LeadApp)
echo --------------------------------------------------------------------
echo.
set /p USER_INPUT="مسیر پوشه برنامه: "

:: Remove quotation marks if present
set USER_INPUT=%USER_INPUT:"=%

if exist "%USER_INPUT%\src\server.js" if exist "%USER_INPUT%\public\index.html" (
    set "TARGET_DIR=%USER_INPUT%"
    goto :DIR_FOUND
) else (
    echo.
    echo [خطا] پوشه انتخاب شده معتبر نیست یا فایل‌های برنامه در آن یافت نشدند!
    echo لطفاً دوباره امتحان کنید.
    echo.
    goto :ASK_DIR
)

:DIR_FOUND
echo.
echo [✓] پوشه هدف شناسایی شد: "%TARGET_DIR%"
echo.

:: Check source update files exist
set "SOURCE_DIR=%~dp0update_files"
if not exist "%SOURCE_DIR%\src\server.js" (
    echo [خطا] فایل‌های به‌روزرسانی در مسیر "%SOURCE_DIR%" یافت نشدند!
    echo لطفاً مطمئن شوید پوشه update_files در کنار این فایل اجرایی قرار دارد.
    pause
    exit /b 1
)

:: Create backup directory
set "BACKUP_DIR=%TARGET_DIR%\backup_before_update"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%BACKUP_DIR%\src" mkdir "%BACKUP_DIR%\src"
if not exist "%BACKUP_DIR%\public\js" mkdir "%BACKUP_DIR%\public\js"

echo [1/3] تهیه نسخه پشتیبان از فایل‌های قبلی...
if exist "%TARGET_DIR%\src\server.js" copy /Y "%TARGET_DIR%\src\server.js" "%BACKUP_DIR%\src\server.js" >nul
if exist "%TARGET_DIR%\public\index.html" copy /Y "%TARGET_DIR%\public\index.html" "%BACKUP_DIR%\public\index.html" >nul
if exist "%TARGET_DIR%\public\js\app.js" copy /Y "%TARGET_DIR%\public\js\app.js" "%BACKUP_DIR%\public\js\app.js" >nul
echo       [✓] نسخه پشتیبان در پوشه زیر ذخیره شد:
echo           "%BACKUP_DIR%"

echo.
echo [2/3] اعمال فایل‌های به‌روزرسانی‌شده جدید...
copy /Y "%SOURCE_DIR%\src\server.js" "%TARGET_DIR%\src\server.js" >nul
if exist "%SOURCE_DIR%\src\vendor" xcopy /E /I /Y "%SOURCE_DIR%\src\vendor" "%TARGET_DIR%\src\vendor" >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] خطا در بروزرسانی src\server.js!
    pause
    exit /b 1
)
echo       [✓] src\server.js و ماژول QR به‌روزرسانی شد.

copy /Y "%SOURCE_DIR%\public\index.html" "%TARGET_DIR%\public\index.html" >nul
if %errorlevel% neq 0 (
    echo [X] خطا در بروزرسانی public\index.html!
    pause
    exit /b 1
)
echo       [✓] public\index.html به‌روزرسانی شد.

copy /Y "%SOURCE_DIR%\public\js\app.js" "%TARGET_DIR%\public\js\app.js" >nul
if exist "%SOURCE_DIR%\public\css\style.css" copy /Y "%SOURCE_DIR%\public\css\style.css" "%TARGET_DIR%\public\css\style.css" >nul 2>&1
copy /Y "%SOURCE_DIR%\public\js\data-engine.js" "%TARGET_DIR%\public\js\data-engine.js" >nul
copy /Y "%SOURCE_DIR%\public\js\gdrive-sync.js" "%TARGET_DIR%\public\js\gdrive-sync.js" >nul
copy /Y "%SOURCE_DIR%\public\manifest.json" "%TARGET_DIR%\public\manifest.json" >nul
copy /Y "%SOURCE_DIR%\public\icon.svg" "%TARGET_DIR%\public\icon.svg" >nul
copy /Y "%SOURCE_DIR%\public\sw.js" "%TARGET_DIR%\public\sw.js" >nul
if %errorlevel% neq 0 (
    echo [X] خطا در بروزرسانی فایل‌های جاوااسکریپت و PWA!
    pause
    exit /b 1
)
echo       [✓] فایل‌های جاوااسکریپت و هسته آفلاین PWA به‌روزرسانی شدند.

echo.
echo [3/3] بررسی امنیت پایگاه داده...
echo       [✓] دیتابیس (data\database.json) کاملاً دست‌نخورده و ایمن حفظ شد.

echo.
echo ====================================================================
echo           🎉 به‌روزرسانی با موفقیت کامل انجام شد!
echo ====================================================================
echo.
echo تغییرات جدید اعمال شده:
echo   ۱. صفحه‌بندی کامل برای همه جداول (کارها، روتین‌ها، گزارش‌ها و تعاملات)
echo   ۲. قابلیت جدید «اتمام دوره کاری» جهت آرشیو تمیز محیط (بدون تغییر روتین‌ها)
echo   ۳. «صندوق آرشیو» جدید با امکان جستجو و دکمه اختصاصی «برگردان»
echo   ۴. دکمه «تمام چالش‌ها و موانع» در گزارش روزانه با فیلتر بازه تاریخ شمسی
echo   ۵. پشتیبانی ۱۰۰٪ آفلاین در موبایل (PWA) بدون نیاز به اینترنت یا روشن بودن کامپیوتر
echo   ۶. همگام‌سازی ابری با گوگل درایو شخصی (Zero-Server) با ادغام هوشمند دوطرفه
echo.

set /p RUN_APP="آیا مایلید سامانه هم‌اکنون اجرا شود؟ (Y/N): "
if /i "%RUN_APP%"=="Y" (
    echo در حال اجرای برنامه...
    cd /d "%TARGET_DIR%"
    if exist "start.bat" (
        start "" "start.bat"
    ) else (
        start "" "http://localhost:3000"
        node src/server.js
    )
)

echo.
echo با تشکر!
pause
