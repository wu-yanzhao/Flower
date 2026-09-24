'use strict';

const crypto = require('crypto');

const KEY_LEN = 64;

/**
 * 使用 Node 内置 scrypt 算法做口令散列（无需第三方 bcrypt 依赖，免编译）
 * 存储格式：scrypt$N$r$p$salt$hash
 */
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const N = 16384;
  const r = 8;
  const p = 1;
  const derived = crypto.scryptSync(String(plain), salt, KEY_LEN, { N, r, p }).toString('hex');
  return `scrypt$${N}$${r}$${p}$${salt}$${derived}`;
}

function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt, hash] = parts;
  try {
    const derived = crypto.scryptSync(String(plain), salt, hash.length / 2, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    const a = Buffer.from(hash, 'hex');
    return a.length === derived.length && crypto.timingSafeEqual(a, derived);
  } catch (err) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
