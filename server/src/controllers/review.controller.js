'use strict';

const { validate } = require('../utils/validate');
const { HttpError } = require('../utils/http-error');
const { ok, page } = require('../utils/response');
const { parsePaging, now } = require('../utils/helpers');
const { logOperation } = require('../db');

/**
 * 发表评价：仅已完成订单可评价，每个订单商品仅能评价一次
 * body: { orderId, items: [{ flowerId, rating, content }] }
 */
exports.create = (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body, {
    orderId: { required: '缺少订单信息', type: 'integer' },
    items: { required: '请选择要评价的商品', type: 'array' },
  });

  const order = db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [data.orderId, req.user.id]);
  if (!order) throw new HttpError(404, '订单不存在');
  if (order.status !== 'completed') throw new HttpError(400, '订单完成后才能评价');

  const exist = db.get('SELECT COUNT(*) AS c FROM reviews WHERE order_id = ?', [order.id]).c;
  if (exist) throw new HttpError(400, '该订单已评价，感谢您的反馈');

  const orderItems = db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  let count = 0;

  db.transaction(() => {
    data.items.forEach((raw) => {
      const flowerId = Number(raw.flowerId);
      const rating = Math.min(5, Math.max(1, parseInt(raw.rating, 10) || 5));
      const content = String(raw.content || '').slice(0, 500);
      const matched = orderItems.find((it) => it.flower_id === flowerId);
      if (!matched) return; // 忽略非本订单的商品
      db.run(
        "INSERT INTO reviews (order_id, user_id, flower_id, rating, content, status, created_at) VALUES (?,?,?,?,?, 'visible', ?)",
        [order.id, req.user.id, flowerId, rating, content, now()]
      );
      count += 1;
      // 重算商品综合评分
      const stat = db.get(
        "SELECT COALESCE(AVG(rating),5) AS avg FROM reviews WHERE flower_id = ? AND status = 'visible'",
        [flowerId]
      );
      db.run('UPDATE flowers SET rating = ? WHERE id = ?', [Math.round(stat.avg * 10) / 10, flowerId]);
    });
  });

  if (!count) throw new HttpError(400, '没有可评价的商品');
  return ok(res, { count }, '评价发布成功，感谢您的反馈');
};

/** 我的评价列表 */
exports.myList = (req, res) => {
  const db = req.app.locals.db;
  const list = db.all(
    `SELECT r.*, f.name AS flower_name, f.image AS flower_image
     FROM reviews r LEFT JOIN flowers f ON f.id = r.flower_id
     WHERE r.user_id = ? ORDER BY r.id DESC`,
    [req.user.id]
  );
  return ok(res, list);
};

// ===================== 后台管理 =====================

exports.adminList = (req, res) => {
  const db = req.app.locals.db;
  const { page: pageNum, pageSize, offset } = parsePaging(req.query, 10);
  const keyword = (req.query.keyword || '').trim();
  const status = (req.query.status || '').trim();

  const where = ['1=1'];
  const params = [];
  if (keyword) {
    where.push('(f.name LIKE ? OR r.content LIKE ? OR u.nickname LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status) {
    where.push('r.status = ?');
    params.push(status);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = db.get(
    `SELECT COUNT(*) AS c FROM reviews r
     LEFT JOIN flowers f ON f.id = r.flower_id
     LEFT JOIN users u ON u.id = r.user_id ${whereSql}`,
    params
  ).c;
  const list = db.all(
    `SELECT r.*, f.name AS flower_name, f.image AS flower_image, u.nickname, u.username
     FROM reviews r
     LEFT JOIN flowers f ON f.id = r.flower_id
     LEFT JOIN users u ON u.id = r.user_id
     ${whereSql} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    params.concat([pageSize, offset])
  );
  return page(res, list, total, pageNum, pageSize);
};

/** 隐藏 / 显示评价 */
exports.setStatus = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const status = req.body.status === 'hidden' ? 'hidden' : 'visible';
  db.run('UPDATE reviews SET status = ? WHERE id = ?', [status, id]);
  logOperation(db, req.user, '评价', status === 'hidden' ? '隐藏评价' : '显示评价', `评价 #${id}`);
  return ok(res, null, status === 'hidden' ? '评价已隐藏' : '评价已显示');
};

/** 管理员回复评价 */
exports.reply = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const data = validate(req.body, { reply: { required: '请输入回复内容', max: [200, '回复内容过长'] } });
  db.run('UPDATE reviews SET reply = ? WHERE id = ?', [data.reply, id]);
  logOperation(db, req.user, '评价', '回复评价', `回复评价 #${id}`);
  return ok(res, null, '回复成功');
};

exports.remove = (req, res) => {
  const db = req.app.locals.db;
  db.run('DELETE FROM reviews WHERE id = ?', [Number(req.params.id)]);
  logOperation(db, req.user, '评价', '删除评价', `删除评价 #${req.params.id}`);
  return ok(res, null, '评价已删除');
};
