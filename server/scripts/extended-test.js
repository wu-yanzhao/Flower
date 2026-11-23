'use strict';

/**
 * 扩展接口测试（边界值 / 异常输入 / 错误处理 / 关键回归）
 * ------------------------------------------------------------
 * 与 smoke-test.js、admin-test.js 保持同一套写法：Node 内置 fetch +
 * assert / assertOk / assertRejected，顺序执行，末尾输出通过/失败数。
 *
 * 用例刻意避开已有脚本覆盖过的场景（见 docs/04-系统测试.md），
 * 重点补充：参数边界、非法输入、统一错误响应、鉴权分支、状态机与回归缺陷。
 *
 * 运行方式：先 npm start，再执行 npm run test:extended
 * 说明：脚本会自建专用账号、商品、地址与订单；演示数据如需还原，执行 npm run reset。
 */

const BASE = process.env.API_BASE || 'http://localhost:3000/api';
const SITE = BASE.replace(/\/api$/, '');

let passed = 0;
let failed = 0;

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined || body === null ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    json = { code: -1, message: '响应不是合法 JSON' };
  }
  return { status: res.status, json };
}

/** 发送原始请求体（用于非法 JSON、超大请求体、CSV、CORS 预检等场景） */
async function rawRequest(method, apiPath, rawBody, headers, token) {
  const h = Object.assign({}, headers || {});
  if (token) h.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + apiPath, {
    method,
    headers: h,
    body: rawBody === undefined ? undefined : rawBody,
  });
  // 用 Buffer 解码而非 Response.text()，避免 UTF-8 BOM 被自动剥离
  const bytes = Buffer.from(await res.arrayBuffer());
  const text = bytes.toString('utf8');
  let json = null;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (e) {
    /* 非 JSON 响应（CSV / HTML / 204） */
  }
  return { status: res.status, headers: res.headers, text, bytes, json };
}

async function siteGet(path) {
  const res = await fetch(SITE + path);
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

function assert(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log('  ✓ ' + name);
  } else {
    failed += 1;
    console.log('  ✗ ' + name);
    if (extra !== undefined) {
      console.log('      实际返回：' + JSON.stringify(extra).slice(0, 300));
    }
  }
}

function assertOk(name, res) {
  assert(name, res.status === 200 && res.json && res.json.code === 0, res.json || res.status);
  return res.json && res.json.data;
}

function assertRejected(name, res) {
  assert(name, res.status === 400 && res.json && res.json.code !== 0, res.json || res.status);
  return res.json;
}

/** 断言指定 HTTP 状态码，且响应体遵循统一 {code,message,data} 错误格式 */
function assertStatus(name, res, status) {
  assert(name, res.status === status && res.json && res.json.code !== 0, {
    status: res.status,
    body: res.json,
    expect: status,
  });
  return res.json;
}

function group(title) {
  console.log('');
  console.log('【' + title + '】');
}

function d(res) {
  return res.json && res.json.data;
}

function uname(c, prefix) {
  c.seq += 1;
  return (prefix + c.stamp + c.seq).slice(0, 20);
}

/** 构造一笔已完成订单：立即购买 -> 支付 -> 后台发货 -> 确认收货 */
async function completedOrder(c, tag) {
  const o = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 1 }, addressId: c.addrId,
  }, c.userToken);
  await request('POST', '/orders/' + d(o).orderId + '/pay', {}, c.userToken);
  await request('POST', '/admin/orders/' + d(o).orderId + '/ship', {
    expressCompany: '京东物流', expressNo: tag + c.stamp,
  }, c.adminToken);
  await request('POST', '/orders/' + d(o).orderId + '/receive', {}, c.userToken);
  return d(o).orderId;
}

(async () => {
  console.log('扩展接口测试开始： ' + BASE);

  const c = {
    stamp: Date.now().toString().slice(-8),
    seq: 0,
    adminToken: null,
    userToken: null,
    user2Token: null,
    userId2: null,
    catId: null,
    flowerId: null,
    testFlowerId: null,
    addrId: null,
    orderIds: {},
    reviewIds: [],
  };

  /* ================= 前置准备（不计入扩展用例） ================= */
  const adminLogin = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  if (!d(adminLogin) || !d(adminLogin).token) {
    console.log('前置失败：管理员无法登录，测试中止 -> ' + JSON.stringify(adminLogin.json));
    process.exit(1);
  }
  c.adminToken = d(adminLogin).token;

  const reg = await request('POST', '/auth/register', {
    username: uname(c, 'exa'),
    password: '123456',
    nickname: '扩展测试主账号',
    phone: '13900001000',
  });
  const reg2 = await request('POST', '/auth/register', {
    username: uname(c, 'exb'),
    password: '123456',
    nickname: '扩展测试副账号',
    phone: '13900001001',
  });
  if (!d(reg) || !d(reg).token || !d(reg2) || !d(reg2).token) {
    console.log('前置失败：测试账号注册失败，测试中止');
    process.exit(1);
  }
  c.userToken = d(reg).token;
  c.user2Token = d(reg2).token;
  c.userId2 = d(reg2).user.id;

  const cats = await request('GET', '/categories');
  const flowers = await request('GET', '/flowers?page=1&pageSize=5');
  if (!d(cats) || !d(cats).length || !d(flowers) || !d(flowers).list.length) {
    console.log('前置失败：缺少演示分类或商品，请先执行 npm run reset');
    process.exit(1);
  }
  c.catId = d(cats)[0].id;
  c.flowerId = d(flowers).list[0].id;

  // 金额边界专用商品：单价 100、库存充足，便于精确验证满减阈值
  const tf = await request('POST', '/admin/flowers', {
    category_id: c.catId,
    name: '扩展测试专用-' + c.stamp,
    price: 100,
    stock: 1000,
    status: 'on',
  }, c.adminToken);
  if (!d(tf) || !d(tf).id) {
    console.log('前置失败：测试商品创建失败 -> ' + JSON.stringify(tf.json));
    process.exit(1);
  }
  c.testFlowerId = d(tf).id;

  const addr = await request('POST', '/addresses', {
    receiver: '扩展测试', phone: '13900002000', region: '广东省 广州市 天河区',
    detail: '测试路 100 号', is_default: 1,
  }, c.userToken);
  const addrList = await request('GET', '/addresses', null, c.userToken);
  if (addr.json.code !== 0 || !d(addrList) || !d(addrList).length) {
    console.log('前置失败：测试地址创建失败');
    process.exit(1);
  }
  c.addrId = d(addrList)[0].id;

  /* ================= 一、基础设施与错误处理 ================= */
  group('一、基础设施、统一响应与错误处理');

  const health = await request('GET', '/health');
  assert('健康检查：返回 code=0 与版本号 1.0.0',
    health.json.code === 0 && d(health).version === '1.0.0', health.json);
  assert('健康检查：返回数据库驱动标识',
    !!d(health) && typeof d(health).driver === 'string' && d(health).driver.length > 0, d(health));

  const missing = await request('GET', '/not-exist-' + c.stamp);
  assert('未知接口：返回 404 且 code=404',
    missing.status === 404 && missing.json && missing.json.code === 404, missing.json);
  assert('未知接口：错误消息包含请求方法与路径',
    !!missing.json && /GET/.test(missing.json.message) && /not-exist/.test(missing.json.message),
    missing.json && missing.json.message);

  const hdr = await rawRequest('GET', '/health');
  assert('安全响应头：X-Content-Type-Options = nosniff',
    hdr.headers.get('x-content-type-options') === 'nosniff', hdr.headers.get('x-content-type-options'));
  assert('安全响应头：X-Frame-Options = SAMEORIGIN',
    hdr.headers.get('x-frame-options') === 'SAMEORIGIN', hdr.headers.get('x-frame-options'));
  assert('安全响应头：Referrer-Policy = no-referrer',
    hdr.headers.get('referrer-policy') === 'no-referrer', hdr.headers.get('referrer-policy'));

  const pre = await rawRequest('OPTIONS', '/flowers', undefined, { Origin: 'http://example.test' });
  assert('CORS 预检：OPTIONS 返回 204', pre.status === 204, pre.status);
  assert('CORS 预检：允许 GET/POST/PUT/DELETE 四种方法',
    /GET/.test(pre.headers.get('access-control-allow-methods') || '') &&
    /POST/.test(pre.headers.get('access-control-allow-methods') || '') &&
    /PUT/.test(pre.headers.get('access-control-allow-methods') || '') &&
    /DELETE/.test(pre.headers.get('access-control-allow-methods') || ''),
    pre.headers.get('access-control-allow-methods'));
  const cors = await rawRequest('GET', '/health', undefined, { Origin: 'http://example.test' });
  assert('CORS：默认放行任意来源 Access-Control-Allow-Origin=*',
    cors.headers.get('access-control-allow-origin') === '*', cors.headers.get('access-control-allow-origin'));

  const badJson = await rawRequest('POST', '/auth/register', '{"username":', { 'Content-Type': 'application/json' });
  assert('异常输入：非法 JSON 请求体返回 400 且为统一 JSON',
    badJson.status === 400 && badJson.json && badJson.json.code !== 0, { status: badJson.status, body: badJson.json });
  const emptyBody = await rawRequest('POST', '/auth/register', '', { 'Content-Type': 'application/json' });
  assert('异常输入：空请求体注册返回 400 而非 500',
    emptyBody.status === 400, { status: emptyBody.status, body: emptyBody.json });
  const huge = JSON.stringify({ username: 'x'.repeat(1100000), password: '123456', nickname: 't' });
  const oversize = await rawRequest('POST', '/auth/register', huge, { 'Content-Type': 'application/json' });
  assert('异常输入：超过 1MB 的请求体返回 413',
    oversize.status === 413, { status: oversize.status, body: oversize.json });

  const index = await siteGet('/');
  assert('静态站点：首页可访问且返回 HTML',
    index.status === 200 && /<html/i.test(index.text), index.status);
  const notFoundPage = await siteGet('/no-such-page-' + c.stamp);
  assert('静态站点：不存在的页面返回 404', notFoundPage.status === 404, notFoundPage.status);

  /* ================= 二、认证与鉴权边界 ================= */
  group('二、注册 / 登录 / 令牌的边界与异常输入');

  const invalidReg = [
    ['账号少于 3 位', { username: 'ab' }],
    ['账号超过 20 位', { username: 'a'.repeat(21) }],
    ['账号以数字开头', { username: '1' + c.stamp }],
    ['账号含中文', { username: '花店' + c.stamp }],
    ['账号含特殊字符 @', { username: 'a@' + c.stamp }],
    ['密码少于 6 位', { password: '12345' }],
    ['密码超过 20 位', { password: '1'.repeat(21) }],
    ['缺少昵称', { nickname: undefined }],
    ['昵称超过 20 字', { nickname: '测'.repeat(21) }],
    ['手机号格式非法', { phone: '12345' }],
    ['邮箱格式非法', { email: 'not-an-email' }],
  ];
  for (const [label, patch] of invalidReg) {
    const body = Object.assign({
      username: uname(c, 'r'), password: '123456', nickname: '边界测试',
    }, patch);
    const r = await request('POST', '/auth/register', body);
    assert('注册校验：' + label + '被拒绝（400）',
      r.status === 400 && r.json && r.json.code !== 0, r.json);
  }

  // 账号长度下界（3 位）与上界（20 位）应可通过；若短账号撞名则换一个
  let shortReg = null;
  for (let i = 0; i < 20; i += 1) {
    const candidate = 'q' + String((Number(c.stamp) + i) % 100).padStart(2, '0');
    const r = await request('POST', '/auth/register', {
      username: candidate, password: '123456', nickname: '下界账号',
    });
    if (r.json && r.json.code === 0) { shortReg = r; break; }
    if (!/已被注册/.test((r.json && r.json.message) || '')) { shortReg = r; break; }
  }
  assert('注册边界：账号长度下界 3 位允许注册',
    !!shortReg && shortReg.json.code === 0, shortReg && shortReg.json);
  const longName = 'u' + c.stamp + 'a'.repeat(11);
  const longReg = await request('POST', '/auth/register', {
    username: longName, password: '1'.repeat(20), nickname: '上界账号',
  });
  assert('注册边界：账号 20 位 + 密码 20 位允许注册',
    longReg.json.code === 0 && longName.length === 20, longReg.json);
  assert('注册安全：响应体不泄露 password_hash / salt',
    !!d(longReg) && !!d(longReg).user &&
    d(longReg).user.password_hash === undefined && d(longReg).user.salt === undefined,
    d(longReg) && d(longReg).user);

  const regExtra = await request('POST', '/auth/register', {
    username: uname(c, 'rm'), password: '123456', nickname: '合法扩展字段',
    phone: '13800138000', email: 'ext@flower.com',
  });
  assert('注册：合法手机号与邮箱同时提交可通过',
    regExtra.json.code === 0 && d(regExtra).user.phone === '13800138000', regExtra.json);

  const loginEmptyUser = await request('POST', '/auth/login', { password: '123456' });
  assert('登录校验：缺少账号返回 400',
    loginEmptyUser.status === 400 && loginEmptyUser.json.code !== 0, loginEmptyUser.json);
  const loginEmptyPwd = await request('POST', '/auth/login', { username: 'admin' });
  assert('登录校验：缺少密码返回 400',
    loginEmptyPwd.status === 400 && loginEmptyPwd.json.code !== 0, loginEmptyPwd.json);
  const loginGhost = await request('POST', '/auth/login', { username: 'ghost' + c.stamp, password: '123456' });
  assert('登录：不存在的账号返回 401',
    loginGhost.status === 401 && loginGhost.json.code === 401, loginGhost.json);
  const loginBadPwd = await request('POST', '/auth/login', { username: 'admin', password: 'wrong-pass' });
  assert('登录：密码错误返回 401',
    loginBadPwd.status === 401 && loginBadPwd.json.code === 401, loginBadPwd.json);
  assert('安全回归：账号不存在与密码错误返回相同文案（防账号枚举）',
    loginGhost.json.message === loginBadPwd.json.message,
    { ghost: loginGhost.json.message, badPwd: loginBadPwd.json.message });

  const loginOk = await request('POST', '/auth/login', { username: 'customer', password: '123456' });
  assert('登录成功：返回 token 且角色为 customer',
    loginOk.json.code === 0 && !!d(loginOk).token && d(loginOk).user.role === 'customer', loginOk.json);
  assert('登录成功：响应体不携带密码摘要',
    d(loginOk).user.password_hash === undefined && d(loginOk).user.salt === undefined,
    d(loginOk).user);

  const noToken = await request('GET', '/auth/profile');
  assertStatus('鉴权：无令牌访问个人资料返回 401', noToken, 401);
  const badToken = await request('GET', '/auth/profile', null, 'not-a-jwt');
  assertStatus('鉴权：非法令牌返回 401', badToken, 401);
  const tampered = c.userToken.slice(0, -1) + (c.userToken.endsWith('A') ? 'B' : 'A');
  const tamperedRes = await request('GET', '/auth/profile', null, tampered);
  assertStatus('鉴权：篡改签名的令牌返回 401', tamperedRes, 401);
  const noBearer = await rawRequest('GET', '/auth/profile', undefined, { Authorization: c.userToken });
  assert('鉴权：缺少 Bearer 前缀的令牌返回 401',
    noBearer.status === 401 && noBearer.json && noBearer.json.code === 401,
    { status: noBearer.status, body: noBearer.json });
  const queryToken = await request('GET', '/auth/profile?token=' + encodeURIComponent(c.userToken));
  assert('鉴权：query 参数携带令牌可正常鉴权',
    queryToken.json.code === 0 && queryToken.json.data.role === 'customer', queryToken.json);

  const profile = await request('GET', '/auth/profile', null, c.userToken);
  assert('个人资料：返回购物车 / 收藏 / 订单三项计数',
    !!d(profile) && ['cartCount', 'favCount', 'orderCount'].every((k) => typeof d(profile)[k] === 'number'),
    d(profile));
  assert('个人资料：过滤敏感字段 password_hash / salt',
    !!d(profile) && d(profile).password_hash === undefined && d(profile).salt === undefined, d(profile));

  const upBadPhone = await request('PUT', '/auth/profile', { nickname: '张三', phone: '123' }, c.userToken);
  assertRejected('资料修改：非法手机号被拦截', upBadPhone);
  const upBadMail = await request('PUT', '/auth/profile', { nickname: '张三', email: 'bad' }, c.userToken);
  assertRejected('资料修改：非法邮箱被拦截', upBadMail);
  const upNoNick = await request('PUT', '/auth/profile', { phone: '13900001000' }, c.userToken);
  assertRejected('资料修改：缺少昵称被拦截', upNoNick);
  const upOk = await request('PUT', '/auth/profile', {
    nickname: '资料已更新', phone: '13900001002', email: 'ok@flower.com',
  }, c.userToken);
  assert('资料修改：合法字段写入成功且立即生效',
    upOk.json.code === 0 && d(upOk).nickname === '资料已更新' && d(upOk).phone === '13900001002', upOk.json);

  const pwdWrongOld = await request('PUT', '/auth/password', {
    oldPassword: '000000', newPassword: '654321',
  }, c.userToken);
  assertRejected('修改密码：原密码错误被拦截', pwdWrongOld);
  const pwdShort = await request('PUT', '/auth/password', {
    oldPassword: '123456', newPassword: '12345',
  }, c.userToken);
  assertRejected('修改密码：新密码少于 6 位被拦截', pwdShort);
  const pwdOk = await request('PUT', '/auth/password', {
    oldPassword: '123456', newPassword: '654321',
  }, c.userToken);
  assertOk('修改密码：合法修改返回成功', pwdOk);

  /* ================= 三、商品目录与查询边界 ================= */
  group('三、商品目录、筛选、排序与分页边界');

  const p0 = await request('GET', '/flowers?page=0&pageSize=5');
  assert('分页边界：page=0 回退为第 1 页',
    p0.json.code === 0 && d(p0).page === 1, d(p0));
  const pNeg = await request('GET', '/flowers?page=-3&pageSize=5');
  assert('分页边界：page 为负数回退为第 1 页',
    pNeg.json.code === 0 && d(pNeg).page === 1, d(pNeg));
  const ps0 = await request('GET', '/flowers?page=1&pageSize=0');
  assert('分页边界：pageSize=0 回退为默认 12',
    ps0.json.code === 0 && d(ps0).pageSize === 12, d(ps0));
  const psMax = await request('GET', '/flowers?page=1&pageSize=999');
  assert('分页边界：pageSize 超过上限被钳制为 100',
    psMax.json.code === 0 && d(psMax).pageSize === 100, d(psMax));
  const pFar = await request('GET', '/flowers?page=99999&pageSize=5');
  assert('分页边界：超出总页数返回空列表且 total 保持一致',
    pFar.json.code === 0 && d(pFar).list.length === 0 && typeof d(pFar).total === 'number', d(pFar));
  const pMeta = await request('GET', '/flowers?page=1&pageSize=5');
  assert('分页响应：totalPages 按 total/pageSize 向上取整',
    pMeta.json.code === 0 && d(pMeta).totalPages === Math.max(1, Math.ceil(d(pMeta).total / 5)),
    d(pMeta));

  const subSearch = await request('GET', '/flowers?keyword=' + encodeURIComponent('告白首选'));
  assert('商品搜索：关键词命中 subtitle 字段',
    subSearch.json.code === 0 && d(subSearch).list.length > 0 &&
    d(subSearch).list.every((f) => /告白首选/.test(f.subtitle || '')), d(subSearch));
  const noHit = await request('GET', '/flowers?keyword=' + encodeURIComponent('不存在的花束XYZ' + c.stamp));
  assert('商品搜索：无命中关键词返回空列表',
    noHit.json.code === 0 && d(noHit).total === 0, d(noHit));
  const inject = await request('GET', '/flowers?keyword=' + encodeURIComponent("%' OR 1=1 --"));
  assert('安全回归：关键词含 SQL 注入片段不破坏查询',
    inject.json.code === 0 && d(inject).total === 0, d(inject));
  const quote = await request('GET', '/flowers?keyword=' + encodeURIComponent("a'b"));
  assert('异常输入：关键词含单引号返回统一成功响应',
    quote.json.code === 0 && Array.isArray(d(quote).list), quote.json);

  const catFilter = await request('GET', '/flowers?categoryId=' + c.catId);
  assert('分类筛选：结果均属于指定分类',
    catFilter.json.code === 0 && d(catFilter).list.length > 0 &&
    d(catFilter).list.every((f) => f.category_id === c.catId), d(catFilter));
  const catBad = await request('GET', '/flowers?categoryId=-9');
  assert('异常输入：非法分类 id 被忽略且不影响查询',
    catBad.json.code === 0 && d(catBad).total > 0, d(catBad));
  const range = await request('GET', '/flowers?minPrice=200&maxPrice=300');
  assert('价格区间：结果价格均落在 [200,300]',
    range.json.code === 0 && d(range).list.length > 0 &&
    d(range).list.every((f) => f.price >= 200 && f.price <= 300), d(range));
  const badRange = await request('GET', '/flowers?minPrice=900&maxPrice=100');
  assert('边界值：最小价大于最大价返回空列表',
    badRange.json.code === 0 && d(badRange).total === 0, d(badRange));
  const negRange = await request('GET', '/flowers?maxPrice=-1');
  assert('边界值：负价格上界返回空列表',
    negRange.json.code === 0 && d(negRange).total === 0, d(negRange));
  const rec = await request('GET', '/flowers?recommended=1');
  assert('推荐位筛选：结果均为推荐商品且已上架',
    rec.json.code === 0 && d(rec).list.length > 0 &&
    d(rec).list.every((f) => f.recommended === 1 && f.status === 'on'), d(rec));

  const asc = await request('GET', '/flowers?sort=price_asc&pageSize=20');
  const ascPrices = d(asc).list.map((f) => f.price);
  assert('排序：price_asc 结果按售价非降序排列',
    asc.json.code === 0 && ascPrices.length > 1 &&
    ascPrices.every((v, i) => i === 0 || v >= ascPrices[i - 1]), ascPrices);
  const desc = await request('GET', '/flowers?sort=price_desc&pageSize=20');
  const descPrices = d(desc).list.map((f) => f.price);
  assert('排序：price_desc 结果按售价非升序排列',
    desc.json.code === 0 && descPrices.length > 1 &&
    descPrices.every((v, i) => i === 0 || v <= descPrices[i - 1]), descPrices);
  const badSort = await request('GET', '/flowers?sort=no_such_sort');
  assert('异常输入：未知排序值回退默认排序且不报错',
    badSort.json.code === 0 && d(badSort).list.length > 0, badSort.json);
  const injectSort = await request('GET', '/flowers?sort=' + encodeURIComponent('price_asc; DROP TABLE flowers'));
  assert('安全回归：排序字段使用白名单，注入片段不破坏查询',
    injectSort.json.code === 0 && d(injectSort).list.length > 0, injectSort.json);

  const detail0 = await request('GET', '/flowers/0');
  assertStatus('商品详情：id=0 返回 404', detail0, 404);
  const detailNaN = await request('GET', '/flowers/abc');
  assertStatus('商品详情：非数字 id 返回 404', detailNaN, 404);
  const detailOk = await request('GET', '/flowers/' + c.flowerId);
  assert('商品详情：返回评价统计与收藏状态扩展字段',
    detailOk.json.code === 0 &&
    typeof d(detailOk).reviewCount === 'number' &&
    typeof d(detailOk).reviewAvg === 'number' &&
    typeof d(detailOk).favorited === 'boolean', d(detailOk));

  const recList = await request('GET', '/flowers/recommend?limit=999');
  assert('推荐列表：limit 超过上界被钳制且结果均为推荐商品',
    recList.json.code === 0 && d(recList).length <= 20 &&
    d(recList).every((f) => f.recommended === 1), d(recList));
  const recDefault = await request('GET', '/flowers/recommend?limit=0');
  assert('推荐列表：limit=0 回退默认 8 条',
    recDefault.json.code === 0 && d(recDefault).length <= 8, d(recDefault) && d(recDefault).length);
  const reviewsPage = await request('GET', '/flowers/' + c.flowerId + '/reviews?page=1&pageSize=3');
  assert('商品评价：返回标准分页结构',
    reviewsPage.json.code === 0 && Array.isArray(d(reviewsPage).list) &&
    typeof d(reviewsPage).total === 'number', d(reviewsPage));
  assert('商品评价：列表仅包含可见评价',
    d(reviewsPage).list.every((r) => r.status === 'visible'), d(reviewsPage).list);

  /* ================= 四、购物车边界与金额规则 ================= */
  group('四、购物车边界、勾选状态与满减金额');

  const cartNoFlower = await request('POST', '/cart', { quantity: 1 }, c.userToken);
  assertRejected('加购：缺少 flowerId 被拦截', cartNoFlower);
  const cartGhost = await request('POST', '/cart', { flowerId: 999999, quantity: 1 }, c.userToken);
  assertStatus('加购：不存在的商品返回 404', cartGhost, 404);
  const cartQ0 = await request('POST', '/cart', { flowerId: c.testFlowerId, quantity: 0 }, c.userToken);
  assertRejected('加购边界：数量 0 被拦截', cartQ0);
  const cartQNeg = await request('POST', '/cart', { flowerId: c.testFlowerId, quantity: -1 }, c.userToken);
  assertRejected('加购边界：数量为负被拦截', cartQNeg);
  const cartQStr = await request('POST', '/cart', { flowerId: c.testFlowerId, quantity: '2' }, c.userToken);
  assert('异常输入：字符串数字数量被正确转换为整数 2',
    cartQStr.json.code === 0 &&
    (await request('GET', '/cart', null, c.userToken)).json.data.list
      .some((i) => i.flower_id === c.testFlowerId && i.quantity === 2), cartQStr.json);
  const cartQFloat = await request('POST', '/cart', { flowerId: c.testFlowerId, quantity: 1.9 }, c.userToken);
  assertRejected('加购边界：小数数量 1.9 被整数类型校验拒绝', cartQFloat);
  const cartAccum = await request('POST', '/cart', { flowerId: c.testFlowerId, quantity: 1 }, c.userToken);
  const afterAccum = await request('GET', '/cart', null, c.userToken);
  assert('购物车：同一商品重复加购在原数量上累加（2+1=3）',
    cartAccum.json.code === 0 &&
    d(afterAccum).list.some((i) => i.flower_id === c.testFlowerId && i.quantity === 3),
    d(afterAccum).list);

  const cartList = await request('GET', '/cart', null, c.userToken);
  const testItem = d(cartList).list.find((i) => i.flower_id === c.testFlowerId);
  assert('购物车：同一商品重复加购只累加数量、不产生重复行',
    !!testItem && d(cartList).list.filter((i) => i.flower_id === c.testFlowerId).length === 1,
    d(cartList).list);
  const countRes = await request('GET', '/cart/count', null, c.userToken);
  assert('购物车：数量徽标等于所有条目数量之和',
    countRes.json.code === 0 &&
    d(countRes).count === d(cartList).summary.allCount, { count: d(countRes), summary: d(cartList).summary });

  const qtyOver = await request('PUT', '/cart/' + testItem.id, { quantity: 1001 }, c.userToken);
  assertRejected('改数量：超过商品库存被拦截', qtyOver);
  const qtyGhost = await request('PUT', '/cart/999999', { quantity: 1 }, c.userToken);
  assertStatus('改数量：不存在的购物车条目返回 404', qtyGhost, 404);

  // 满减阈值：单价 100，分别构造 200 / 300 / 500 三个临界金额
  const amountCases = [
    { qty: 2, discount: 0, pay: 200, label: '未满 300 无优惠' },
    { qty: 3, discount: 20, pay: 280, label: '满 300 减 20（临界值）' },
    { qty: 5, discount: 50, pay: 450, label: '满 500 减 50（临界值）' },
  ];
  for (const ac of amountCases) {
    const upd = await request('PUT', '/cart/' + testItem.id, { quantity: ac.qty }, c.userToken);
    const cur = await request('GET', '/cart', null, c.userToken);
    const s = d(cur).summary;
    assert('金额规则：' + ac.label,
      upd.json.code === 0 && s.totalAmount === 100 * ac.qty &&
      s.discount === ac.discount && s.payAmount === ac.pay,
      { qty: ac.qty, summary: s });
  }

  const uncheck = await request('PUT', '/cart/' + testItem.id + '/check', { checked: 0 }, c.userToken);
  const afterUncheck = await request('GET', '/cart', null, c.userToken);
  assert('勾选状态：取消勾选后该条目不计入应付汇总',
    uncheck.json.code === 0 &&
    d(afterUncheck).list.find((i) => i.id === testItem.id).checked === 0 &&
    d(afterUncheck).summary.count === 0, d(afterUncheck).summary);
  const checkAll = await request('PUT', '/cart/check-all', { checked: 1 }, c.userToken);
  const afterAll = await request('GET', '/cart', null, c.userToken);
  assert('勾选状态：全选后所有条目恢复参与结算',
    checkAll.json.code === 0 && d(afterAll).list.every((i) => i.checked === 1) &&
    d(afterAll).summary.count === d(afterAll).summary.allCount, d(afterAll).summary);
  const uncheckAll = await request('PUT', '/cart/check-all', { checked: 0 }, c.userToken);
  const afterUnAll = await request('GET', '/cart', null, c.userToken);
  assert('勾选状态：取消全选后应付金额为 0',
    uncheckAll.json.code === 0 && d(afterUnAll).summary.count === 0 &&
    d(afterUnAll).summary.payAmount === 0, d(afterUnAll).summary);

  const otherDelete = await request('DELETE', '/cart/' + testItem.id, null, c.user2Token);
  const stillThere = await request('GET', '/cart', null, c.userToken);
  assert('越权回归：他人无法删除本账号的购物车条目',
    otherDelete.json.code === 0 &&
    d(stillThere).list.some((i) => i.id === testItem.id), d(stillThere).list);

  const clear = await request('DELETE', '/cart', null, c.userToken);
  const afterClear = await request('GET', '/cart', null, c.userToken);
  assert('清空购物车：列表为空且徽标归零',
    clear.json.code === 0 && d(afterClear).list.length === 0 && d(afterClear).summary.allCount === 0,
    d(afterClear));

  /* ================= 五、收货地址边界 ================= */
  group('五、收货地址参数校验与默认地址互斥');

  const baseAddr = {
    receiver: '收货人', phone: '13900003000', region: '广东省 广州市',
    detail: '详细地址 100 号',
  };
  const addrInvalid = [
    ['缺少收货人', { receiver: '' }],
    ['手机号 10 位', { phone: '1390000300' }],
    ['手机号 12 位', { phone: '139000030000' }],
    ['手机号以 12 开头', { phone: '12900003000' }],
    ['手机号含非数字', { phone: '1390000300a' }],
    ['详细地址仅 1 字', { detail: 'A' }],
    ['收货人超过 20 字', { receiver: '收'.repeat(21) }],
    ['缺少所在地区', { region: '' }],
  ];
  for (const [label, patch] of addrInvalid) {
    const r = await request('POST', '/addresses', Object.assign({}, baseAddr, patch), c.userToken);
    assert('地址校验：' + label + '被拒绝（400）',
      r.status === 400 && r.json && r.json.code !== 0, r.json);
  }

  const addrValid = await request('POST', '/addresses', Object.assign({}, baseAddr, { is_default: 0 }), c.userToken);
  assertOk('地址：合法地址新增成功', addrValid);
  const addrAfter = await request('GET', '/addresses', null, c.userToken);
  const newAddr = d(addrAfter).find((a) => a.phone === '13900003000');
  assert('地址：新增地址默认不是默认地址',
    !!newAddr && newAddr.is_default === 0, newAddr);
  assert('地址：列表按默认地址优先排序',
    d(addrAfter).length > 1 && d(addrAfter)[0].is_default === 1, d(addrAfter));

  const setDef = await request('PUT', '/addresses/' + newAddr.id + '/default', {}, c.userToken);
  const afterDef = await request('GET', '/addresses', null, c.userToken);
  assert('默认地址互斥：设为默认后仅保留一个默认地址',
    setDef.json.code === 0 &&
    d(afterDef).filter((a) => a.is_default === 1).length === 1 &&
    d(afterDef)[0].id === newAddr.id, d(afterDef));
  const addDef = await request('POST', '/addresses', Object.assign({}, baseAddr, {
    phone: '13900003001', is_default: 1,
  }), c.userToken);
  const afterAddDef = await request('GET', '/addresses', null, c.userToken);
  assert('默认地址互斥：新增默认地址会取消原默认',
    addDef.json.code === 0 && d(afterAddDef).filter((a) => a.is_default === 1).length === 1,
    d(afterAddDef));

  const updGhost = await request('PUT', '/addresses/999999', baseAddr, c.userToken);
  assertStatus('地址：更新不存在的地址返回 404', updGhost, 404);
  const delGhost = await request('DELETE', '/addresses/999999', null, c.userToken);
  assertStatus('地址：删除不存在的地址返回 404', delGhost, 404);
  const delOther = await request('DELETE', '/addresses/' + c.addrId, null, c.user2Token);
  assertStatus('越权回归：无法删除他人收货地址', delOther, 404);

  // 恢复主测试地址为默认，供后续下单使用
  await request('PUT', '/addresses/' + c.addrId + '/default', {}, c.userToken);

  /* ================= 六、收藏与登录可选鉴权 ================= */
  group('六、收藏幂等与 authOptional 分支');

  const favNoId = await request('POST', '/favorites/toggle', {}, c.userToken);
  assertRejected('收藏：缺少 flowerId 被拦截', favNoId);
  const favGhost = await request('POST', '/favorites/toggle', { flowerId: 999999 }, c.userToken);
  assertStatus('收藏：不存在的商品返回 404', favGhost, 404);
  const fav1 = await request('POST', '/favorites/toggle', { flowerId: c.flowerId }, c.userToken);
  assert('收藏：首次切换为已收藏',
    fav1.json.code === 0 && d(fav1).favorited === true, fav1.json);
  const favList1 = await request('GET', '/favorites', null, c.userToken);
  assert('收藏：列表出现该商品',
    d(favList1).some((f) => f.id === c.flowerId), d(favList1));
  const detailFav = await request('GET', '/flowers/' + c.flowerId + '?token=' + encodeURIComponent(c.userToken));
  assert('登录可选鉴权：query token 访问详情时 favorited=true',
    detailFav.json.code === 0 && d(detailFav).favorited === true, d(detailFav) && d(detailFav).favorited);
  const detailAnon = await request('GET', '/flowers/' + c.flowerId);
  assert('登录可选鉴权：匿名访问详情时 favorited=false',
    detailAnon.json.code === 0 && d(detailAnon).favorited === false, d(detailAnon) && d(detailAnon).favorited);
  const fav2 = await request('POST', '/favorites/toggle', { flowerId: c.flowerId }, c.userToken);
  assert('收藏回归：再次切换取消收藏（幂等）',
    fav2.json.code === 0 && d(fav2).favorited === false, fav2.json);
  const favList2 = await request('GET', '/favorites', null, c.userToken);
  assert('收藏：取消后列表不再包含该商品',
    !d(favList2).some((f) => f.id === c.flowerId), d(favList2));

  /* ================= 七、下单主流程、金额与状态机 ================= */
  group('七、订单主流程、金额计算与状态机');

  const bnGhost = await request('POST', '/orders', {
    buyNow: { flowerId: 999999, quantity: 1 }, addressId: c.addrId,
  }, c.userToken);
  assertStatus('立即购买：不存在的商品返回 404', bnGhost, 404);
  const bnNoAddr = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 1 },
  }, c.userToken);
  assertRejected('下单校验：缺少收货信息被拦截', bnNoAddr);
  const bnGhostAddr = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 1 }, addressId: 999999,
  }, c.userToken);
  assertStatus('下单校验：不存在的收货地址返回 404', bnGhostAddr, 404);
  const bnBadPhone = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 1 },
    receiver: '张三', phone: '123', address: '广东省广州市天河区测试路 1 号',
  }, c.userToken);
  assertRejected('下单校验：手写收货手机号格式非法被拦截', bnBadPhone);
  const bnShortAddr = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 1 },
    receiver: '张三', phone: '13900004000', address: 'A',
  }, c.userToken);
  assertRejected('下单校验：手写收货地址过短被拦截', bnShortAddr);
  const bnQtyOver = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 9999 }, addressId: c.addrId,
  }, c.userToken);
  assertRejected('立即购买：数量超过库存被拦截', bnQtyOver);

  const emptyCart = await request('POST', '/orders', { cartIds: [], addressId: c.addrId }, c.userToken);
  assertRejected('购物车结算：无勾选商品被拦截', emptyCart);

  const bn0 = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 0 }, addressId: c.addrId,
  }, c.userToken);
  assert('立即购买边界：quantity=0 被钳制为 1 且 item_count=1',
    bn0.json.code === 0 && (await request('GET', '/orders/' + d(bn0).orderId, null, c.userToken)).json.data.item_count === 1,
    bn0.json);

  const beforeStock = (await request('GET', '/flowers/' + c.testFlowerId)).json.data;
  const bn1 = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 1 }, addressId: c.addrId, remark: '扩展测试订单',
  }, c.userToken);
  assert('立即购买：成功创建 pending 订单并返回订单号',
    bn1.json.code === 0 && /^FS\d{18}$/.test(d(bn1).orderNo) && d(bn1).payAmount === 100, bn1.json);
  const afterStock = (await request('GET', '/flowers/' + c.testFlowerId)).json.data;
  assert('事务一致性：下单后库存精确扣减 1',
    afterStock.stock === beforeStock.stock - 1, { before: beforeStock.stock, after: afterStock.stock });
  assert('事务一致性：下单后销量精确累加 1',
    afterStock.sales === beforeStock.sales + 1, { before: beforeStock.sales, after: afterStock.sales });
  const bn1Detail = await request('GET', '/orders/' + d(bn1).orderId, null, c.userToken);
  assert('订单详情：pending 状态 canReview=false 且时间轴为 4 步',
    d(bn1Detail).status === 'pending' && d(bn1Detail).canReview === false &&
    d(bn1Detail).timeline.length === 4, d(bn1Detail) && d(bn1Detail).timeline);
  assert('订单详情：remark 与收货信息按提交值落库',
    d(bn1Detail).remark === '扩展测试订单' && d(bn1Detail).receiver_phone === '13900002000',
    d(bn1Detail));

  const bn2 = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 3 }, addressId: c.addrId,
  }, c.userToken);
  const bn2Detail = await request('GET', '/orders/' + d(bn2).orderId, null, c.userToken);
  assert('金额计算：3 件 ×100 触发满 300 减 20，应付 280',
    bn2.json.code === 0 && d(bn2).payAmount === 280 &&
    d(bn2Detail).total_amount === 300 && d(bn2Detail).discount_amount === 20,
    d(bn2Detail));
  const bn3 = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 5 }, addressId: c.addrId,
  }, c.userToken);
  assert('金额计算：5 件 ×100 触发满 500 减 50，应付 450',
    bn3.json.code === 0 && d(bn3).payAmount === 450, bn3.json);
  assert('回归：连续三笔订单的订单号互不相同',
    new Set([d(bn1).orderNo, d(bn2).orderNo, d(bn3).orderNo]).size === 3,
    [d(bn1).orderNo, d(bn2).orderNo, d(bn3).orderNo]);

  const payBadMethod = await request('POST', '/orders/' + d(bn1).orderId + '/pay', {
    payMethod: '比特币',
  }, c.userToken);
  assertRejected('支付：非白名单支付方式被拦截', payBadMethod);
  const receiveOnPending = await request('POST', '/orders/' + d(bn1).orderId + '/receive', {}, c.userToken);
  assertRejected('状态机：pending 订单不可直接确认收货', receiveOnPending);
  const shipOnPending = await request('POST', '/admin/orders/' + d(bn1).orderId + '/ship', {
    expressCompany: '顺丰速运', expressNo: 'SF' + c.stamp,
  }, c.adminToken);
  assertRejected('状态机：pending 订单不可直接发货', shipOnPending);
  const delOnPending = await request('DELETE', '/orders/' + d(bn1).orderId, null, c.userToken);
  assertRejected('订单删除：未完成订单不可删除', delOnPending);
  const otherOrder = await request('GET', '/orders/' + d(bn1).orderId, null, c.user2Token);
  assertStatus('越权回归：无法查看他人订单详情', otherOrder, 403);

  const pay1 = await request('POST', '/orders/' + d(bn1).orderId + '/pay', { payMethod: '支付宝' }, c.userToken);
  assert('支付：pending → paid 成功并记录支付方式',
    pay1.json.code === 0 && d(pay1).status === 'paid' &&
    (await request('GET', '/orders/' + d(bn1).orderId, null, c.userToken)).json.data.pay_method === '支付宝',
    pay1.json);
  const shipNoCompany = await request('POST', '/admin/orders/' + d(bn1).orderId + '/ship', {
    expressNo: 'SF' + c.stamp,
  }, c.adminToken);
  assertRejected('发货校验：缺少物流公司被拦截', shipNoCompany);
  const shipNoNumber = await request('POST', '/admin/orders/' + d(bn1).orderId + '/ship', {
    expressCompany: '顺丰速运',
  }, c.adminToken);
  assertRejected('发货校验：缺少物流单号被拦截', shipNoNumber);
  const shipOk = await request('POST', '/admin/orders/' + d(bn1).orderId + '/ship', {
    expressCompany: '顺丰速运', expressNo: 'SF' + c.stamp,
  }, c.adminToken);
  assert('发货：paid → shipped 成功', shipOk.json.code === 0, shipOk.json);
  const shippedDetail = await request('GET', '/orders/' + d(bn1).orderId, null, c.userToken);
  assert('发货：订单写入物流公司、单号与发货时间',
    d(shippedDetail).express_company === '顺丰速运' && d(shippedDetail).express_no === 'SF' + c.stamp &&
    !!d(shippedDetail).shipped_at, d(shippedDetail));
  const receive1 = await request('POST', '/orders/' + d(bn1).orderId + '/receive', {}, c.userToken);
  assert('确认收货：shipped → completed 成功',
    receive1.json.code === 0 && d(receive1).status === 'completed', receive1.json);
  const completedDetail = await request('GET', '/orders/' + d(bn1).orderId, null, c.userToken);
  assert('订单详情：completed 状态 canReview=true',
    d(completedDetail).canReview === true && d(completedDetail).statusText === '已完成', d(completedDetail));
  const cancelCompleted = await request('POST', '/orders/' + d(bn1).orderId + '/cancel', {}, c.userToken);
  assertRejected('状态机：已完成订单不可取消', cancelCompleted);

  const cancel2 = await request('POST', '/orders/' + d(bn2).orderId + '/cancel', {}, c.userToken);
  assert('取消订单：pending → canceled 成功',
    cancel2.json.code === 0 && d(cancel2).status === 'canceled', cancel2.json);
  const payCanceled = await request('POST', '/orders/' + d(bn2).orderId + '/pay', {}, c.userToken);
  assertRejected('状态机：已取消订单不可支付', payCanceled);
  const canceledDetail = await request('GET', '/orders/' + d(bn2).orderId, null, c.userToken);
  assert('订单详情：已取消订单时间轴收敛为 2 步',
    d(canceledDetail).timeline.length === 2 && d(canceledDetail).timeline[1].key === 'canceled',
    d(canceledDetail).timeline);
  const delCanceled = await request('DELETE', '/orders/' + d(bn2).orderId, null, c.userToken);
  assertOk('订单删除：已取消订单可删除', delCanceled);
  const afterDel = await request('GET', '/orders/' + d(bn2).orderId, null, c.userToken);
  assertStatus('订单删除：删除后详情不可访问', afterDel, 404);

  const statusBad = await request('PUT', '/admin/orders/' + d(bn3).orderId + '/status', {
    status: 'unknown',
  }, c.adminToken);
  assertRejected('后台状态变更：非法状态值被枚举校验拦截', statusBad);

  const listPending = await request('GET', '/orders?status=pending&pageSize=50', null, c.userToken);
  assert('订单列表：按状态筛选结果均为该状态',
    listPending.json.code === 0 && d(listPending).list.every((o) => o.status === 'pending'), d(listPending));
  const listKeyword = await request('GET', '/orders?keyword=' + d(bn3).orderNo, null, c.userToken);
  assert('订单列表：按订单号关键词精确命中 1 笔',
    listKeyword.json.code === 0 && d(listKeyword).total === 1 &&
    d(listKeyword).list[0].order_no === d(bn3).orderNo, d(listKeyword));

  // 购物车结算路径：下单后对应条目应被清理
  const cartAdd = await request('POST', '/cart', { flowerId: c.testFlowerId, quantity: 2 }, c.userToken);
  const cartBefore = await request('GET', '/cart', null, c.userToken);
  const settle = await request('POST', '/orders', {
    cartIds: d(cartBefore).list.map((i) => i.id), addressId: c.addrId,
  }, c.userToken);
  const cartAfterSettle = await request('GET', '/cart', null, c.userToken);
  assert('购物车结算：成功后对应购物车条目被清除',
    cartAdd.json.code === 0 && settle.json.code === 0 && d(cartAfterSettle).list.length === 0,
    { settle: settle.json, cart: d(cartAfterSettle).list });
  const settleDetail = await request('GET', '/orders/' + d(settle).orderId, null, c.userToken);
  assert('购物车结算：订单明细数量与下单前购物车一致',
    d(settleDetail).item_count === 2 && d(settleDetail).items.length === 1 &&
    d(settleDetail).items[0].quantity === 2, d(settleDetail).items);

  /* ================= 八、评价规则与评分重算 ================= */
  group('八、评价边界、重复提交与评分重算');

  const reviewPending = await request('POST', '/reviews', {
    orderId: d(settle).orderId, items: [{ flowerId: c.testFlowerId, rating: 5, content: '未完成订单评价' }],
  }, c.userToken);
  assertRejected('评价规则：未完成订单不可评价', reviewPending);
  const reviewNotInOrder = await request('POST', '/reviews', {
    orderId: d(bn1).orderId, items: [{ flowerId: 999999, rating: 5, content: '非本单商品' }],
  }, c.userToken);
  assert('评价规则：非本订单商品被忽略并提示无可评价商品',
    reviewNotInOrder.status === 400 && /没有可评价的商品/.test(reviewNotInOrder.json.message || ''),
    reviewNotInOrder.json);
  const review1 = await request('POST', '/reviews', {
    orderId: d(bn1).orderId, items: [{ flowerId: c.testFlowerId, rating: 5, content: '扩展测试五星评价' }],
  }, c.userToken);
  assert('评价：已完成订单可发布评价',
    review1.json.code === 0 && d(review1).count === 1, review1.json);
  const reviewDup = await request('POST', '/reviews', {
    orderId: d(bn1).orderId, items: [{ flowerId: c.testFlowerId, rating: 4, content: '重复提交' }],
  }, c.userToken);
  assert('评价规则：同一订单同一商品重复评价被拦截',
    reviewDup.status === 400 && /已评价/.test(reviewDup.json.message || ''), reviewDup.json);
  const myReviews = await request('GET', '/reviews/mine', null, c.userToken);
  const rv = d(myReviews).find((r) => r.order_id === d(bn1).orderId);
  assert('我的评价：新评价可见且包含订单与商品关联',
    !!rv && rv.flower_id === c.testFlowerId && rv.rating === 5, rv);
  c.reviewIds.push(rv.id);

  // 再构造一笔 completed 订单，验证合法低星级与长文本截断
  const orderId4 = await completedOrder(c, 'R4');
  const longContent = '好'.repeat(600);
  const reviewLow = await request('POST', '/reviews', {
    orderId: orderId4, items: [{ flowerId: c.testFlowerId, rating: 2, content: longContent }],
  }, c.userToken);
  assert('评价：合法低星级 2 星评价发布成功',
    reviewLow.json.code === 0 && d(reviewLow).count === 1, reviewLow.json);
  const myReviews2 = await request('GET', '/reviews/mine', null, c.userToken);
  const rv2 = d(myReviews2).find((r) => r.order_id === orderId4);
  assert('评价边界：低星级 2 星按原值落库',
    !!rv2 && rv2.rating === 2, rv2);
  assert('评价边界：超过 500 字的内容被截断为 500 字',
    !!rv2 && rv2.content.length === 500, rv2 && rv2.content.length);
  c.reviewIds.push(rv2.id);

  const detailBeforeHide = await request('GET', '/flowers/' + c.testFlowerId);
  assert('评分统计：5 星与 2 星两条可见评价平均分为 3.5',
    detailBeforeHide.json.code === 0 && Number(d(detailBeforeHide).reviewAvg) === 3.5,
    d(detailBeforeHide).reviewAvg);
  const hideReview = await request('PUT', '/admin/reviews/' + rv.id + '/status', {
    status: 'hidden',
  }, c.adminToken);
  assertOk('评价管理：隐藏评价', hideReview);
  const visibleReviews = await request('GET', '/flowers/' + c.testFlowerId + '/reviews?pageSize=50');
  assert('评价管理：隐藏后前台评价列表不再包含该条',
    visibleReviews.json.code === 0 &&
    !d(visibleReviews).list.some((r) => r.id === rv.id), d(visibleReviews).list);
  const detailAfterHide = await request('GET', '/flowers/' + c.testFlowerId);
  assert('回归：隐藏评价后商品综合评分重算为 2.0',
    detailAfterHide.json.code === 0 && Number(d(detailAfterHide).reviewAvg) === 2,
    d(detailAfterHide).reviewAvg);
  assert('回归：隐藏评价后可见评价数由 2 减为 1',
    d(detailAfterHide).reviewCount === 1, d(detailAfterHide).reviewCount);
  const emptyReply = await request('PUT', '/admin/reviews/' + rv2.id + '/reply', { reply: '' }, c.adminToken);
  assertRejected('评价管理：空回复内容被拦截', emptyReply);
  const tooLongReply = await request('PUT', '/admin/reviews/' + rv2.id + '/reply', {
    reply: '回'.repeat(201),
  }, c.adminToken);
  assertRejected('评价管理：回复超过 200 字被拦截', tooLongReply);

  // 越界评分边界（置于评分重算断言之后，避免干扰平均分）
  const orderId5 = await completedOrder(c, 'R5');
  const reviewUpper = await request('POST', '/reviews', {
    orderId: orderId5, items: [{ flowerId: c.testFlowerId, rating: 6, content: '越界上界评分' }],
  }, c.userToken);
  const myReviews3 = await request('GET', '/reviews/mine', null, c.userToken);
  const rv3 = d(myReviews3).find((r) => r.order_id === orderId5);
  assert('评价边界：rating=6 被钳制为上界 5 星',
    reviewUpper.json.code === 0 && !!rv3 && rv3.rating === 5, rv3);
  const orderId6 = await completedOrder(c, 'R6');
  const reviewZero = await request('POST', '/reviews', {
    orderId: orderId6, items: [{ flowerId: c.testFlowerId, rating: 0, content: '越界下界评分' }],
  }, c.userToken);
  const myReviews4 = await request('GET', '/reviews/mine', null, c.userToken);
  const rv4 = d(myReviews4).find((r) => r.order_id === orderId6);
  assert('评价边界：rating=0 触发默认值回退，落库为 5 星',
    reviewZero.json.code === 0 && !!rv4 && rv4.rating === 5, rv4);

  /* ================= 九、后台管理、统计与导出边界 ================= */
  group('九、后台管理参数校验、统计边界与日志导出');

  const flowerInvalid = [
    ['售价为 0', { price: 0 }],
    ['售价为负', { price: -1 }],
    ['售价为非数字', { price: 'abc' }],
    ['库存为负', { stock: -1 }],
    ['名称超过 60 字', { name: '花'.repeat(61) }],
    ['状态取值非法', { status: 'unknown' }],
    ['缺少分类 id', { category_id: undefined }],
  ];
  for (const [label, patch] of flowerInvalid) {
    const body = Object.assign({
      category_id: c.catId, name: '校验用商品', price: 100, stock: 10, status: 'on',
    }, patch);
    const r = await request('POST', '/admin/flowers', body, c.adminToken);
    assert('商品校验：' + label + '被拒绝（400）',
      r.status === 400 && r.json && r.json.code !== 0, r.json);
  }
  const stockBadDelta = await request('PUT', '/admin/flowers/' + c.testFlowerId + '/stock', {
    delta: 'abc',
  }, c.adminToken);
  assertRejected('库存调整：非数字 delta 被拦截', stockBadDelta);
  const stockGhost = await request('PUT', '/admin/flowers/999999/stock', { delta: 1 }, c.adminToken);
  assertStatus('库存调整：不存在的商品返回 404', stockGhost, 404);
  const statusIllegal = await request('PUT', '/admin/flowers/' + c.testFlowerId + '/status', {
    status: 'illegal',
  }, c.adminToken);
  const afterStatus = await request('GET', '/admin/flowers?keyword=' + encodeURIComponent('扩展测试专用-' + c.stamp), null, c.adminToken);
  assert('上下架：非法状态值按 off 处理且不产生 500',
    statusIllegal.json.code === 0 && d(afterStatus).list[0].status === 'off', d(afterStatus).list);
  const offAdd = await request('POST', '/cart', { flowerId: c.testFlowerId, quantity: 1 }, c.userToken);
  assert('加购：已下架商品无法加入购物车',
    offAdd.status === 400 && /下架/.test(offAdd.json.message || ''), offAdd.json);
  const offBuy = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 1 }, addressId: c.addrId,
  }, c.userToken);
  assert('立即购买：已下架商品被拦截',
    offBuy.status === 400 && /下架/.test(offBuy.json.message || ''), offBuy.json);
  const offDetail = await request('GET', '/flowers/' + c.testFlowerId);
  assert('商品详情：下架商品仍可查看（历史订单可追溯）',
    offDetail.json.code === 0 && d(offDetail).status === 'off', offDetail.json);
  await request('PUT', '/admin/flowers/' + c.testFlowerId + '/status', { status: 'on' }, c.adminToken);

  // 售罄边界：把自建商品库存一次性清零，再恢复
  const soldOut = await request('PUT', '/admin/flowers/' + c.testFlowerId + '/stock', {
    delta: -2000,
  }, c.adminToken);
  assert('库存调整：超大负数扣减后库存归零且不为负',
    soldOut.json.code === 0 && d(soldOut).stock === 0, soldOut.json);
  const soldOutAdd = await request('POST', '/cart', { flowerId: c.testFlowerId, quantity: 1 }, c.userToken);
  assert('加购：售罄商品无法加入购物车',
    soldOutAdd.status === 400 && /售罄/.test(soldOutAdd.json.message || ''), soldOutAdd.json);
  await request('PUT', '/admin/flowers/' + c.testFlowerId + '/stock', { delta: 1000 }, c.adminToken);

  const catLong = await request('POST', '/categories', { name: '分'.repeat(21) }, c.adminToken);
  assertRejected('分类校验：名称超过 20 字被拦截', catLong);
  const catGhost = await request('PUT', '/categories/999999', { name: '不存在分类' }, c.adminToken);
  assertStatus('分类：更新不存在的分类返回 404', catGhost, 404);
  const catDelGhost = await request('DELETE', '/categories/999999', null, c.adminToken);
  assert('分类：删除不存在的分类不报错',
    catDelGhost.json.code === 0, catDelGhost.json);

  const userBadRole = await request('POST', '/admin/users', {
    username: uname(c, 'ru'), password: '123456', nickname: '角色测试', role: 'superadmin',
  }, c.adminToken);
  assertRejected('用户校验：非法角色被枚举拦截', userBadRole);
  const userShortPwd = await request('POST', '/admin/users', {
    username: uname(c, 'rp'), password: '12345', nickname: '短密码',
  }, c.adminToken);
  assertRejected('用户校验：初始密码少于 6 位被拦截', userShortPwd);
  const resetDefault = await request('PUT', '/admin/users/' + c.userId2 + '/password', {}, c.adminToken);
  assert('用户管理：重置密码未传值时默认 123456',
    resetDefault.json.code === 0 && d(resetDefault).password === '123456', resetDefault.json);
  const roleFilter = await request('GET', '/admin/users?role=admin', null, c.adminToken);
  assert('后台用户列表：按角色筛选结果均为 admin',
    roleFilter.json.code === 0 && d(roleFilter).list.length > 0 &&
    d(roleFilter).list.every((u) => u.role === 'admin'), d(roleFilter).list);
  const reviewFilter = await request('GET', '/admin/reviews?status=hidden', null, c.adminToken);
  assert('后台评价列表：按状态筛选结果均为 hidden',
    reviewFilter.json.code === 0 && d(reviewFilter).list.every((r) => r.status === 'hidden'), d(reviewFilter).list);
  const dateFilter = await request('GET', '/admin/orders?startDate=2099-01-01', null, c.adminToken);
  assert('后台订单列表：未来起始日期筛选返回 0 笔',
    dateFilter.json.code === 0 && d(dateFilter).total === 0, d(dateFilter));

  const trend0 = await request('GET', '/admin/stats/trend?days=0', null, c.adminToken);
  assert('统计边界：trend days=0 回退默认 7 天',
    trend0.json.code === 0 && d(trend0).length === 7, d(trend0) && d(trend0).length);
  const trendNeg = await request('GET', '/admin/stats/trend?days=-5', null, c.adminToken);
  assert('统计边界：trend days 为负被钳制为 1 天',
    trendNeg.json.code === 0 && d(trendNeg).length === 1, d(trendNeg) && d(trendNeg).length);
  const trendMax = await request('GET', '/admin/stats/trend?days=999', null, c.adminToken);
  assert('统计边界：trend days 超过上界被钳制为 30 天',
    trendMax.json.code === 0 && d(trendMax).length === 30, d(trendMax) && d(trendMax).length);
  const topMin = await request('GET', '/admin/stats/top?limit=-3', null, c.adminToken);
  assert('统计边界：top limit 为负被钳制为 1 条',
    topMin.json.code === 0 && d(topMin).length === 1, d(topMin) && d(topMin).length);
  const topMax = await request('GET', '/admin/stats/top?limit=999', null, c.adminToken);
  assert('统计边界：top limit 超过上界不超过 20 条',
    topMax.json.code === 0 && d(topMax).length <= 20, d(topMax) && d(topMax).length);
  const recentMax = await request('GET', '/admin/stats/recent?limit=999', null, c.adminToken);
  assert('统计边界：recent limit 超过上界不超过 20 条',
    recentMax.json.code === 0 && d(recentMax).length <= 20, d(recentMax) && d(recentMax).length);
  const logsMax = await request('GET', '/admin/logs?limit=999', null, c.adminToken);
  assert('日志边界：logs limit 超过上界不超过 50 条',
    logsMax.json.code === 0 && d(logsMax).length <= 50, d(logsMax) && d(logsMax).length);

  const overview = await request('GET', '/admin/stats/overview', null, c.adminToken);
  const overviewKeys = ['sales', 'todaySales', 'orderCount', 'todayOrders', 'userCount',
    'flowerCount', 'pendingCount', 'shippedCount', 'reviewCount', 'lowStock', 'avgOrder'];
  assert('数据概览：11 项指标齐全且均为数值',
    overview.json.code === 0 && overviewKeys.every((k) => typeof d(overview)[k] === 'number'), d(overview));
  const statusStat = await request('GET', '/admin/stats/status', null, c.adminToken);
  const allOrders = await request('GET', '/admin/orders?pageSize=100', null, c.adminToken);
  assert('状态分布：各状态计数之和等于订单总数',
    statusStat.json.code === 0 &&
    d(statusStat).reduce((s, x) => s + x.count, 0) === d(allOrders).total,
    { stat: d(statusStat), total: d(allOrders).total });
  const categoryStat = await request('GET', '/admin/stats/category', null, c.adminToken);
  const allCats = await request('GET', '/categories');
  assert('分类分布：返回全部分类（含无销量的空分类）',
    categoryStat.json.code === 0 && d(categoryStat).length === d(allCats).length,
    { stat: d(categoryStat).length, cats: d(allCats).length });

  const exportRes = await rawRequest('GET', '/admin/logs/export?limit=5', undefined, {}, c.adminToken);
  assert('日志导出：返回 200 且 Content-Type 为 CSV',
    exportRes.status === 200 && /text\/csv/.test(exportRes.headers.get('content-type') || ''),
    { status: exportRes.status, ct: exportRes.headers.get('content-type') });
  assert('日志导出：带 UTF-8 BOM 与中文表头',
    exportRes.text.charCodeAt(0) === 0xFEFF && /管理员,模块,操作/.test(exportRes.text),
    exportRes.text.slice(0, 60));
  assert('日志导出：响应头声明附件下载',
    /operation-logs\.csv/.test(exportRes.headers.get('content-disposition') || ''),
    exportRes.headers.get('content-disposition'));
  const exportNoAuth = await rawRequest('GET', '/admin/logs/export');
  assert('日志导出：未登录访问返回 401',
    exportNoAuth.status === 401, exportNoAuth.status);

  /* ================= 十、关键回归与收尾 ================= */
  group('十、统一错误格式与关键回归');

  const unauthJson = await rawRequest('GET', '/cart');
  assert('回归：401 响应为统一 JSON 而非 HTML 或空响应',
    unauthJson.status === 401 && unauthJson.json && unauthJson.json.code === 401 &&
    typeof unauthJson.json.message === 'string', { status: unauthJson.status, body: unauthJson.json });
  const forbidJson = await rawRequest('GET', '/admin/users', undefined, {}, c.userToken);
  assert('回归：403 响应为统一 JSON 且含明确提示',
    forbidJson.status === 403 && forbidJson.json && forbidJson.json.code === 403 &&
    /无权/.test(forbidJson.json.message || ''), { status: forbidJson.status, body: forbidJson.json });
  const adminGhost = await rawRequest('PUT', '/admin/flowers/999999', JSON.stringify({
    category_id: c.catId, name: 'x', price: 1, stock: 1,
  }), { 'Content-Type': 'application/json' }, c.adminToken);
  assert('回归：管理端异常返回明确 404 JSON（异常未被空 catch 吞掉）',
    adminGhost.status === 404 && adminGhost.json && adminGhost.json.code === 404,
    { status: adminGhost.status, body: adminGhost.json });
  const methodMismatch = await request('DELETE', '/health');
  assert('错误处理：不支持的 HTTP 方法返回 404 统一响应',
    methodMismatch.status === 404 && methodMismatch.json.code === 404, methodMismatch.json);

  // 下单 -> 取消闭环：库存与销量均应回到起点
  const loopBefore = (await request('GET', '/flowers/' + c.testFlowerId)).json.data;
  const loopOrder = await request('POST', '/orders', {
    buyNow: { flowerId: c.testFlowerId, quantity: 2 }, addressId: c.addrId,
  }, c.userToken);
  await request('POST', '/orders/' + d(loopOrder).orderId + '/pay', {}, c.userToken);
  const loopCancel = await request('POST', '/orders/' + d(loopOrder).orderId + '/cancel', {}, c.userToken);
  const loopAfter = (await request('GET', '/flowers/' + c.testFlowerId)).json.data;
  assert('回归：下单支付后取消，库存精确回到下单前',
    loopCancel.json.code === 0 && loopAfter.stock === loopBefore.stock,
    { before: loopBefore.stock, after: loopAfter.stock });
  assert('回归：取消后销量回退且不会出现负数',
    loopAfter.sales === loopBefore.sales && loopAfter.sales >= 0,
    { before: loopBefore.sales, after: loopAfter.sales });

  const logout = await request('POST', '/auth/logout', {}, c.user2Token);
  assertOk('退出登录：返回成功', logout);
  const afterLogout = await request('GET', '/auth/profile', null, c.user2Token);
  assertStatus('回归：登出后原令牌被 jti 黑名单立即吊销', afterLogout, 401);

  console.log('');
  console.log('----------------------------------------');
  console.log('扩展接口测试结束：通过 ' + passed + ' 项，失败 ' + failed + ' 项');
  console.log('----------------------------------------');
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('扩展接口测试执行异常：', err);
  process.exit(1);
});
