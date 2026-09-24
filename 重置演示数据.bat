@echo off
title 重置演示数据
cd /d "%~dp0server"
echo 正在重置数据库并写入演示数据...
call npm.cmd run reset
echo.
echo 完成！请重新启动服务（运行 启动项目.bat）。
pause
