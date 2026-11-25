@echo off
title 鲜花订购与管理系统 - 一键启动
cd /d "%~dp0server"

echo ==========================================================
echo          鲜花订购与管理系统  -  一键启动
echo ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    if exist "E:\Node\node.exe" (
        set "PATH=E:\Node;%PATH%"
        echo [提示] 已将 E:\Node 临时加入 PATH
    ) else (
        echo [错误] 未检测到 Node.js，请先安装 Node.js 22.5 及以上版本
        echo        下载地址：https://nodejs.org/zh-cn/download
        pause
        exit /b 1
    )
)

node -e "const[a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)"
if errorlevel 1 (
    echo [错误] Node.js 版本过低，本项目依赖内置的 node:sqlite，需要 22.5 及以上版本。
    echo        当前版本：
    node -v
    pause
    exit /b 1
)

echo [1/4] 检查并安装依赖（仅 express）...
call npm.cmd install
if errorlevel 1 goto fail

echo [2/4] 初始化数据库与演示数据（首次约需十几秒，请耐心等待）...
call npm.cmd run reset
if errorlevel 1 goto fail
rem npm 会把窗口标题改成 npm run reset，这里恢复，避免误以为卡住
title 鲜花订购与管理系统 - 一键启动

echo [3/4] 检查后端是否已经运行...
node -e "require('http').get('http://localhost:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
if not errorlevel 1 (
    echo [提示] 端口 3000 上已有后端在运行，直接打开浏览器。
    start "" "http://localhost:3000/"
    echo.
    echo   顾客端：http://localhost:3000/
    echo   管理端：http://localhost:3000/admin/index.html
    pause
    exit /b 0
)

echo [4/4] 启动后端服务（新窗口，端口 3000）...
start "鲜花系统后端 3000" cmd /c "node --no-warnings src/app.js & pause"

echo 正在等待服务就绪（最多 30 秒）...
set /a WAIT=0
:wait
node -e "require('http').get('http://localhost:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
if not errorlevel 1 goto ready
set /a WAIT+=1
if %WAIT% GEQ 30 goto waitfail
timeout /t 1 /nobreak >nul
goto wait

:waitfail
echo [错误] 后端启动超时。请查看标题为「鲜花系统后端 3000」的窗口中的报错信息。
pause
exit /b 1

:ready
start "" "http://localhost:3000/"
echo.
echo ==========================================================
echo   启动完成
echo   顾客端：  http://localhost:3000/
echo   管理端：  http://localhost:3000/admin/index.html
echo   演示账号：admin / admin123      customer / 123456
echo   关闭服务：关闭标题为「鲜花系统后端 3000」的窗口
echo ==========================================================
pause
exit /b 0

:fail
echo.
echo ==========================================================
echo   启动失败，请查看上方错误信息后重试
echo ==========================================================
pause
exit /b 1
