'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { HttpError } = require('../utils/http-error');

/** 简易请求日志：记录到控制台与 logs/server.log */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const line = `[${new Date().toLocaleString('zh-CN')}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${
      Date.now() - start
    }ms)`;
    if (req.originalUrl.startsWith('/api')) {
      console.log(line);
      try {
        fs.mkdirSync(path.dirname(config.logFile), { recursive: true });
        fs.appendFileSync(config.logFile, line + '\n');
      } catch (err) {
        /* ignore */
      }
    }
  });
  next();
}

function notFound(req, res, next) {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ code: 404, message: `接口不存在：${req.method} ${req.originalUrl}`, data: null });
  }
  next();
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // body-parser 等框架中间件抛出的错误自带 status（如超限 413），
  // 这里只尊重其状态码，但对外文案仍保持统一、不暴露内部细节
  let status = err instanceof HttpError ? err.status : err.status || err.statusCode || 500;
  let message = err instanceof HttpError ? err.message : '服务器内部错误';
  if (err && (err.type === 'entity.too.large' || status === 413)) {
    status = 413;
    message = '请求内容过大（图片超限），请压缩后重试';
  }
  if (status >= 500) {
    console.error('[ERROR]', req.method, req.originalUrl, err);
  }
  res.status(status).json({
    code: status,
    message,
    data: null,
    details: err && err.details ? err.details : undefined,
  });
}

module.exports = { requestLogger, notFound, errorHandler };
