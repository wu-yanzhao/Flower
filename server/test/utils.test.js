'use strict';

/**
 * 通用工具单元测试（Node 内置 node:test，与 jwt.test.js / password.test.js 同风格）
 * 覆盖 validate 校验规则、helpers 纯函数、JWT 与口令散列的边界分支。
 * 刻意不重复已有单元测试覆盖过的：sign/verify 往返、alg=none、篡改签名、
 * 过期 token、非法格式、哈希结构、正确/错误口令、空值、随机盐。
 */

const test = require('node:test');
const assert = require('node:assert');

const { validate } = require('../src/utils/validate');
const helpers = require('../src/utils/helpers');
const jwt = require('../src/utils/jwt');
const { hashPassword, verifyPassword } = require('../src/utils/password');
const config = require('../src/config');

/* ------------------------- validate 校验器 ------------------------- */
test('validate：必填字段缺失时抛出 400 与自定义文案', () => {
  assert.throws(
    () => validate({}, { username: { required: '请输入登录账号' } }),
    (err) => err.status === 400 && err.message === '请输入登录账号' && err.details.username === '请输入登录账号'
  );
});

test('validate：未传字段时应用 default 默认值', () => {
  const data = validate({}, { quantity: { type: 'integer', default: 1 } });
  assert.strictEqual(data.quantity, 1);
});

test('validate：未传且无默认值的字段不出现在结果中', () => {
  const data = validate({}, { phone: { pattern: [/^\d+$/, '格式错误'] } });
  assert.deepStrictEqual(data, {});
});

test('validate：string 类型自动去除首尾空白', () => {
  const data = validate({ name: '  红玫瑰  ' }, { name: { type: 'string' } });
  assert.strictEqual(data.name, '红玫瑰');
});

test('validate：integer 类型把数字字符串转为整数', () => {
  const data = validate({ id: '42' }, { id: { type: 'integer' } });
  assert.strictEqual(data.id, 42);
});

test('validate：number 类型接受数字字符串并转为数值', () => {
  const data = validate({ price: '19.90' }, { price: { type: 'number' } });
  assert.strictEqual(data.price, 19.9);
});

test('validate：integer 类型拒绝非数字字符串', () => {
  assert.throws(
    () => validate({ id: 'abc' }, { id: { type: 'integer' } }),
    (err) => err.status === 400 && !!err.details.id
  );
});

test('validate：number 类型拒绝纯空白字符串', () => {
  assert.throws(
    () => validate({ price: '   ' }, { price: { type: 'number' } }),
    (err) => err.status === 400 && !!err.details.price
  );
});

test('validate：min 校验字符串长度下界', () => {
  assert.throws(
    () => validate({ pwd: '12345' }, { pwd: { min: [6, '密码至少 6 位'] } }),
    /密码至少 6 位/
  );
  assert.deepStrictEqual(validate({ pwd: '123456' }, { pwd: { min: [6, '密码至少 6 位'] } }), { pwd: '123456' });
});

test('validate：max 校验字符串长度上界', () => {
  assert.throws(
    () => validate({ name: '花'.repeat(21) }, { name: { max: [20, '名称过长'] } }),
    /名称过长/
  );
  assert.ok(validate({ name: '花'.repeat(20) }, { name: { max: [20, '名称过长'] } }));
});

test('validate：min 校验数值下界（售价必须大于 0）', () => {
  assert.throws(
    () => validate({ price: 0 }, { price: { type: 'number', min: [0.01, '售价必须大于 0'] } }),
    /售价必须大于 0/
  );
  assert.strictEqual(validate({ price: 0.01 }, { price: { type: 'number', min: [0.01, 'x'] } }).price, 0.01);
});

test('validate：pattern 校验手机号格式', () => {
  const rule = { phone: { pattern: [/^1[3-9]\d{9}$/, '手机号格式不正确'] } };
  assert.throws(() => validate({ phone: '12345' }, rule), /手机号格式不正确/);
  assert.strictEqual(validate({ phone: '13900001111' }, rule).phone, '13900001111');
});

test('validate：enum 校验支付方式白名单', () => {
  const rule = { payMethod: { enum: ['微信支付', '支付宝', '余额支付'] } };
  assert.throws(() => validate({ payMethod: '比特币' }, rule), (err) => err.status === 400);
  assert.strictEqual(validate({ payMethod: '支付宝' }, rule).payMethod, '支付宝');
});

test('validate：custom 自定义规则返回定制错误文案', () => {
  assert.throws(
    () => validate({ n: 5 }, { n: { custom: (v) => v > 10 || '数值必须大于 10' } }),
    /数值必须大于 10/
  );
  assert.strictEqual(validate({ n: 11 }, { n: { custom: (v) => v > 10 || 'x' } }).n, 11);
});

test('validate：多字段同时出错时 details 完整且 message 取第一条', () => {
  assert.throws(
    () => validate({}, { a: { required: '缺少 a' }, b: { required: '缺少 b' } }),
    (err) => err.message === '缺少 a' && Object.keys(err.details).length === 2
  );
});

test('validate：source 为 null / undefined 时不崩溃', () => {
  assert.deepStrictEqual(validate(null, { x: { default: 1 } }), { x: 1 });
  assert.deepStrictEqual(validate(undefined, {}), {});
});

test('validate：boolean 类型接受 0 / 1 / true / false 字符串', () => {
  for (const v of [0, 1, 'true', 'false', true, false]) {
    assert.strictEqual(validate({ flag: v }, { flag: { type: 'boolean' } }).flag, v);
  }
});

/* ------------------------- helpers 纯函数 ------------------------- */
test('parsePaging：默认返回第 1 页与默认每页条数', () => {
  const r = helpers.parsePaging({});
  assert.strictEqual(r.page, 1);
  assert.strictEqual(r.pageSize, config.defaultPageSize);
  assert.strictEqual(r.offset, 0);
});

test('parsePaging：page 为 0 或负数时回退为第 1 页', () => {
  assert.strictEqual(helpers.parsePaging({ page: '0' }).page, 1);
  assert.strictEqual(helpers.parsePaging({ page: '-3' }).page, 1);
  assert.strictEqual(helpers.parsePaging({ page: 'abc' }).page, 1);
});

test('parsePaging：pageSize 超过 maxPageSize 时按上限钳制', () => {
  assert.strictEqual(helpers.parsePaging({ pageSize: '999' }).pageSize, config.maxPageSize);
  assert.strictEqual(helpers.parsePaging({ pageSize: '0' }).pageSize, config.defaultPageSize);
});

test('parsePaging：offset 按 (page-1)*pageSize 计算', () => {
  assert.strictEqual(helpers.parsePaging({ page: '3', pageSize: '10' }).offset, 20);
});

test('money：金额保留两位小数并正确四舍五入', () => {
  assert.strictEqual(helpers.money(19.995), 20);
  assert.strictEqual(helpers.money(1.234), 1.23);
  assert.strictEqual(helpers.money(300 - 20), 280);
});

test('money：非数值输入按 0 处理', () => {
  assert.strictEqual(helpers.money('abc'), 0);
  assert.strictEqual(helpers.money(undefined), 0);
});

test('safeUser：过滤 password_hash 与 salt，保留其余字段', () => {
  const out = helpers.safeUser({ id: 1, username: 'a', password_hash: 'h', salt: 's', role: 'customer' });
  assert.strictEqual(out.password_hash, undefined);
  assert.strictEqual(out.salt, undefined);
  assert.strictEqual(out.username, 'a');
  assert.strictEqual(out.role, 'customer');
});

test('safeUser：入参为空时返回 null', () => {
  assert.strictEqual(helpers.safeUser(null), null);
  assert.strictEqual(helpers.safeUser(undefined), null);
});

test('generateOrderNo：无数据库连接时仍生成 FS+14 位时间+4 位随机', () => {
  for (let i = 0; i < 20; i += 1) {
    assert.match(helpers.generateOrderNo(), /^FS\d{18}$/);
  }
});

test('generateOrderNo：数据库查重命中时继续重试直至生成唯一单号', () => {
  let calls = 0;
  const fakeDb = { get: () => (++calls <= 3 ? { 1: 1 } : null) };
  const no = helpers.generateOrderNo(fakeDb);
  assert.match(no, /^FS\d{18}$/);
  assert.strictEqual(calls, 4);
});

test('lastDays：返回连续 n 天且按时间正序排列', () => {
  const days = helpers.lastDays(7);
  assert.strictEqual(days.length, 7);
  assert.ok(days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
  assert.ok(days.every((d, i) => i === 0 || d >= days[i - 1]));
});

test('lastDays(1) 返回当天日期', () => {
  const today = new Date();
  const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;
  assert.strictEqual(helpers.lastDays(1)[0], expected);
});

test('now：返回 yyyy-MM-dd HH:mm:ss 格式的本地时间', () => {
  assert.match(helpers.now(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

/* ------------------------- JWT 补充边界 ------------------------- */
test('sign：payload 含 iat / exp / jti，且有效期等于配置值', () => {
  const token = jwt.sign({ userId: 7, role: 'admin' });
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  assert.strictEqual(payload.userId, 7);
  assert.strictEqual(payload.role, 'admin');
  assert.ok(payload.jti && payload.iat && payload.exp);
  assert.strictEqual(payload.exp - payload.iat, Number(config.jwtExpiresIn));
});

test('sign：保留调用方传入的自定义业务字段', () => {
  const payload = jwt.verify(jwt.sign({ userId: 1, nickname: '林小满', scope: 'web' }));
  assert.strictEqual(payload.nickname, '林小满');
  assert.strictEqual(payload.scope, 'web');
});

test('sign：两次签发的 jti 不同', () => {
  const a = jwt.verify(jwt.sign({ userId: 1 }));
  const b = jwt.verify(jwt.sign({ userId: 1 }));
  assert.notStrictEqual(a.jti, b.jti);
});

test('verify：拒绝 typ 不为 JWT 的头部', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWS' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ userId: 1 })).toString('base64url');
  assert.throws(() => jwt.verify(`${header}.${body}.x`), /算法不受支持/);
});

test('verify：拒绝 alg=HS512 等非 HS256 算法声明', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS512', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ userId: 1 })).toString('base64url');
  assert.throws(() => jwt.verify(`${header}.${body}.x`), /算法不受支持/);
});

test('verify：拒绝空签名与长度不符的签名', () => {
  const parts = jwt.sign({ userId: 1 }).split('.');
  assert.throws(() => jwt.verify(`${parts[0]}.${parts[1]}.`));
  assert.throws(() => jwt.verify(`${parts[0]}.${parts[1]}.abc`));
});

test('verify：拒绝头部不是合法 JSON 的 token', () => {
  const body = Buffer.from(JSON.stringify({ userId: 1 })).toString('base64url');
  assert.throws(() => jwt.verify(`!!!.${body}.sig`), /头部非法/);
});

/* ------------------------- 口令散列补充边界 ------------------------- */
test('hashPassword：scrypt 参数为 N=16384 / r=8 / p=1', () => {
  const parts = hashPassword('123456').split('$');
  assert.strictEqual(parts[1], '16384');
  assert.strictEqual(parts[2], '8');
  assert.strictEqual(parts[3], '1');
});

test('hashPassword：空口令仍生成合法六段摘要', () => {
  const stored = hashPassword('');
  assert.strictEqual(stored.split('$').length, 6);
  assert.strictEqual(verifyPassword('', stored), true);
});

test('verifyPassword：篡改盐值后校验失败', () => {
  const parts = hashPassword('flower-2026').split('$');
  parts[4] = '0'.repeat(32) === parts[4] ? '1'.repeat(32) : '0'.repeat(32);
  assert.strictEqual(verifyPassword('flower-2026', parts.join('$')), false);
});

test('verifyPassword：段数不足或算法名不符时返回 false', () => {
  assert.strictEqual(verifyPassword('x', 'scrypt$1$2$3$4'), false);
  assert.strictEqual(verifyPassword('x', 'md5$16384$8$1$aa$bb'), false);
});

test('verifyPassword：中文与 emoji 口令可正确往返', () => {
  const stored = hashPassword('鲜花🌸2026');
  assert.strictEqual(verifyPassword('鲜花🌸2026', stored), true);
  assert.strictEqual(verifyPassword('鲜花2026', stored), false);
});

test('verifyPassword：口令大小写敏感', () => {
  const stored = hashPassword('Flower-2026');
  assert.strictEqual(verifyPassword('Flower-2026', stored), true);
  assert.strictEqual(verifyPassword('flower-2026', stored), false);
});
