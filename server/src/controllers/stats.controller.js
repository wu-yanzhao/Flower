'use strict';

const { ok } = require('../utils/response');
const { lastDays, money } = require('../utils/helpers');

/** 有效订单条件：已取消不计入销售额 */
const VALID = "status IN ('paid','shipped','completed')";

/**
 * 数据概览：核心指标卡片
 */
exports.overview = (req, res) => {
  const db = req.app.locals.db;
  const today = lastDays(1)[0];

  const sales = db.get(`SELECT COALESCE(SUM(pay_amount),0) AS total FROM orders WHERE ${VALID}`).total;
  const todaySales = db.get(`SELECT COALESCE(SUM(pay_amount),0) AS total FROM orders WHERE ${VALID} AND date(created_at) = ?`, [today]).total;
  const orderCount = db.get(`SELECT COUNT(*) AS c FROM orders WHERE ${VALID}`).c;
  const todayOrders = db.get(`SELECT COUNT(*) AS c FROM orders WHERE date(created_at) = ?`, [today]).c;
  const userCount = db.get("SELECT COUNT(*) AS c FROM users WHERE role = 'customer'").c;
  const flowerCount = db.get("SELECT COUNT(*) AS c FROM flowers WHERE status = 'on'").c;
  const pendingCount = db.get("SELECT COUNT(*) AS c FROM orders WHERE status = 'paid'").c;
  const shippedCount = db.get("SELECT COUNT(*) AS c FROM orders WHERE status = 'shipped'").c;
  const reviewCount = db.get("SELECT COUNT(*) AS c FROM reviews WHERE status = 'visible'").c;
  const lowStock = db.get("SELECT COUNT(*) AS c FROM flowers WHERE stock <= 10 AND status = 'on'").c;
  const avgOrder = orderCount ? sales / orderCount : 0;

  return ok(res, {
    sales: money(sales),
    todaySales: money(todaySales),
    orderCount,
    todayOrders,
    userCount,
    flowerCount,
    pendingCount,
    shippedCount,
    reviewCount,
    lowStock,
    avgOrder: money(avgOrder),
  });
};

/** 近 n 天销售趋势（折线图） */
exports.trend = (req, res) => {
  const db = req.app.locals.db;
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 30);
  const dates = lastDays(days);
  const rows = db.all(
    `SELECT date(created_at) AS d, COALESCE(SUM(pay_amount),0) AS amount, COUNT(*) AS orders
     FROM orders WHERE ${VALID} AND date(created_at) >= date(?)
     GROUP BY date(created_at)`,
    [dates[0]]
  );
  const map = {};
  rows.forEach((r) => {
    map[r.d] = r;
  });
  const list = dates.map((d) => ({
    date: d.slice(5),
    amount: money((map[d] && map[d].amount) || 0),
    // 兼容前端图表字段命名
    sales: money((map[d] && map[d].amount) || 0),
    orders: (map[d] && map[d].orders) || 0,
  }));
  return ok(res, list);
};

/** 热销商品 TOP N（横向柱状图） */
exports.top = (req, res) => {
  const db = req.app.locals.db;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
  const list = db.all(
    `SELECT f.id, f.name, f.image, f.sales, f.stock,
            COALESCE(SUM(oi.quantity),0) AS sold,
            COALESCE(SUM(oi.subtotal),0) AS amount
     FROM flowers f LEFT JOIN order_items oi ON oi.flower_id = f.id
     GROUP BY f.id ORDER BY f.sales DESC, sold DESC LIMIT ?`,
    [limit]
  );
  return ok(
    res,
    list.map((i) => Object.assign({}, i, { amount: money(i.amount), quantity: i.sales || 0 }))
  );
};

/** 分类销量分布（饼图 / 环形图） */
exports.category = (req, res) => {
  const db = req.app.locals.db;
  const list = db.all(
    `SELECT c.id, c.name, COALESCE(SUM(f.sales),0) AS quantity
     FROM categories c LEFT JOIN flowers f ON f.category_id = c.id AND f.status = 'on'
     GROUP BY c.id ORDER BY quantity DESC`
  );
  return ok(res, list);
};

/** 订单状态分布 */
exports.status = (req, res) => {
  const db = req.app.locals.db;
  const rows = db.all('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
  const text = { pending: '待付款', paid: '待发货', shipped: '待收货', completed: '已完成', canceled: '已取消' };
  return ok(res, rows.map((r) => ({ status: r.status, name: text[r.status] || r.status, count: r.count })));
};

/** 最新订单（仪表盘“最新订单”卡片） */
exports.recent = (req, res) => {
  const db = req.app.locals.db;
  const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
  const orders = db.all(
    `SELECT o.id, o.order_no, o.pay_amount, o.status, o.created_at, u.nickname
     FROM orders o LEFT JOIN users u ON u.id = o.user_id
     ORDER BY o.id DESC LIMIT ?`,
    [limit]
  );
  return ok(res, orders);
};

/** 后台操作日志（审计） */
exports.logs = (req, res) => {
  const db = req.app.locals.db;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const list = db.all('SELECT * FROM operation_logs ORDER BY id DESC LIMIT ?', [limit]);
  return ok(res, list);
};
