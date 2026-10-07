'use strict';

const crypto = require('crypto');
const config = require('../config');

/**
 * 生成业务订单号：FS + yyyyMMddHHmmss + 4 位随机。
 * 传入 db 时会在库中做唯一性校验并有限重试，杜绝同秒高并发下的订单号碰撞。
 */
function generateOrderNo(db) {
  const build = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(
      d.getMinutes()
    )}${pad(d.getSeconds())}`;
    const rand = crypto.randomInt(0, 10000);
    return `FS${stamp}${String(rand).padStart(4, '0')}`;
  };
  if (!db) return build();
  for (let i = 0; i < 10; i += 1) {
    const no = build();
    const row = db.get('SELECT 1 FROM orders WHERE order_no = ?', [no]);
    if (!row) return no;
  }
  // 极小概率下兜底：加 3 位随机后缀，基本不可能再撞
  return `${build()}${crypto.randomInt(100, 1000)}`;
}

/** 解析分页参数 */
function parsePaging(query, defaultPageSize = config.defaultPageSize) {
  let page = parseInt(query.page, 10);
  let pageSize = parseInt(query.pageSize, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  if (pageSize > config.maxPageSize) pageSize = config.maxPageSize;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** 过滤掉用户表中的敏感字段 */
function safeUser(row) {
  if (!row) return null;
  const { password_hash, salt, ...rest } = row;
  return rest;
}

/** 金额保留两位小数 */
function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** 本地时间字符串 */
function now() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

/** 近 n 天日期数组（yyyy-MM-dd） */
function lastDays(n) {
  const result = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const pad = (x) => String(x).padStart(2, '0');
    result.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return result;
}

module.exports = { generateOrderNo, parsePaging, safeUser, money, now, lastDays };
