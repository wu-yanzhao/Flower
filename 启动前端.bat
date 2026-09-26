@echo off
title 鲜花订购与管理系统 - 前端静态服务
cd /d "%~dp0web"

echo ==========================================================
echo          鲜花订购与管理系统  -  前端静态服务
echo ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    if exist "E:\Node\node.exe" (
        set "PATH=E:\Node;%PATH%"
        echo [提示] 已将 E:\Node 临时加入 PATH
    ) else (
        echo [错误] 未检测到 Node.js，请先安装 Node.js 18 及以上版本
        echo        下载地址：https://nodejs.org/zh-cn/download
        pause
        exit /b 1
    )
)

echo   前端地址：  http://localhost:5173/
echo   管理端：    http://localhost:5173/admin/index.html
echo   接口转发：  /api/*  转发到  http://localhost:3000/api/*
echo.
echo   请先在 IDEA 中启动后端（1 后端服务 3000），否则页面数据为空
echo.
echo   CMD 下换端口：        先执行 set PORT=8080，再执行 node server.js
echo   PowerShell 下换端口： 先执行 $env:PORT="8080"，再执行 node server.js
echo ----------------------------------------------------------
echo.

node server.js
pause
