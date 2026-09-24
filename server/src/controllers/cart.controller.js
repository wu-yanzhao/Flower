'use strict';

const { validate } = require('../utils/validate');
const { HttpError } = require('../utils/http-error');
const { ok } = require('../utils/response');
const { money, now } = require('../utils/helpers');

/** 购物车列表（只展示上架商品，下架商品自动提示） */
exports.list = (req, res) => {
  const db = req.app.locals.db;
  const list = db.all(
    `SELECT ci.id, ci.quantity, ci.checked, f.id AS flower_id, f.name, f.subtitle, f.price,
            f.original_price, f.image, f.stock, f.status, f.category_id
     FROM cart_items ci JOIN flowers f ON f.id = ci.flower_id
     WHERE ci.user_id = ? ORDER BY ci.id DESC`,
    [req.user.id]
  );
  const summary = buildSummary(list);
  return ok(res, { list, summary });
};

/** 加入购物车：校验商品存在、上架、库存足够；已存在则累加数量 */
exports.add = (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body, {
    flowerId: { required: '请选择商品', type: 'integer' },
    quantity: { type: 'integer', default: 1, min: [1, '购买数量至少为 1'] },
  });

  const flower = db.get('SELECT * FROM flowers WHERE id = ?', [data.flowerId]);
  if (!flower) throw new HttpError(404, '商品不存在');
  if (flower.status !== 'on') throw new HttpError(400, '该商品已下架，无法加入购物车');
  if (flower.stock <= 0) throw new HttpError(400, '该商品已售罄');

  const exist = db.get('SELECT * FROM cart_items WHERE user_id = ? AND flower_id = ?', [req.user.id, data.flowerId]);
  const nextQty = (exist ? exist.quantity : 0) + data.quantity;
  if (nextQty > flower.stock) throw new HttpError(400, `库存不足，当前仅剩 ${flower.stock} 件`);

  if (exist) {
    db.run('UPDATE cart_items SET quantity = ?, updated_at = ? WHERE id = ?', [nextQty, now(), exist.id]);
  } else {
    db.run('INSERT INTO cart_items (user_id, flower_id, quantity, checked) VALUES (?,?,?,1)', [
      req.user.id, data.flowerId, nextQty,
    ]);
  }
  return ok(res, { count: cartCount(db, req.user.id) }, '已加入购物车');
};

/** 修改数量（0 表示删除） */
exports.update = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const data = validate(req.body, { quantity: { required: '请输入数量', type: 'integer', min: [0, '数量不能为负'] } });

  const item = db.get(
    `SELECT ci.*, f.stock, f.status, f.name FROM cart_items ci JOIN flowers f ON f.id = ci.flower_id
     WHERE ci.id = ? AND ci.user_id = ?`,
    [id, req.user.id]
  );
  if (!item) throw new HttpError(404, '购物车条目不存在');

  if (data.quantity === 0) {
    db.run('DELETE FROM cart_items WHERE id = ?', [id]);
    return ok(res, null, '已移出购物车');
  }
  if (item.status !== 'on') throw new HttpError(400, '该商品已下架，请从购物车移除');
  if (data.quantity > item.stock) throw new HttpError(400, `库存不足，当前仅剩 ${item.stock} 件`);

  db.run('UPDATE cart_items SET quantity = ?, updated_at = ? WHERE id = ?', [data.quantity, now(), id]);
  return ok(res, null, '数量已更新');
};

/** 勾选 / 取消勾选 */
exports.check = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const checked = req.body.checked === false || req.body.checked === 0 || req.body.checked === '0' ? 0 : 1;
  db.run('UPDATE cart_items SET checked = ?, updated_at = ? WHERE id = ? AND user_id = ?', [
    checked, now(), id, req.user.id,
  ]);
  return ok(res, null);
};

/** 全选 / 取消全选 */
exports.checkAll = (req, res) => {
  const db = req.app.locals.db;
  const checked = req.body.checked === false || req.body.checked === 0 || req.body.checked === '0' ? 0 : 1;
  db.run('UPDATE cart_items SET checked = ?, updated_at = ? WHERE user_id = ?', [checked, now(), req.user.id]);
  return ok(res, null);
};

exports.remove = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  db.run('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [id, req.user.id]);
  return ok(res, null, '已移出购物车');
};

exports.clear = (req, res) => {
  const db = req.app.locals.db;
  db.run('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
  return ok(res, null, '购物车已清空');
};

/** 顶部徽标数量 */
exports.count = (req, res) => ok(res, { count: cartCount(req.app.locals.db, req.user.id) });

function cartCount(db, userId) {
  return db.get('SELECT COALESCE(SUM(quantity),0) AS c FROM cart_items WHERE user_id = ?', [userId]).c;
}

/** 计算勾选商品的小计（同时被结算流程复用） */
function buildSummary(list) {
  const checked = list.filter((i) => i.checked === 1 && i.status === 'on');
  const totalAmount = money(checked.reduce((s, i) => s + i.price * i.quantity, 0));
  const count = checked.reduce((s, i) => s + i.quantity, 0);
  // 满减规则：满 500 减 50，满 300 减 20
  let discount = 0;
  if (totalAmount >= 500) discount = 50;
  else if (totalAmount >= 300) discount = 20;
  return {
    count,
    totalAmount,
    discount: money(discount),
    payAmount: money(totalAmount - discount),
    allCount: list.reduce((s, i) => s + i.quantity, 0),
  };
}

module.exports.buildSummary = buildSummary;
