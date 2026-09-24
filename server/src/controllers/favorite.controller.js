'use strict';

const { validate } = require('../utils/validate');
const { HttpError } = require('../utils/http-error');
const { ok } = require('../utils/response');

/** 我的收藏 */
exports.list = (req, res) => {
  const db = req.app.locals.db;
  const list = db.all(
    `SELECT f.*, fa.created_at AS favorited_at
     FROM favorites fa JOIN flowers f ON f.id = fa.flower_id
     WHERE fa.user_id = ? ORDER BY fa.id DESC`,
    [req.user.id]
  );
  return ok(res, list);
};

/** 收藏 / 取消收藏（幂等切换） */
exports.toggle = (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body || {}, { flowerId: { required: '缺少商品信息', type: 'integer' } });
  const flower = db.get('SELECT id FROM flowers WHERE id = ?', [data.flowerId]);
  if (!flower) throw new HttpError(404, '商品不存在');

  const exist = db.get('SELECT id FROM favorites WHERE user_id = ? AND flower_id = ?', [req.user.id, data.flowerId]);
  if (exist) {
    db.run('DELETE FROM favorites WHERE id = ?', [exist.id]);
    return ok(res, { favorited: false }, '已取消收藏');
  }
  db.run('INSERT INTO favorites (user_id, flower_id) VALUES (?,?)', [req.user.id, data.flowerId]);
  return ok(res, { favorited: true }, '收藏成功');
};

exports.remove = (req, res) => {
  const db = req.app.locals.db;
  db.run('DELETE FROM favorites WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
  return ok(res, null, '已取消收藏');
};
