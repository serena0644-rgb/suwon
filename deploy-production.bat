@echo off
cd /d "%~dp0"
set "PATH=C:\Users\seren\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
call .\node_modules\.bin\vercel.cmd --prod --yes
pause
