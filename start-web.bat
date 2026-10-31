@echo off
title OpenScript Studio Web UI (http://localhost:5173)
cd /d "%~dp0"

set "PATH=C:\Users\PC\.gemini\antigravity\bin;C:\Users\PC\AppData\Local\OpenAI\Codex\runtimes\cua_node\a9ba6825a525118c\bin;%PATH%"

echo ===================================================
echo   Starting OpenScript Studio Web (v0.1)
echo   Local URL: http://localhost:5173
echo ===================================================
echo.

pnpm --filter web run dev
pause
