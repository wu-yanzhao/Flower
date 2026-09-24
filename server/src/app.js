'use strict';

const path = require('path');
const express = require('express');
const config = require('./config');
const { initDatabase } = require('./db');
const routes = require('./routes');
const { requestLogger, notFound, errorHandler } = require('./middleware/error');

/**
 * 应用入口：初始化数据库 -> 注册中间件 -> 挂载路由 -> 启动服务
 */
function createApp() {
  const { db, driver } = initDatabase();

  const app = express();
  app.locals.db = db;
  app.locals.driver = driver;

  // 跨域：本地开发 / 演示时前端可直接用 file:// 或 localhost 访问
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // 静态资源：web 目录即前端站点
  app.use(express.static(config.webDir, { extensions: ['html'] }));

  // REST 接口
  app.use('/api', routes);

  // 管理端与顾客端的入口页
  app.get('/admin', (req, res) => res.sendFile(path.join(config.webDir, 'admin', 'index.html')));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

function start() {
  // 版本检查：node:sqlite 需要 >= 22.5，低版本可安装 better-sqlite3 兜底
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    console.error('当前 Node.js 版本过低（%s），请安装 Node.js 18 及以上版本', process.versions.node);
    process.exit(1);
  }

  const app = createApp();
  app.listen(config.port, () => {
    const line = '═'.repeat(58);
    console.log(line);
    console.log('  🌸  鲜花订购与管理系统 · 后端服务已启动');
    console.log('  ----------------------------------------------------------');
    console.log(`  ➤  接口地址： http://localhost:${config.port}/api`);
    console.log(`  ➤  顾客端：   http://localhost:${config.port}/`);
    console.log(`  ➤  管理端：   http://localhost:${config.port}/admin/index.html`);
    console.log(`  ➤  数据库：   ${config.dbFile}`);
    console.log(`  ➤  运行环境： Node.js ${process.versions.node}`);
    console.log('  ----------------------------------------------------------');
    console.log('  演示账号：管理员 admin / admin123    顾客 customer / 123456');
    console.log(line);
  });
}

if (require.main === module) {
  process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
  start();
}

module.exports = { createApp, start };
