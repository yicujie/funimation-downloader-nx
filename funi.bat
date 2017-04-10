@echo off
@chcp 65001>nul

"node" "%~dp0.\scripts\funidl.js" %*

pause