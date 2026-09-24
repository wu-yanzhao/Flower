'use strict';

const crypto = require('crypto');
const config = require('../config');

/** 生成业务订单号：FS + yyyyMMddHHmmss + 4 位随机 */
function generateOrderNo() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
  const rand = crypto.randomInt(0, 10000);
  return `FS${stamp}${String(rand).padStart(4, '0')}`;
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
