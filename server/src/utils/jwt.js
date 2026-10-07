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
  const body = Object.assign({}, payload, {
    jti: crypto.randomBytes(8).toString('hex'), // 唯一标识，用于登出吊销
    iat: now,
    exp: now + Number(expiresIn),
  });
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
  // 校验头部声明的算法，杜绝 alg=none 等降级攻击
  let header;
  try {
    header = JSON.parse(base64urlDecode(h).toString('utf8'));
  } catch (err) {
    throw new Error('访问令牌头部非法');
  }
  if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('访问令牌算法不受支持');
  }
  const expected = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${h}.${p}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  // 使用恒定时间比较，避免计时侧信道泄露签名信息
  const a = Buffer.from(expected);
  const b = Buffer.from(s);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('访问令牌签名校验失败');
  }
  const payload = JSON.parse(base64urlDecode(p).toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('访问令牌已过期，请重新登录');
  }
  return payload;
}

module.exports = { sign, verify };
