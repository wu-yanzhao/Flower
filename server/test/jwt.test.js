'use strict';

const test = require('node:test');
const assert = require('node:assert');
const jwt = require('../src/utils/jwt');

test('sign / verify 正常往返并携带 jti', () => {
  const token = jwt.sign({ userId: 1, role: 'admin' });
  const payload = jwt.verify(token);
  assert.strictEqual(payload.userId, 1);
  assert.strictEqual(payload.role, 'admin');
  assert.ok(payload.jti);
});

test('verify 拒绝 alg=none 降级攻击', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ userId: 1 })).toString('base64url');
  assert.throws(() => jwt.verify(header + '.' + body + '.'), /算法不受支持/);
});

test('verify 拒绝被篡改的签名', () => {
  const parts = jwt.sign({ userId: 1 }).split('.');
  const tamperedPayload = parts[1].slice(0, -1) + (parts[1].endsWith('A') ? 'B' : 'A');
  assert.throws(() => jwt.verify([parts[0], tamperedPayload, parts[2]].join('.')));
});

test('verify 拒绝过期 token', () => {
  assert.throws(() => jwt.verify(jwt.sign({ userId: 1 }, -10)), /已过期/);
});

test('verify 拒绝格式非法的 token', () => {
  assert.throws(() => jwt.verify('abc'), /格式非法/);
  assert.throws(() => jwt.verify(''), /缺少访问令牌/);
});
