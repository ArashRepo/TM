@echo off
chcp 65001 >nul
title راهنمای راه‌اندازی و انتشار سریع در GitHub Pages
cls

echo ====================================================================
echo      🚀 راه‌اندازی و انتشار خودکار TM روی GitHub Pages (رایگان)
echo ====================================================================
echo.
echo این اسکریپت پروژه شما را برای انتشار روی GitHub آماده و ارسال می‌کند
echo تا بتوانید آدرس اختصاصی HTTPS دریافت کرده و برنامه را روی گوشی
echo به صورت ۱۰۰٪ آفلاین و دائمی (Zero-Server) نصب نمایید.
echo.

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] گیت (Git) روی سیستم شما پیدا نشد. لطفاً ابتدا Git را نصب فرمایید.
    echo https://git-scm.com/downloads
    pause
    exit /b 1
)

echo [1/4] بررسی و آماده‌سازی مخزن Git محلی...
if not exist ".git" (
    git init >nul
    echo   [✓] مخزن گیت ایجاد شد.
) else (
    echo   [✓] مخزن گیت از قبل موجود است.
)

echo.
echo [2/4] به‌روزرسانی و کپی فایل‌های هاست استاتیک در پوشه docs...
if not exist "docs" mkdir "docs"
xcopy /E /I /Y "public" "docs" >nul 2>&1
echo   [✓] پوشه docs همگام‌سازی شد.

echo.
echo [3/4] ثبت تغییرات در کامیت محلی...
git add .
git commit -m "Deploy TM Progressive Web App with Offline PWA & GDrive Sync" >nul 2>&1
git branch -M main >nul 2>&1
echo   [✓] کامیت با موفقیت ثبت شد.

echo.
echo ====================================================================
echo [4/4] اتصال به مخزن گیت‌هاب شما
echo ====================================================================
echo.
echo ۱. در سایت GitHub.com یک مخزن جدید (New Repository) به نام TM یا دلخواه بسازید (Public).
echo ۲. آدرس آن را کپی کنید (مثلاً: https://github.com/Username/TM.git).
echo.
set /p REPO_URL="آدرس مخزن گیت‌هاب خود را اینجا پیست کنید (یا Enter بزنید برای رد شدن): "

if not "%REPO_URL%"=="" (
    git remote remove origin >nul 2>&1
    git remote add origin %REPO_URL%
    echo.
    echo در حال ارسال کدها به گیت‌هاب (git push)...
    git push -u origin main
    if %errorlevel% equ 0 (
        echo.
        echo ====================================================================
        echo       🎉 تبریک! کدهای برنامه با موفقیت به گیت‌هاب ارسال شد!
        echo ====================================================================
        echo.
        echo حالا فقط این مرحله نهایی را در سایت گیت‌هاب انجام دهید:
        echo  1. وارد مخزن خود در سایت GitHub شوید.
        echo  2. به تب «Settings» رفته و از منوی سمت چپ روی «Pages» بزنید.
        echo  3. در بخش «Build and deployment > Source» گزینه «GitHub Actions» را انتخاب کنید
        echo     (یا Deploy from a branch را انتخاب کرده و شاخه main و پوشه /docs را ذخیره کنید).
        echo.
        echo ظرف ۱ دقیقه آدرس سایت HTTPS شما آماده می‌شود! (مثلاً https://username.github.io/TM)
        echo کافیست آن آدرس را در گوشی باز کرده و Add to Home Screen را بزنید.
    ) else (
        echo.
        echo [!] ارسال به گیت‌هاب با خطا مواجه شد. لطفاً نام‌کاربری و پسورد / توکن گیت‌هاب خود را بررسی فرمایید.
    )
) else (
    echo.
    echo پروژه شما آماده است. هر زمان که مخزن ساختید می‌توانید دستورات زیر را اجرا کنید:
    echo   git remote add origin [آدرس مخزن شما]
    echo   git push -u origin main
)

echo.
pause
