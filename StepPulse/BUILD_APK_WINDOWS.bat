@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title StepPulse APK Builder

set "GRADLE_VERSION=8.10.2"
set "TOOLS_DIR=%CD%\.tools"
set "GRADLE_HOME_LOCAL=%TOOLS_DIR%\gradle-%GRADLE_VERSION%"
set "GRADLE_ZIP=%TOOLS_DIR%\gradle-%GRADLE_VERSION%-bin.zip"

echo ==================================================
echo          StepPulse - Android APK Builder
echo ==================================================
echo.

if not exist "%TOOLS_DIR%" mkdir "%TOOLS_DIR%"

rem Locate Android Studio's bundled Java if JAVA_HOME is missing.
if not defined JAVA_HOME (
    if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (
        set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
    ) else if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" (
        set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
    )
)

where java >nul 2>nul
if errorlevel 1 (
    if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"
)

where java >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Java was not found.
    echo Install Android Studio, then run this file again.
    pause
    exit /b 1
)

rem Locate the default Android SDK if environment variables are missing.
if not defined ANDROID_HOME (
    if exist "%LOCALAPPDATA%\Android\Sdk\platforms" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)
if not defined ANDROID_SDK_ROOT (
    if defined ANDROID_HOME set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
)

if not defined ANDROID_HOME (
    echo [ERROR] Android SDK was not found.
    echo Open Android Studio once, install Android SDK 35, then run this file again.
    pause
    exit /b 1
)

if not exist "%ANDROID_HOME%\platforms\android-35\android.jar" (
    echo [ERROR] Android SDK Platform 35 is missing.
    echo In Android Studio open SDK Manager and install Android 15 / API 35.
    pause
    exit /b 1
)

if not exist "%GRADLE_HOME_LOCAL%\bin\gradle.bat" (
    echo [1/3] Downloading Gradle %GRADLE_VERSION%...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip' -OutFile '%GRADLE_ZIP%'"
    if errorlevel 1 (
        echo [ERROR] Gradle download failed. Check your internet connection.
        pause
        exit /b 1
    )

    echo [2/3] Extracting Gradle...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Expand-Archive -Path '%GRADLE_ZIP%' -DestinationPath '%TOOLS_DIR%' -Force"
    if errorlevel 1 (
        echo [ERROR] Gradle extraction failed.
        pause
        exit /b 1
    )
)

set "PATH=%GRADLE_HOME_LOCAL%\bin;%PATH%"

echo [3/3] Building StepPulse APK...
call "%GRADLE_HOME_LOCAL%\bin\gradle.bat" --no-daemon :app:assembleDebug
if errorlevel 1 (
    echo.
    echo [ERROR] The build failed. Read the error shown above.
    pause
    exit /b 1
)

echo.
echo ==================================================
echo BUILD SUCCESSFUL
echo APK: %CD%\app\build\outputs\apk\debug\app-debug.apk
echo ==================================================
if exist "%CD%\app\build\outputs\apk\debug\app-debug.apk" (
    explorer /select,"%CD%\app\build\outputs\apk\debug\app-debug.apk"
)
pause
