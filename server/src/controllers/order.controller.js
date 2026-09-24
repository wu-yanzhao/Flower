'use strict';

const { validate } = require('../utils/validate');
const { HttpError } = require('../utils/http-error');
const { ok, page } = require('../utils/response');
const { generateOrderNo, parsePaging, money, now } = require('../utils/helpers');
const { buildSummary } = require('./cart.controller');
const { logOperation } = require('../db');

/** 订单状态说明（前后端共用语义） */
const STATUS_TEXT = {
  pending: '待付款',
  paid: '待发货',
  shipped: '待收货',
  completed: '已完成',
  canceled: '已取消',
};

/** 允许的状态流转：from -> [可变更为的状态] */
const TRANSITIONS = {
  pending: ['paid', 'canceled'],
  paid: ['shipped', 'canceled'],
  shipped: ['completed', 'canceled'],
  completed: [],
  canceled: [],
};

/**
 * 提交订单
 * 支持两种模式：
 *  - 购物车结算：cartIds = [购物车条目 id]
 *  - 立即购买：buyNow = { flowerId, quantity }
 * 事务内完成：库存校验 -> 扣减库存 -> 生成订单与明细 -> 清理购物车 -> 累加销量
 */
exports.create = (req, res) => {
  const db = req.app.locals.db;
  const body = req.body || {};
  const data = validate(body, {
    cartIds: {},
    buyNow: {},
    addressId: { type: 'integer' },
    receiver: {},
    phone: {},
    address: {},
    remark: {},
  });

  // 1. 组装待购买商品
  let items = [];
  if (data.buyNow && data.buyNow.flowerId) {
    const qty = Math.max(1, parseInt(data.buyNow.quantity, 10) || 1);
    const flower = db.get('SELECT * FROM flowers WHERE id = ?', [Number(data.buyNow.flowerId)]);
    if (!flower) throw new HttpError(404, '商品不存在');
    if (flower.status !== 'on') throw new HttpError(400, `「${flower.name}」已下架`);
    if (flower.stock < qty) throw new HttpError(400, `「${flower.name}」库存不足，仅剩 ${flower.stock} 件`);
    items.push({ flower, quantity: qty, cartId: null });
  } else {
    const ids = Array.isArray(data.cartIds) ? data.cartIds.map(Number).filter(Boolean) : [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const rows = db.all(
        `SELECT ci.id AS cart_id, ci.quantity, f.* FROM cart_items ci JOIN flowers f ON f.id = ci.flower_id
         WHERE ci.id IN (${placeholders}) AND ci.user_id = ?`,
        ids.concat([req.user.id])
      );
      items = rows.map((r) => ({ flower: r, quantity: r.quantity, cartId: r.cart_id }));
    } else {
      // 未传 cartIds 时默认结算购物车中所有勾选商品
      const rows = db.all(
        `SELECT ci.id AS cart_id, ci.quantity, f.* FROM cart_items ci JOIN flowers f ON f.id = ci.flower_id
         WHERE ci.user_id = ? AND ci.checked = 1`,
        [req.user.id]
      );
      items = rows.map((r) => ({ flower: r, quantity: r.quantity, cartId: r.cart_id }));
    }
  }

  const validItems = items.filter((it) => it.flower.status === 'on');
  if (!validItems.length) throw new HttpError(400, '请选择要结算的商品');
  validItems.forEach((it) => {
    if (it.flower.stock < it.quantity) {
      throw new HttpError(400, `「${it.flower.name}」库存不足，仅剩 ${it.flower.stock} 件`);
    }
  });

  // 2. 收货信息
  let receiverName = data.receiver;
  let receiverPhone = data.phone;
  let receiverAddress = data.address;
  if (data.addressId) {
    const addr = db.get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [data.addressId, req.user.id]);
    if (!addr) throw new HttpError(404, '收货地址不存在');
    receiverName = addr.receiver;
    receiverPhone = addr.phone;
    receiverAddress = `${addr.region} ${addr.detail}`;
  }
  validate({ receiver: receiverName, phone: receiverPhone, address: receiverAddress }, {
    receiver: { required: '请填写收货人姓名' },
    phone: { required: '请填写联系电话', pattern: [/^1[3-9]\d{9}$/, '联系电话格式不正确'] },
    address: { required: '请填写收货地址', min: [4, '收货地址太短'] },
  });

  // 3. 金额计算（与购物车一致的满减规则）
  const summary = buildSummary(
    validItems.map((it) => ({
      checked: 1,
      status: 'on',
      price: it.flower.price,
      quantity: it.quantity,
    }))
  );

  const orderNo = generateOrderNo();
  let orderId = 0;

  db.transaction(() => {
    const info = db.run(
      `INSERT INTO orders
        (order_no, user_id, receiver_name, receiver_phone, receiver_address, remark,
         total_amount, discount_amount, pay_amount, item_count, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?, 'pending', ?)`,
      [
        orderNo, req.user.id, receiverName, receiverPhone, receiverAddress, data.remark || '',
        summary.totalAmount, summary.discount, summary.payAmount,
        validItems.reduce((s, it) => s + it.quantity, 0), now(),
      ]
    );
    orderId = info.lastInsertRowid;

    validItems.forEach((it) => {
      db.run(
        'INSERT INTO order_items (order_id, flower_id, flower_name, flower_image, price, quantity, subtotal) VALUES (?,?,?,?,?,?,?)',
        [orderId, it.flower.id, it.flower.name, it.flower.image, it.flower.price, it.quantity,
          money(it.flower.price * it.quantity)]
      );
      // 扣减库存、累加销量
      db.run('UPDATE flowers SET stock = stock - ?, sales = sales + ?, updated_at = ? WHERE id = ?', [
        it.quantity, it.quantity, now(), it.flower.id,
      ]);
      if (it.cartId) db.run('DELETE FROM cart_items WHERE id = ?', [it.cartId]);
    });
  });

  return ok(res, { orderId, orderNo, payAmount: summary.payAmount }, '下单成功，请在 30 分钟内完成支付');
};

/** 我的订单列表：状态筛选 + 关键词（订单号 / 商品名） */
exports.list = (req, res) => {
  const db = req.app.locals.db;
  const { page: pageNum, pageSize, offset } = parsePaging(req.query, 10);
  const status = (req.query.status || '').trim();
  const keyword = (req.query.keyword || '').trim();

  const where = ['o.user_id = ?'];
  const params = [req.user.id];
  if (status) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (keyword) {
    where.push('(o.order_no LIKE ? OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.flower_name LIKE ?))');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = db.get(`SELECT COUNT(*) AS c FROM orders o ${whereSql}`, params).c;
  const list = db.all(
    `SELECT o.* FROM orders o ${whereSql} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    params.concat([pageSize, offset])
  );
  attachItems(db, list);
  return page(res, list, total, pageNum, pageSize);
};

/** 订单详情（含明细与状态时间轴） */
exports.detail = (req, res) => {
  const db = req.app.locals.db;
  const order = findOrder(db, req.params.id, req.user);
  const items = db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const user = db.get('SELECT id, username, nickname, phone FROM users WHERE id = ?', [order.user_id]);
  const reviews = db.all('SELECT * FROM reviews WHERE order_id = ?', [order.id]);
  return ok(
    res,
    Object.assign({}, order, {
      items,
      user,
      reviews,
      statusText: STATUS_TEXT[order.status],
      timeline: buildTimeline(order),
      canReview: order.status === 'completed',
    })
  );
};

/** 模拟支付 */
exports.pay = (req, res) => {
  const db = req.app.locals.db;
  const order = findOrder(db, req.params.id, req.user);
  assertTransition(order, 'paid');
  const data = validate(req.body, { payMethod: { enum: ['微信支付', '支付宝', '余额支付'], default: '微信支付' } });
  db.run("UPDATE orders SET status = 'paid', pay_method = ?, paid_at = ? WHERE id = ?", [
    data.payMethod, now(), order.id,
  ]);
  logOperation(db, req.user, '订单', '支付', `支付订单 ${order.order_no}`);
  return ok(res, { status: 'paid' }, '支付成功，商家将尽快为您发货');
};

/** 用户取消订单（待付款 / 待发货可取消），取消后回滚库存 */
exports.cancel = (req, res) => {
  const db = req.app.locals.db;
  const order = findOrder(db, req.params.id, req.user);
  assertTransition(order, 'canceled');

  db.transaction(() => {
    db.run("UPDATE orders SET status = 'canceled', canceled_at = ? WHERE id = ?", [now(), order.id]);
    const items = db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    items.forEach((it) => {
      db.run('UPDATE flowers SET stock = stock + ?, sales = sales - ?, updated_at = ? WHERE id = ?', [
        it.quantity, it.quantity, now(), it.flower_id,
      ]);
      db.run('UPDATE flowers SET sales = CASE WHEN sales < 0 THEN 0 ELSE sales END WHERE id = ?', [it.flower_id]);
    });
  });
  return ok(res, { status: 'canceled' }, '订单已取消');
};

/** 确认收货 */
exports.receive = (req, res) => {
  const db = req.app.locals.db;
  const order = findOrder(db, req.params.id, req.user);
  assertTransition(order, 'completed');
  db.run("UPDATE orders SET status = 'completed', completed_at = ? WHERE id = ?", [now(), order.id]);
  return ok(res, { status: 'completed' }, '已确认收货，快去评价吧');
};

/** 删除订单（仅已取消的订单，软性清理） */
exports.remove = (req, res) => {
  const db = req.app.locals.db;
  const order = findOrder(db, req.params.id, req.user);
  if (order.status !== 'canceled') throw new HttpError(400, '仅已取消的订单可以删除');
  db.run('DELETE FROM orders WHERE id = ?', [order.id]);
  return ok(res, null, '订单已删除');
};

// ===================== 后台管理 =====================

/** 后台订单列表（可按订单号、收货人、状态筛选） */
exports.adminList = (req, res) => {
  const db = req.app.locals.db;
  const { page: pageNum, pageSize, offset } = parsePaging(req.query, 10);
  const status = (req.query.status || '').trim();
  const keyword = (req.query.keyword || '').trim();
  const startDate = (req.query.startDate || '').trim();
  const endDate = (req.query.endDate || '').trim();

  const where = ['1=1'];
  const params = [];
  if (status) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (keyword) {
    where.push('(o.order_no LIKE ? OR o.receiver_name LIKE ? OR o.receiver_phone LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (startDate) {
    where.push('date(o.created_at) >= date(?)');
    params.push(startDate);
  }
  if (endDate) {
    where.push('date(o.created_at) <= date(?)');
    params.push(endDate);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = db.get(`SELECT COUNT(*) AS c FROM orders o ${whereSql}`, params).c;
  const list = db.all(
    `SELECT o.*, u.username, u.nickname FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     ${whereSql} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    params.concat([pageSize, offset])
  );
  attachItems(db, list);
  return page(res, list, total, pageNum, pageSize);
};

/** 后台订单详情（不校验归属） */
exports.adminDetail = (req, res) => {
  const db = req.app.locals.db;
  const order = db.get('SELECT * FROM orders WHERE id = ?', [Number(req.params.id)]);
  if (!order) throw new HttpError(404, '订单不存在');
  const items = db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const user = db.get('SELECT id, username, nickname, phone FROM users WHERE id = ?', [order.user_id]);
  return ok(res, Object.assign({}, order, { items, user, statusText: STATUS_TEXT[order.status], timeline: buildTimeline(order) }));
};

/** 后台发货 */
exports.ship = (req, res) => {
  const db = req.app.locals.db;
  const order = db.get('SELECT * FROM orders WHERE id = ?', [Number(req.params.id)]);
  if (!order) throw new HttpError(404, '订单不存在');
  assertTransition(order, 'shipped');
  const data = validate(req.body, {
    expressCompany: { required: '请选择或填写物流公司' },
    expressNo: { required: '请输入物流单号', min: [4, '物流单号太短'] },
  });
  db.run("UPDATE orders SET status='shipped', express_company=?, express_no=?, shipped_at=? WHERE id = ?", [
    data.expressCompany, data.expressNo, now(), order.id,
  ]);
  logOperation(db, req.user, '订单', '发货', `订单 ${order.order_no} 发货（${data.expressCompany} ${data.expressNo}）`);
  return ok(res, { status: 'shipped' }, '发货成功');
};

/** 后台强制变更订单状态（用于演示状态机与异常处理） */
exports.adminSetStatus = (req, res) => {
  const db = req.app.locals.db;
  const order = db.get('SELECT * FROM orders WHERE id = ?', [Number(req.params.id)]);
  if (!order) throw new HttpError(404, '订单不存在');
  const data = validate(req.body, {
    status: { required: '请选择目标状态', enum: ['pending', 'paid', 'shipped', 'completed', 'canceled'] },
  });
  if (data.status === 'canceled' && order.status !== 'canceled') {
    db.transaction(() => {
      db.run("UPDATE orders SET status='canceled', canceled_at=? WHERE id = ?", [now(), order.id]);
      const items = db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      items.forEach((it) => {
        db.run('UPDATE flowers SET stock = stock + ?, updated_at = ? WHERE id = ?', [it.quantity, now(), it.flower_id]);
      });
    });
    logOperation(db, req.user, '订单', '取消', `管理员取消订单 ${order.order_no}`);
    return ok(res, null, '订单已取消');
  }
  const stampField = { paid: 'paid_at', shipped: 'shipped_at', completed: 'completed_at' }[data.status];
  db.run(`UPDATE orders SET status = ?${stampField ? `, ${stampField} = ?` : ''} WHERE id = ?`,
    stampField ? [data.status, now(), order.id] : [data.status, order.id]);
  logOperation(db, req.user, '订单', '状态变更', `订单 ${order.order_no} 状态改为 ${STATUS_TEXT[data.status]}`);
  return ok(res, null, `订单状态已更新为“${STATUS_TEXT[data.status]}”`);
};

// ===================== 工具函数 =====================

function findOrder(db, idOrNo, user) {
  const key = String(idOrNo);
  const order = db.get('SELECT * FROM orders WHERE (id = ? OR order_no = ?)', [Number(key) || 0, key]);
  if (!order) throw new HttpError(404, '订单不存在');
  if (user && order.user_id !== user.id && user.role !== 'admin') throw new HttpError(403, '无权查看他人订单');
  return order;
}

function assertTransition(order, next) {
  if (!TRANSITIONS[order.status] || !TRANSITIONS[order.status].includes(next)) {
    throw new HttpError(400, `订单当前状态为“${STATUS_TEXT[order.status]}”，无法执行该操作`);
  }
}

/** 为订单列表附加商品明细（首图用于列表展示） */
function attachItems(db, orders) {
  if (!orders.length) return;
  const ids = orders.map((o) => o.id);
  const placeholders = ids.map(() => '?').join(',');
  const items = db.all(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, ids);
  const map = {};
  items.forEach((it) => {
    map[it.order_id] = map[it.order_id] || [];
    map[it.order_id].push(it);
  });
  orders.forEach((o) => {
    o.items = map[o.id] || [];
    o.statusText = STATUS_TEXT[o.status];
  });
}

/** 订单跟踪时间轴 */
function buildTimeline(order) {
  const steps = [
    { key: 'created', label: '提交订单', time: order.created_at, desc: '订单已提交，等待付款' },
    { key: 'paid', label: '买家付款', time: order.paid_at, desc: order.pay_method ? `支付方式：${order.pay_method}` : '等待支付' },
    { key: 'shipped', label: '商家发货', time: order.shipped_at, desc: order.express_company ? `${order.express_company} ${order.express_no || ''}` : '等待商家发货' },
    { key: 'completed', label: '确认收货', time: order.completed_at, desc: '交易完成' },
  ];
  if (order.status === 'canceled') {
    return [
      { key: 'created', label: '提交订单', time: order.created_at, desc: '订单已提交' },
      { key: 'canceled', label: '订单取消', time: order.canceled_at, desc: '订单已取消，库存已回滚' },
    ];
  }
  return steps.map((s) => Object.assign({}, s, { done: !!s.time }));
}

module.exports.STATUS_TEXT = STATUS_TEXT;
