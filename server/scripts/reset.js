'use strict';

/**
 * 重置数据库并重新写入演示数据
 * 用法：npm run reset
 *
 * 两种执行路径：
 * 1. 【删文件】服务未运行时，直接删除数据库文件后重建 —— 最干净；
 * 2. 【清表】服务正在运行导致文件被占用（Windows 报 EBUSY）时，
 *    改为清空全部数据表并重建结构，保证服务运行时同样能重置成功。
 */

const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { createConnection, wrap } = require('../src/db/driver');

/** 按外键依赖倒序排列，先删子表 */
const TABLES = [
  'operation_logs',
  'favorites',
  'reviews',
  'order_items',
  'orders',
  'cart_items',
  'flowers',
  'categories',
  'addresses',
  'users',
];

const SCHEMA_FILE = path.join(__dirname, '..', 'src', 'db', 'schema.sql');

let mode = '删文件';

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

try {
  if (fs.existsSync(config.dbFile)) {
    fs.unlinkSync(config.dbFile);
    console.log('已删除旧数据库文件：' + config.dbFile);
  }
  ['-wal', '-shm'].forEach((suffix) => {
    const file = config.dbFile + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
} catch (err) {
  mode = '清表';
  console.log('注意：数据库文件被占用（' + err.code + '），改用「清空数据表」方式重置。');
  console.log('      若服务正在运行，重置后新数据会立即生效，无需重启。');
}

/** 文件未能删除时：清空全部数据表 */
if (mode === '清表') {
  const { db: raw } = createConnection(config.dbFile);
  const db = wrap(raw);
  try {
    db.exec('PRAGMA foreign_keys = OFF');
    TABLES.forEach((table) => db.exec('DROP TABLE IF EXISTS ' + table));
    db.exec('DELETE FROM sqlite_sequence');
    db.exec(fs.readFileSync(SCHEMA_FILE, 'utf8'));
    db.exec('PRAGMA foreign_keys = ON');
  } finally {
    raw.close();
  }
}

// 重建结构并（在 flowers 表为空时）自动灌入演示数据
const { initDatabase } = require('../src/db');
const { db, driver } = initDatabase();

console.log('');
console.log('数据库重置完成（方式：' + mode + '）');
console.log('  驱动：  ' + driver);
console.log('  分类：  ' + count('categories') + ' 条');
console.log('  商品：  ' + count('flowers') + ' 件');
console.log('  用户：  ' + count('users') + ' 个');
console.log('  订单：  ' + count('orders') + ' 笔');
console.log('  评价：  ' + count('reviews') + ' 条');
console.log('');

function count(table) {
  try {
    return db.get('SELECT COUNT(*) AS c FROM ' + table).c;
  } catch (e) {
    return '-';
  }
}
