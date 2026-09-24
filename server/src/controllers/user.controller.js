'use strict';

const { validate } = require('../utils/validate');
const { HttpError } = require('../utils/http-error');
const { ok, page } = require('../utils/response');
const { parsePaging, now } = require('../utils/helpers');
const { hashPassword } = require('../utils/password');
const { logOperation } = require('../db');

/** 后台用户列表（支持关键词、角色、状态筛选） */
exports.adminList = (req, res) => {
  const db = req.app.locals.db;
  const { page: pageNum, pageSize, offset } = parsePaging(req.query, 10);
  const keyword = (req.query.keyword || '').trim();
  const role = (req.query.role || '').trim();
  const status = (req.query.status || '').trim();

  const where = ['1=1'];
  const params = [];
  if (keyword) {
    where.push('(username LIKE ? OR nickname LIKE ? OR phone LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = db.get(`SELECT COUNT(*) AS c FROM users ${whereSql}`, params).c;
  const list = db.all(
    `SELECT u.id, u.username, u.nickname, u.phone, u.email, u.role, u.status, u.created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(pay_amount),0) FROM orders o WHERE o.user_id = u.id AND o.status <> 'canceled') AS consume
     FROM users u ${whereSql} ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    params.concat([pageSize, offset])
  );
  return page(res, list, total, pageNum, pageSize);
};

/** 新增用户（管理员代客下单 / 添加店员） */
exports.create = (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body, {
    username: { required: '请输入账号', pattern: [/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/, '账号需 3~20 位，字母开头'] },
    password: { required: '请输入初始密码', min: [6, '密码至少 6 位'] },
    nickname: { required: '请输入昵称' },
    phone: { pattern: [/^(1[3-9]\d{9})?$/, '手机号格式不正确'] },
    email: { pattern: [/^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?$/, '邮箱格式不正确'] },
    role: { enum: ['customer', 'admin'], default: 'customer' },
  });
  if (db.get('SELECT id FROM users WHERE username = ?', [data.username])) throw new HttpError(400, '账号已存在');
  const hash = hashPassword(data.password);
  const info = db.run(
    'INSERT INTO users (username, password_hash, salt, nickname, phone, email, role, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [data.username, hash, hash.split('$')[4], data.nickname, data.phone || '', data.email || '', data.role, 'active', now()]
  );
  logOperation(db, req.user, '用户', '新增用户', `新增用户 ${data.username}`);
  return ok(res, { id: info.lastInsertRowid }, '用户新增成功');
};

/** 启用 / 禁用用户（不允许禁用自己） */
exports.setStatus = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const status = req.body.status === 'disabled' ? 'disabled' : 'active';
  if (id === req.user.id) throw new HttpError(400, '不能禁用当前登录账号');
  const info = db.run('UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [status, now(), id]);
  if (!info.changes) throw new HttpError(404, '用户不存在');
  logOperation(db, req.user, '用户', status === 'disabled' ? '禁用用户' : '启用用户', `用户 #${id}`);
  return ok(res, null, status === 'disabled' ? '账号已禁用' : '账号已启用');
};

/** 重置密码为 123456 */
exports.resetPassword = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const data = validate(req.body || {}, { password: { default: '123456', min: [6, '密码至少 6 位'] } });
  const hash = hashPassword(data.password);
  db.run('UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?', [
    hash, hash.split('$')[4], now(), id,
  ]);
  logOperation(db, req.user, '用户', '重置密码', `重置用户 #${id} 的密码`);
  return ok(res, { password: data.password }, '密码已重置');
};
