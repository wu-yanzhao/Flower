'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { hashPassword, verifyPassword } = require('../src/utils/password');

test('hashPassword 输出 scrypt$N$r$p$salt$hash 六段结构', () => {
  const parts = hashPassword('123456').split('$');
  assert.strictEqual(parts.length, 6);
  assert.strictEqual(parts[0], 'scrypt');
  assert.match(parts[4], /^[0-9a-f]{32}$/); // 盐：16 字节 hex
  assert.match(parts[5], /^[0-9a-f]{128}$/); // 派生值：64 字节 hex
});

test('verifyPassword 正确口令通过、错误口令失败', () => {
  const stored = hashPassword('flower-2026');
  assert.strictEqual(verifyPassword('flower-2026', stored), true);
  assert.strictEqual(verifyPassword('wrong-pass', stored), false);
});

test('verifyPassword 对空值 / 非法格式返回 false', () => {
  assert.strictEqual(verifyPassword('x', ''), false);
  assert.strictEqual(verifyPassword('x', 'not-a-hash'), false);
  assert.strictEqual(verifyPassword('x', null), false);
});

test('相同口令两次散列的盐值不同', () => {
  assert.notStrictEqual(hashPassword('same'), hashPassword('same'));
});
