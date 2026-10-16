@echo off
title OpenScript Full Stack Dev (Web + API)
cd /d "%~dp0"

set "PATH=C:\Users\PC\.gemini\antigravity\bin;C:\Users\PC\AppData\Local\OpenAI\Codex\runtimes\cua_node\a9ba6825a525118c\bin;%PATH%"

echo ===================================================
echo   Starting OpenScript Full-Stack (Web + API)
echo   Web: http://localhost:5173
echo   API: http://localhost:3000
echo ===================================================
echo.

pnpm dev
pause
