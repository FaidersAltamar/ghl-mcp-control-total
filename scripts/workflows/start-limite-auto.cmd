@echo off
REM Auto-reply Limite Instagram DMs (continuous). Keep this window open.
cd /d "%~dp0..\.."
echo Starting limite continuous sweeper...
echo Stop with Ctrl+C
node scripts\workflows\sweep-limite.mjs --watch
