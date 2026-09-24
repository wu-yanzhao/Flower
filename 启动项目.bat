@echo off
title 鲜花订购与管理系统 - 一键启动
cd /d "%~dp0"

echo ==========================================================
echo          鲜花订购与管理系统  -  一键启动
echo ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18 及以上版本
    echo        下载地址：https://nodejs.org/zh-cn/download
    pause
    exit /b 1
)

cd /d "%~dp0server"

if not exist "node_modules" (
    echo [1/3] 首次运行，正在安装后端依赖，请稍候...
    call npm.cmd install
) else (
    echo [1/3] 依赖已安装，跳过
)

if not exist "data\flower.db" (
    echo [2/3] 正在初始化数据库与演示数据...
    call npm.cmd run reset
) else (
    echo [2/3] 数据库已存在，跳过初始化（如需重置请运行：重置演示数据.bat）
)

echo [3/3] 正在启动服务，启动后浏览器将自动打开
echo.
echo   顾客端：http://localhost:3000/
echo   管理端：http://localhost:3000/admin/index.html
echo   管理员：admin / admin123      顾客：customer / 123456
echo.
start "" http://localhost:3000/
node src/app.js
pause
