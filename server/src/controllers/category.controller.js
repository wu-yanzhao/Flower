'use strict';

const { validate } = require('../utils/validate');
const { HttpError } = require('../utils/http-error');
const { ok } = require('../utils/response');

/** 前台分类列表（带每个分类的在售商品数量） */
exports.list = (req, res) => {
  const db = req.app.locals.db;
  const list = db.all(
    `SELECT c.*, (SELECT COUNT(*) FROM flowers f WHERE f.category_id = c.id AND f.status='on') AS flower_count
     FROM categories c ORDER BY c.sort ASC, c.id ASC`
  );
  return ok(res, list);
};

exports.create = (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body, {
    name: { required: '请输入分类名称', max: [20, '分类名称过长'] },
    description: {},
    sort: { type: 'integer', default: 0 },
  });
  const exist = db.get('SELECT id FROM categories WHERE name = ?', [data.name]);
  if (exist) throw new HttpError(400, '该分类已存在');
  const info = db.run('INSERT INTO categories (name, description, sort) VALUES (?,?,?)', [
    data.name, data.description || '', data.sort || 0,
  ]);
  return ok(res, { id: info.lastInsertRowid }, '分类新增成功');
};

exports.update = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const data = validate(req.body, {
    name: { required: '请输入分类名称', max: [20, '分类名称过长'] },
    description: {},
    sort: { type: 'integer', default: 0 },
  });
  const info = db.run('UPDATE categories SET name=?, description=?, sort=? WHERE id = ?', [
    data.name, data.description || '', data.sort || 0, id,
  ]);
  if (!info.changes) throw new HttpError(404, '分类不存在');
  return ok(res, null, '分类已更新');
};

exports.remove = (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const used = db.get('SELECT COUNT(*) AS c FROM flowers WHERE category_id = ?', [id]).c;
  if (used) throw new HttpError(400, `该分类下还有 ${used} 个商品，不能删除`);
  db.run('DELETE FROM categories WHERE id = ?', [id]);
  return ok(res, null, '分类已删除');
};
