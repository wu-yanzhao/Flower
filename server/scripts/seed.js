'use strict';

/**
 * 追加演示数据：当 flowers 表为空时写入种子数据
 * 用法：npm run seed（想清空重建请用 npm run reset）
 */

const { initDatabase } = require('../src/db');
const { db } = initDatabase();
const count = db.get('SELECT COUNT(*) AS c FROM flowers').c;

if (count) {
  console.log(`商品表中已有 ${count} 条数据，未重复写入。如需重建请执行：npm run reset`);
} else {
  console.log('演示数据写入完成。');
}
