'use strict';

const { validate } = require('../utils/validate');
const { HttpError } = require('../utils/http-error');
const { ok, page } = require('../utils/response');
const { parsePaging, now } = require('../utils/helpers');

/** 排序字段白名单，避免 SQL 注入 */
const SORT_MAP = {
  default: 'f.recommended DESC, f.sales DESC, f.id DESC',
  sales: 'f.sales DESC, f.id DESC',
  price_asc: 'f.price ASC',
  price_desc: 'f.price DESC',
  new: 'f.id DESC',
  rating: 'f.rating DESC, f.sales DESC',
};

/**
 * 前台商品列表：关键词 / 分类 / 价格区间 / 排序 / 分页
 */
exports.list = (req, res) => {
  const db = req.app.locals.db;
  const { page: pageNum, pageSize, offset } = parsePaging(req.query);
  const keyword = (req.query.keyword || '').trim();
  const categoryId = parseInt(req.query.categoryId, 10);
  const minPrice = parseFloat(req.query.minPrice);
  const maxPrice = parseFloat(req.query.maxPrice);
  const sort = SORT_MAP[req.query.sort] ? req.query.sort : 'default';
  const recommended = req.query.recommended === '1';

  const where = ["f.status = 'on'"];
  const params = [];
  if (keyword) {
    where.push('(f.name LIKE ? OR f.subtitle LIKE ? OR f.flower_language LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  if (Number.isFinite(categoryId) && categoryId > 0) {
    where.push('f.category_id = ?');
    params.push(categoryId);
  }
  if (Number.isFinite(minPrice)) {
    where.push('f.price >= ?');
    params.push(minPrice);
  }
  if (Number.isFinite(maxPrice)) {
    where.push('f.price <= ?');
    params.push(maxPrice);
  }
  if (recommended) where.push('f.recommended = 1');

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = db.get(`SELECT COUNT(*) AS c FROM flowers f ${whereSql}`, params).c;
  const list = db.all(
    `SELECT f.*, c.name AS category_name
     FROM flowers f LEFT JOIN categories c ON c.id = f.category_id
     ${whereSql}
     ORDER BY ${SORT_MAP[sort]}
     LIMIT ? OFFSET ?`,
    params.concat([pageSize, offset])
  );
  return page(res, list, total, pageNum, pageSize);
};

/** 商品详情：基本信息 + 分类 + 评价统计 */
exports.detail = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const flower = db.get(
    `SELECT f.*, c.name AS category_name
     FROM flowers f LEFT JOIN categories c ON c.id = f.category_id
     WHERE f.id = ?`,
    [id]
  );
  if (!flower) throw new HttpError(404, '商品不存在或已下架');

  const reviewStat = db.get(
    "SELECT COUNT(*) AS count, COALESCE(AVG(rating),5) AS avg FROM reviews WHERE flower_id = ? AND status = 'visible'",
    [id]
  );
  let favorited = false;
  if (req.user) {
    favorited = !!db.get('SELECT id FROM favorites WHERE user_id = ? AND flower_id = ?', [req.user.id, id]);
  }
  return ok(
    res,
    Object.assign({}, flower, {
      reviewCount: reviewStat.count,
      reviewAvg: Math.round((reviewStat.avg || 5) * 10) / 10,
      favorited,
    })
  );
};

/** 商品评价列表 */
exports.reviews = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const { page: pageNum, pageSize, offset } = parsePaging(req.query, 10);
  const total = db.get("SELECT COUNT(*) AS c FROM reviews WHERE flower_id = ? AND status = 'visible'", [id]).c;
  const list = db.all(
    `SELECT r.*, u.nickname, u.avatar
     FROM reviews r LEFT JOIN users u ON u.id = r.user_id
     WHERE r.flower_id = ? AND r.status = 'visible'
     ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    [id, pageSize, offset]
  );
  return page(res, list, total, pageNum, pageSize);
};

/** 首页推荐商品 */
exports.recommend = (req, res) => {
  const db = req.app.locals.db;
  const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
  const list = db.all(
    `SELECT f.*, c.name AS category_name FROM flowers f
     LEFT JOIN categories c ON c.id = f.category_id
     WHERE f.status='on' AND f.recommended = 1
     ORDER BY f.sales DESC LIMIT ?`,
    [limit]
  );
  return ok(res, list);
};

// ===================== 后台管理 =====================

/** 后台商品列表（含下架商品） */
exports.adminList = (req, res) => {
  const db = req.app.locals.db;
  const { page: pageNum, pageSize, offset } = parsePaging(req.query, 10);
  const keyword = (req.query.keyword || '').trim();
  const categoryId = parseInt(req.query.categoryId, 10);
  const status = (req.query.status || '').trim();

  const where = ['1=1'];
  const params = [];
  if (keyword) {
    where.push('(f.name LIKE ? OR f.subtitle LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (Number.isFinite(categoryId) && categoryId > 0) {
    where.push('f.category_id = ?');
    params.push(categoryId);
  }
  if (status) {
    where.push('f.status = ?');
    params.push(status);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = db.get(`SELECT COUNT(*) AS c FROM flowers f ${whereSql}`, params).c;
  const list = db.all(
    `SELECT f.*, c.name AS category_name FROM flowers f
     LEFT JOIN categories c ON c.id = f.category_id
     ${whereSql} ORDER BY f.id DESC LIMIT ? OFFSET ?`,
    params.concat([pageSize, offset])
  );
  return page(res, list, total, pageNum, pageSize);
};

/** 新增商品 */
exports.create = (req, res) => {
  const db = req.app.locals.db;
  const data = validateFlower(req.body);
  const info = db.run(
    `INSERT INTO flowers
      (category_id, name, subtitle, price, original_price, stock, image, description,
       material, flower_language, packing, status, recommended, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.category_id, data.name, data.subtitle || '', data.price, data.original_price || data.price,
      data.stock || 0, data.image || '', data.description || '', data.material || '',
      data.flower_language || '', data.packing || '', data.status || 'on', data.recommended ? 1 : 0,
      now(), now(),
    ]
  );
  return ok(res, { id: info.lastInsertRowid }, '商品新增成功');
};

/** 修改商品 */
exports.update = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const flower = db.get('SELECT * FROM flowers WHERE id = ?', [id]);
  if (!flower) throw new HttpError(404, '商品不存在');

  const data = validateFlower(req.body, true);
  db.run(
    `UPDATE flowers SET category_id=?, name=?, subtitle=?, price=?, original_price=?, stock=?,
      image=?, description=?, material=?, flower_language=?, packing=?, status=?, recommended=?, updated_at=?
     WHERE id = ?`,
    [
      data.category_id, data.name, data.subtitle || '', data.price,
      data.original_price !== undefined ? data.original_price : data.price,
      data.stock || 0, data.image || '', data.description || '', data.material || '',
      data.flower_language || '', data.packing || '', data.status || 'on', data.recommended ? 1 : 0,
      now(), id,
    ]
  );
  return ok(res, null, '商品修改成功');
};

/** 删除商品（物理删除；如已被下单则提示） */
exports.remove = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const used = db.get('SELECT COUNT(*) AS c FROM order_items WHERE flower_id = ?', [id]).c;
  if (used) throw new HttpError(400, '该商品已产生历史订单，建议改为“下架”而不是删除');
  const reviewed = db.get('SELECT COUNT(*) AS c FROM reviews WHERE flower_id = ?', [id]).c;
  if (reviewed) throw new HttpError(400, '该商品已产生用户评价，建议改为“下架”而不是删除');
  const info = db.run('DELETE FROM flowers WHERE id = ?', [id]);
  if (!info.changes) throw new HttpError(404, '商品不存在');
  return ok(res, null, '商品已删除');
};

/** 上架 / 下架 */
exports.setStatus = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const status = req.body.status === 'on' ? 'on' : 'off';
  const info = db.run('UPDATE flowers SET status = ?, updated_at = ? WHERE id = ?', [status, now(), id]);
  if (!info.changes) throw new HttpError(404, '商品不存在');
  return ok(res, null, status === 'on' ? '商品已上架' : '商品已下架');
};

/** 快速调整库存 */
exports.adjustStock = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const delta = parseInt(req.body.delta, 10);
  if (!Number.isFinite(delta)) throw new HttpError(400, '库存调整数量不合法');
  const flower = db.get('SELECT * FROM flowers WHERE id = ?', [id]);
  if (!flower) throw new HttpError(404, '商品不存在');
  const next = Math.max(0, flower.stock + delta);
  db.run('UPDATE flowers SET stock = ?, updated_at = ? WHERE id = ?', [next, now(), id]);
  return ok(res, { stock: next }, '库存已调整');
};

/** 商品字段校验规则（新增/编辑共用） */
function validateFlower(body, isUpdate) {
  const rules = {
    category_id: { required: '请选择商品分类', type: 'integer' },
    name: { required: '请输入商品名称', max: [60, '商品名称过长'] },
    subtitle: { max: [80, '副标题过长'] },
    price: { required: '请输入售价', type: 'number', min: [0.01, '售价必须大于 0'] },
    original_price: { type: 'number', min: [0, '原价不能为负'] },
    stock: { required: '请输入库存', type: 'integer', min: [0, '库存不能为负'] },
    image: {},
    description: {},
    material: {},
    flower_language: {},
    packing: {},
    status: { enum: ['on', 'off'] },
    recommended: {},
  };
  if (isUpdate) {
    rules.category_id.required = '请选择商品分类';
  }
  const data = validate(body, rules);
  if (data.recommended !== undefined) {
    data.recommended = Number(data.recommended) ? 1 : 0;
  }
  return data;
}
