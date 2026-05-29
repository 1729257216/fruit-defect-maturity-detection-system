@echo off
setlocal

cd /d "%~dp0"
title Mango Demo Launcher

set "PROJECT_DIR=%~dp0"
set "FRONTEND_DIR=%PROJECT_DIR%frontend"
set "HOST=127.0.0.1"
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=3000"
set "FRONTEND_URL=http://%HOST%:%FRONTEND_PORT%"
set "MANGO_MODEL_WEIGHTS=%PROJECT_DIR%runs\baseline_compare\baseline_yolov8n_original\weights\best.pt"

if not exist "%FRONTEND_DIR%\package.json" goto no_frontend

if not defined MANGO_MODEL_WEIGHTS goto no_weights
if not exist "%MANGO_MODEL_WEIGHTS%" goto no_weights

echo Using weights:
echo %MANGO_MODEL_WEIGHTS%
echo.

echo Starting backend...
start "Mango Backend" /D "%PROJECT_DIR%" cmd /k "set MANGO_MODEL_WEIGHTS=%MANGO_MODEL_WEIGHTS% && python launch_backend.py"

echo Starting frontend...
start "Mango Frontend" /D "%FRONTEND_DIR%" cmd /k "npm.cmd run dev -- --host %HOST% --port %FRONTEND_PORT%"

echo Waiting for frontend...
timeout /t 8 >nul

start "" "%FRONTEND_URL%"
echo Opened: %FRONTEND_URL%
echo.
echo Close the windows named "Mango Backend" and "Mango Frontend" when finished.
pause
exit /b 0

:no_frontend
echo ERROR: frontend folder or package.json not found.
echo %FRONTEND_DIR%
pause
exit /b 1

:no_weights
echo ERROR: best.pt not found.
pause
exit /b 1
