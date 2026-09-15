@echo off
REM Auto-reply Gluglu Instagram DMs (continuous). Keep this window open.
cd /d "%~dp0..\.."
echo Starting gluglu continuous sweeper...
echo Stop with Ctrl+C
node scripts\workflows\sweep-gluglu.mjs --watch
