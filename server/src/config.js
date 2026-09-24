'use strict';

const path = require('path');
const fs = require('fs');

/**
 * 极简 .env 加载器：读取 server/.env（可选），避免为此引入 dotenv 依赖
 */
function loadEnvFile() {
  const file = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) return;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (process.env[key] === undefined) process.env[key] = value;
    });
}

loadEnvFile();

const SERVER_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

const config = {
  /** 服务监听端口 */
  port: Number(process.env.PORT || 3000),
  /** 运行环境 */
  env: process.env.NODE_ENV || 'development',
  /** JWT 签名密钥（生产环境请通过环境变量覆盖） */
  jwtSecret: process.env.JWT_SECRET || 'flower-shop-graduation-project-secret',
  /** token 有效期（秒），默认 7 天 */
  jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN || 60 * 60 * 24 * 7),
  /** SQLite 数据文件 */
  dbFile: process.env.DB_FILE || path.join(SERVER_ROOT, 'data', 'flower.db'),
  /** 前端静态资源目录（web） */
  webDir: process.env.WEB_DIR || path.join(PROJECT_ROOT, 'web'),
  /** 日志文件 */
  logFile: path.join(SERVER_ROOT, 'logs', 'server.log'),
  /** 分页默认值 */
  defaultPageSize: 12,
  maxPageSize: 100,
  serverRoot: SERVER_ROOT,
  projectRoot: PROJECT_ROOT,
};

module.exports = config;
