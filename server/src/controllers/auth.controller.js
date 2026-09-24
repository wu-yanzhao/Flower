'use strict';

const { validate } = require('../utils/validate');
const { HttpError } = require('../utils/http-error');
const { hashPassword, verifyPassword } = require('../utils/password');
const jwt = require('../utils/jwt');
const { ok } = require('../utils/response');
const { safeUser, now } = require('../utils/helpers');

/**
 * 用户注册
 * 校验：账号 3~20 位字母开头；密码 6~20 位；昵称必填；手机号格式（选填）
 */
exports.register = (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body, {
    username: {
      required: '请输入登录账号',
      pattern: [/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/, '账号需 3~20 位，以字母开头，仅含字母数字下划线'],
    },
    password: { required: '请输入登录密码', min: [6, '密码至少 6 位'], max: [20, '密码最多 20 位'] },
    nickname: { required: '请输入昵称', max: [20, '昵称最多 20 个字符'] },
    phone: { pattern: [/^(1[3-9]\d{9})?$/, '手机号格式不正确'] },
    email: { pattern: [/^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?$/, '邮箱格式不正确'] },
  });

  const exist = db.get('SELECT id FROM users WHERE username = ?', [data.username]);
  if (exist) throw new HttpError(400, '该账号已被注册，请更换');

  const hash = hashPassword(data.password);
  const info = db.run(
    `INSERT INTO users (username, password_hash, salt, nickname, phone, email, role, status, created_at)
     VALUES (?,?,?,?,?,?, 'customer', 'active', ?)`,
    [data.username, hash, hash.split('$')[4], data.nickname, data.phone || '', data.email || '', now()]
  );

  const user = db.get('SELECT * FROM users WHERE id = ?', [info.lastInsertRowid]);
  const token = jwt.sign({ userId: user.id, role: user.role });
  return ok(res, { token, user: safeUser(user) }, '注册成功，已自动登录');
};

/** 用户登录：校验账号密码与账号状态，返回 token */
exports.login = (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body, {
    username: { required: '请输入登录账号' },
    password: { required: '请输入登录密码' },
  });

  const user = db.get('SELECT * FROM users WHERE username = ?', [data.username]);
  if (!user) throw new HttpError(401, '账号不存在，请注册后再登录');
  if (!verifyPassword(data.password, user.password_hash)) throw new HttpError(401, '账号或密码错误');
  if (user.status !== 'active') throw new HttpError(403, '账号已被禁用，请联系管理员');

  const token = jwt.sign({ userId: user.id, role: user.role });
  return ok(res, { token, user: safeUser(user) }, '登录成功');
};

/** 当前登录用户基本信息（含购物车数量、优惠券等扩展位） */
exports.profile = (req, res) => {
  const db = req.app.locals.db;
  const cartCount = db.get('SELECT COALESCE(SUM(quantity),0) AS c FROM cart_items WHERE user_id = ?', [req.user.id]).c;
  const favCount = db.get('SELECT COUNT(*) AS c FROM favorites WHERE user_id = ?', [req.user.id]).c;
  const orderCount = db.get('SELECT COUNT(*) AS c FROM orders WHERE user_id = ?', [req.user.id]).c;
  return ok(res, Object.assign({}, safeUser(req.user), { cartCount, favCount, orderCount }));
};

/** 修改个人资料 */
exports.updateProfile = (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body, {
    nickname: { required: '昵称不能为空', max: [20, '昵称最多 20 个字符'] },
    phone: { pattern: [/^(1[3-9]\d{9})?$/, '手机号格式不正确'] },
    email: { pattern: [/^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?$/, '邮箱格式不正确'] },
    avatar: {},
  });
  db.run('UPDATE users SET nickname = ?, phone = ?, email = ?, avatar = ?, updated_at = ? WHERE id = ?', [
    data.nickname,
    data.phone || '',
    data.email || '',
    data.avatar || req.user.avatar || '',
    now(),
    req.user.id,
  ]);
  const user = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  return ok(res, safeUser(user), '资料已更新');
};

/** 修改密码 */
exports.changePassword = (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body, {
    oldPassword: { required: '请输入原密码' },
    newPassword: { required: '请输入新密码', min: [6, '新密码至少 6 位'], max: [20, '新密码最多 20 位'] },
  });
  if (!verifyPassword(data.oldPassword, req.user.password_hash)) throw new HttpError(400, '原密码不正确');
  const hash = hashPassword(data.newPassword);
  db.run('UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?', [
    hash,
    hash.split('$')[4],
    now(),
    req.user.id,
  ]);
  return ok(res, null, '密码修改成功');
};

/** 退出登录：前端清除 token 即可，这里做一次签名失效记录（预留扩展） */
exports.logout = (req, res) => ok(res, null, '已退出登录');
