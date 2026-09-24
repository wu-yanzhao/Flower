'use strict';

const { validate } = require('../utils/validate');
const { HttpError } = require('../utils/http-error');
const { ok } = require('../utils/response');

/** 我的收货地址列表 */
exports.list = (req, res) => {
  const db = req.app.locals.db;
  const list = db.all(
    'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC',
    [req.user.id]
  );
  return ok(res, list);
};

/** 新增地址；若设为默认，先清空其它默认 */
exports.create = (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body, {
    receiver: { required: '请输入收货人姓名', max: [20, '收货人姓名过长'] },
    phone: { required: '请输入联系电话', pattern: [/^1[3-9]\d{9}$/, '手机号格式不正确'] },
    region: { required: '请选择所在地区' },
    detail: { required: '请输入详细地址', min: [2, '详细地址太短'] },
    is_default: { type: 'integer', default: 0 },
  });

  db.transaction(() => {
    if (data.is_default) {
      db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }
    db.run(
      'INSERT INTO addresses (user_id, receiver, phone, region, detail, is_default) VALUES (?,?,?,?,?,?)',
      [req.user.id, data.receiver, data.phone, data.region, data.detail, data.is_default ? 1 : 0]
    );
  });
  return ok(res, null, '地址已添加');
};

exports.update = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const data = validate(req.body, {
    receiver: { required: '请输入收货人姓名', max: [20, '收货人姓名过长'] },
    phone: { required: '请输入联系电话', pattern: [/^1[3-9]\d{9}$/, '手机号格式不正确'] },
    region: { required: '请选择所在地区' },
    detail: { required: '请输入详细地址', min: [2, '详细地址太短'] },
    is_default: { type: 'integer', default: 0 },
  });

  const addr = db.get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!addr) throw new HttpError(404, '地址不存在');

  db.transaction(() => {
    if (data.is_default) {
      db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }
    db.run('UPDATE addresses SET receiver=?, phone=?, region=?, detail=?, is_default=? WHERE id = ?', [
      data.receiver, data.phone, data.region, data.detail, data.is_default ? 1 : 0, id,
    ]);
  });
  return ok(res, null, '地址已更新');
};

exports.remove = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const info = db.run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!info.changes) throw new HttpError(404, '地址不存在');
  return ok(res, null, '地址已删除');
};

/** 设置为默认地址 */
exports.setDefault = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  db.transaction(() => {
    db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    const info = db.run('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!info.changes) throw new HttpError(404, '地址不存在');
  });
  return ok(res, null, '已设为默认地址');
};
