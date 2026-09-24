'use strict';

const crypto = require('crypto');
const config = require('../config');

/**
 * 轻量 JWT 实现（HS256），使用 Node 内置 crypto，避免引入 jsonwebtoken 依赖。
 * token 结构：header.payload.signature，payload 中携带 userId / role / exp
 */

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function sign(payload, expiresIn = config.jwtExpiresIn) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, { iat: now, exp: now + Number(expiresIn) });
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(body));
  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * 校验 token；失败时抛出 Error，由中间件统一转换为 401
 */
function verify(token) {
  if (!token || typeof token !== 'string') throw new Error('缺少访问令牌');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('访问令牌格式非法');
  const [h, p, s] = parts;
  const expected = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${h}.${p}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  if (expected !== s) throw new Error('访问令牌签名校验失败');
  const payload = JSON.parse(base64urlDecode(p).toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('访问令牌已过期，请重新登录');
  }
  return payload;
}

module.exports = { sign, verify };
