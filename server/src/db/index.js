'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { createConnection, wrap } = require('./driver');

/**
 * 初始化数据库连接：确保 data 目录存在 -> 建表 -> 首次运行自动灌入演示数据
 */
function initDatabase() {
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

  const { db: raw, driver } = createConnection(config.dbFile);
  const db = wrap(raw);

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // 轻量迁移：兼容旧版本数据库缺失字段的情况
  migrate(db);

  const { count } = db.get('SELECT COUNT(*) AS count FROM flowers');
  if (!count) {
    require('./seed')(db);
  }

  return { db, driver };
}

/** 字段级增量迁移（新增列时无需删库） */
function migrate(db) {
  const columns = db.all('PRAGMA table_info(orders)').map((c) => c.name);
  if (!columns.includes('discount_amount')) {
    db.exec('ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0');
  }
  const flowerCols = db.all('PRAGMA table_info(flowers)').map((c) => c.name);
  if (!flowerCols.includes('rating')) {
    db.exec('ALTER TABLE flowers ADD COLUMN rating REAL NOT NULL DEFAULT 5.0');
  }
}

/** 记录后台操作日志 */
function logOperation(db, admin, moduleName, action, detail) {
  try {
    db.run(
      'INSERT INTO operation_logs (admin_id, admin_name, module, action, detail) VALUES (?,?,?,?,?)',
      [admin ? admin.id : null, admin ? admin.nickname || admin.username : '系统', moduleName, action, detail || '']
    );
  } catch (err) {
    // 日志失败不影响主流程
  }
}

module.exports = { initDatabase, logOperation };
