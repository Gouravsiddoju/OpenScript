@echo off
setlocal enabledelayedexpansion

echo ==========================================================
echo   Deploying OpenScript to Dev (dev-openscript.ssnpictures.in)
echo ==========================================================

cd /d "%~dp0\.."

if not exist .env (
  echo --^> No .env file found. Copying .env.example...
  copy .env.example .env
)

where git >nul 2>nul
if %ERRORLEVEL% equ 0 (
  if exist .git (
    echo --^> Pulling latest dev branch...
    git checkout dev
    git pull origin dev
  )
)

echo --^> Building and starting dev containers...
docker compose -f compose.dev.yaml build
docker compose -f compose.dev.yaml up -d

echo --^> Verifying services health...
timeout /t 5 /nobreak >nul
docker compose -f compose.dev.yaml ps

echo ==========================================================
echo   OpenScript Dev Deployment Complete!
echo   Web: https://dev-openscript.ssnpictures.in
echo   API: https://dev-openscript.ssnpictures.in/api/v1/health
echo ==========================================================
