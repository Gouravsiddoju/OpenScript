@echo off
title OpenScript Test Suite
cd /d "%~dp0"

set "PATH=C:\Users\PC\.gemini\antigravity\bin;C:\Users\PC\AppData\Local\OpenAI\Codex\runtimes\cua_node\a9ba6825a525118c\bin;%PATH%"

echo ===================================================
echo   Running OpenScript Automated Test Suite
echo ===================================================
echo.

pnpm test
pause
