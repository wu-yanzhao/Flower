'use strict';

/**
 * 商品图片上传接口测试（无需额外依赖，使用 Node 内置 fetch / fs）
 * ------------------------------------------------------------
 * 覆盖：鉴权（401 / 403）-> 合法上传（JPG 大写扩展名 / PNG）->
 *      伪装文件（魔数不符 400）-> 非法扩展名（400）-> 参数缺失（400）->
 *      超限（400）-> 静态访问 -> 测试文件清理
 * 用法：先 npm start，再另开终端执行 npm run test:upload
 */

const fs = require('fs');
const path = require('path');

const BASE = process.env.API_BASE || 'http://localhost:3000/api';
/** 上传文件落盘目录（与 upload.controller.js 的 UPLOAD_DIR 保持一致） */
const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'web', 'assets', 'images', 'uploads');

let passed = 0;
let failed = 0;
const created = [];

async function request(method, apiPath, body, token) {
  const res = await fetch(BASE + apiPath, {
    method,
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: `Bearer ${token}` } : {}
    ),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${extra ? ' -> ' + JSON.stringify(extra) : ''}`);
  }
}

/** 最小合法 JPEG（FF D8 FF 头）/ 1x1 PNG 的 base64 */
const JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  console.log('上传接口测试开始：', BASE);

  /* 1. 鉴权 */
  const noToken = await request('POST', '/admin/uploads', { name: 'a.jpg', data: JPEG_B64 });
  assert('未登录上传被拒绝（401）', noToken.status === 401, noToken.json);

  const username = 'uptest' + Date.now().toString().slice(-6);
  const reg = await request('POST', '/auth/register', {
    username,
    password: '123456',
    nickname: '上传测试用户',
  });
  const userToken = reg.json.data && reg.json.data.token;
  assert('注册普通用户', !!userToken, reg.json);

  const forbidden = await request('POST', '/admin/uploads', { name: 'a.jpg', data: JPEG_B64 }, userToken);
  assert('普通管理员外角色被拒绝（403）', forbidden.status === 403, forbidden.json);

  const login = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  const adminToken = login.json.data && login.json.data.token;
  assert('管理员登录', !!adminToken, login.json);

  /* 2. 合法上传 */
  const upJpg = await request('POST', '/admin/uploads', { name: '红色玫瑰.JPG', data: JPEG_B64 }, adminToken);
  assert('合法 JPEG（大写扩展名）上传成功', upJpg.status === 200 && upJpg.json.code === 0 && !!upJpg.json.data.url, upJpg.json);
  if (upJpg.json.data && upJpg.json.data.url) created.push(upJpg.json.data.url);

  const upPng = await request('POST', '/admin/uploads', { name: 'test.png', data: PNG_B64 }, adminToken);
  assert('合法 PNG 上传成功', upPng.status === 200 && upPng.json.code === 0 && !!upPng.json.data.url, upPng.json);
  if (upPng.json.data && upPng.json.data.url) created.push(upPng.json.data.url);

  if (created.length) {
    const res = await fetch(BASE.replace(/\/api$/, '') + created[0]);
    const buf = await res.arrayBuffer();
    assert('上传文件可静态访问且类型正确', res.status === 200 && /image\/(jpeg|avif)/.test(res.headers.get('content-type') || '') && buf.byteLength > 0,
      { status: res.status, ct: res.headers.get('content-type') });
  }

  /* 3. 安全校验 */
  const fake = await request('POST', '/admin/uploads', {
    name: 'fake.jpg',
    data: Buffer.from('伪装成 jpg 的纯文本').toString('base64'),
  }, adminToken);
  assert('伪装 JPEG（魔数不符）被拒绝（400）', fake.status === 400, fake.json);

  const badExt = await request('POST', '/admin/uploads', { name: 'shell.gif', data: PNG_B64 }, adminToken);
  assert('非法扩展名 .gif 被拒绝（400）', badExt.status === 400, badExt.json);

  const traversal = await request('POST', '/admin/uploads', { name: '../../evil.jpg', data: JPEG_B64 }, adminToken);
  assert('路径穿越文件名被安全处理', traversal.status === 200 && /img-[\d-]+[a-f0-9]+\.jpg$/.test(traversal.json.data && traversal.json.data.url || ''), traversal.json);
  if (traversal.json.data && traversal.json.data.url) created.push(traversal.json.data.url);

  /* 4. 参数与限制 */
  const noName = await request('POST', '/admin/uploads', { data: JPEG_B64 }, adminToken);
  assert('缺失 name 参数（400）', noName.status === 400, noName.json);

  const noData = await request('POST', '/admin/uploads', { name: 'a.jpg' }, adminToken);
  assert('缺失 data 参数（400）', noData.status === 400, noData.json);

  const oversize = await request('POST', '/admin/uploads', {
    name: 'big.jpg',
    data: Buffer.alloc(11 * 1024 * 1024).toString('base64'),
  }, adminToken);
  assert('超过 10MB 被拒绝（400）', oversize.status === 400, oversize.json);

  /* 5. 清理测试文件 */
  created.forEach((url) => {
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(url)));
    } catch (err) {
      /* ignore */
    }
  });
  try {
    if (fs.existsSync(UPLOAD_DIR) && !fs.readdirSync(UPLOAD_DIR).length) fs.rmdirSync(UPLOAD_DIR);
  } catch (err) {
    /* ignore */
  }

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('测试执行异常：', err.message);
  process.exit(1);
});
