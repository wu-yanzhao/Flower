'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
  /** JWT 签名密钥（生产环境请通过 .env 的 JWT_SECRET 指定固定强随机值） */
  jwtSecret: process.env.JWT_SECRET || (() => {
    // 未显式配置时，每次启动随机生成，避免仓库内置弱密钥被利用伪造 token。
    // 代价：重启服务后旧 token 全部失效，需重新登录（符合无状态会话的预期）。
    const random = crypto.randomBytes(32).toString('hex');
    console.warn(
      '\x1b[33m[安全提示]\x1b[0m 未配置环境变量 JWT_SECRET，已使用本次启动随机生成的密钥；' +
      '重启服务后旧 token 将失效，正式部署请在 .env 中设置固定的强随机密钥。'
    );
    return random;
  })(),
  /** token 有效期（秒），默认 7 天 */
  jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN || 60 * 60 * 24 * 7),
  /** SQLite 数据文件 */
  dbFile: process.env.DB_FILE || path.join(SERVER_ROOT, 'data', 'flower.db'),
  /** 前端静态资源目录（web） */
  webDir: process.env.WEB_DIR || path.join(PROJECT_ROOT, 'web'),
  /** 后端统一静态资源目录（迁移的花材照片 + 用户上传），对外以 /static 前缀访问 */
  staticDir: process.env.STATIC_DIR || path.join(SERVER_ROOT, 'static'),
  /** 日志文件 */
  logFile: path.join(SERVER_ROOT, 'logs', 'server.log'),
  /** 分页默认值 */
  defaultPageSize: 12,
  maxPageSize: 100,
  serverRoot: SERVER_ROOT,
  projectRoot: PROJECT_ROOT,
};

module.exports = config;
