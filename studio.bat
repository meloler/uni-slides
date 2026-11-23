@echo off
title Uni-Slides Studio
cd /d "C:\Users\Usuario\.gemini\antigravity\scratch\uni-slides"
echo Iniciando Uni-Slides Studio en http://localhost:3456 ...
start "" "http://localhost:3456"
node src/studio/server.js
pause
