'use strict';

const jwt = require('../utils/jwt');
const { HttpError } = require('../utils/http-error');
const { logOperation } = require('../db');

/** 从请求头解析 token：Authorization: Bearer xxx */
function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.query && req.query.token) return String(req.query.token);
  return null;
}

/** 解析 token 并挂载 req.user（含数据库中的最新角色与状态） */
function resolveUser(req) {
  const token = extractToken(req);
  if (!token) throw new HttpError(401, '请先登录');
  let payload;
  try {
    payload = jwt.verify(token);
  } catch (err) {
    throw new HttpError(401, err.message || '登录状态失效，请重新登录');
  }
  const db = req.app.locals.db;
  const user = db.get('SELECT * FROM users WHERE id = ?', [payload.userId]);
  if (!user) throw new HttpError(401, '用户不存在或已被删除');
  if (user.status !== 'active') throw new HttpError(403, '账号已被禁用，请联系管理员');
  req.token = token;
  req.user = user;
  return user;
}

/** 必须登录 */
function authRequired(req, res, next) {
  try {
    resolveUser(req);
    next();
  } catch (err) {
    next(err);
  }
}

/** 登录可选（商品详情等页面，登录后可展示收藏状态） */
function authOptional(req, res, next) {
  try {
    resolveUser(req);
  } catch (err) {
    req.user = null;
  }
  next();
}

/** 仅管理员 */
function adminOnly(req, res, next) {
  try {
    const user = resolveUser(req);
    if (user.role !== 'admin') throw new HttpError(403, '无权访问，需要管理员权限');
    next();
  } catch (err) {
    next(err);
  }
}

/** 后台操作日志中间件：在需要审计的接口上挂载 */
function auditLog(moduleName, action) {
  return function audit(req, res, next) {
    try {
      const detail = req.body && req.body.detail ? req.body.detail : `${action}`;
      logOperation(req.app.locals.db, req.user || null, moduleName, action, detail);
    } catch (err) {
      /* ignore */
    }
    next();
  };
}

module.exports = { authRequired, authOptional, adminOnly, auditLog, extractToken };
