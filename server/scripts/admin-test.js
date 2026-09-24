'use strict';

/**
 * 管理端写操作接口测试
 * 覆盖：商品新增/编辑/上下架/库存调整/删除保护、分类新增/删除保护、
 *      用户新增/禁用/重置密码、评价回复/隐藏/显示、订单发货与状态推进、操作日志
 *
 * 运行方式：先启动服务（npm start），再执行 node scripts/admin-test.js
 */

const BASE = process.env.API_BASE || 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
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

/** 断言接口调用成功（HTTP 200 且 code === 0） */
function assertOk(name, res) {
  assert(name, res.status === 200 && res.json.code === 0, res.json || res.status);
  return res.json;
}

/** 断言接口被业务规则拦截（HTTP 400 且 code !== 0） */
function assertRejected(name, res) {
  assert(name, res.status === 400 && res.json.code !== 0, res.json || res.status);
  return res.json;
}

(async () => {
  console.log('管理端接口测试开始： ' + BASE);
  console.log('');

  const stamp = Date.now().toString().slice(-6);

  /* ---------- 0. 管理员登录 ---------- */
  const adminLogin = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  if (adminLogin.json.code !== 0) {
    console.log('管理员登录失败，测试中止：' + JSON.stringify(adminLogin.json));
    process.exit(1);
  }
  const adminToken = adminLogin.json.data.token;
  const auth = { Authorization: 'Bearer ' + adminToken };

  console.log('【一、商品管理】');

  // 取一个现有分类用于挂靠新商品
  const catList = await request('GET', '/categories');
  const firstCategory = catList.json.data[0];

  // 1. 新增商品 —— 参数校验（缺名称）
  const badCreate = await request('POST', '/admin/flowers', { category_id: firstCategory.id, price: 99, stock: 10 }, adminToken);
  assertRejected('新增商品缺名称被拦截', badCreate);

  // 2. 新增商品 —— 正常
  const newFlowerName = '测试花束-' + stamp;
  const create = await request(
    'POST',
    '/admin/flowers',
    {
      category_id: firstCategory.id,
      name: newFlowerName,
      subtitle: '自动化测试专用商品',
      price: 199,
      original_price: 259,
      stock: 50,
      status: 'on',
      recommended: 0,
      image: '/assets/images/flowers/flower-01.svg',
      description: '这是由自动化测试脚本创建的商品',
      material: '测试花材',
      flower_language: '测试花语',
      packing: '测试包装',
    },
    adminToken
  );
  const created = assertOk('新增商品', create);
  const flowerId = created && created.data ? created.data.id : null;

  // 3. 前台可见
  const frontList = await request('GET', '/flowers?keyword=' + encodeURIComponent(newFlowerName));
  assert(
    '新增商品在前台可搜索到',
    frontList.json.code === 0 && frontList.json.data.total >= 1,
    frontList.json
  );

  // 4. 编辑商品
  const update = await request(
    'PUT',
    '/admin/flowers/' + flowerId,
    {
      category_id: firstCategory.id,
      name: newFlowerName,
      subtitle: '自动化测试专用商品（已编辑）',
      price: 188,
      original_price: 259,
      stock: 50,
      status: 'on',
      recommended: 1,
      image: '/assets/images/flowers/flower-01.svg',
      description: '这是由自动化测试脚本创建的商品',
      material: '测试花材',
      flower_language: '测试花语',
      packing: '测试包装',
    },
    adminToken
  );
  assertOk('编辑商品', update);

  const detail = await request('GET', '/flowers/' + flowerId);
  assert(
    '编辑结果已生效（售价 188 且进入推荐位）',
    detail.json.code === 0 && Number(detail.json.data.price) === 188 && Number(detail.json.data.recommended) === 1,
    detail.json.data
  );

  // 5. 库存调整 +10 / -5
  const stockUp = await request('PUT', '/admin/flowers/' + flowerId + '/stock', { delta: 10 }, adminToken);
  assert(
    '库存调整 +10',
    stockUp.json.code === 0 && stockUp.json.data.stock === 60,
    stockUp.json
  );

  const stockDown = await request('PUT', '/admin/flowers/' + flowerId + '/stock', { delta: -5 }, adminToken);
  assert(
    '库存调整 -5',
    stockDown.json.code === 0 && stockDown.json.data.stock === 55,
    stockDown.json
  );

  // 6. 库存不会出现负数
  const stockHuge = await request('PUT', '/admin/flowers/' + flowerId + '/stock', { delta: -9999 }, adminToken);
  assert(
    '库存减至负数时归零保护',
    stockHuge.json.code === 0 && stockHuge.json.data.stock === 0,
    stockHuge.json
  );

  // 7. 下架 / 上架
  const off = await request('PUT', '/admin/flowers/' + flowerId + '/status', { status: 'off' }, adminToken);
  assertOk('商品下架', off);

  const afterOff = await request('GET', '/flowers?keyword=' + encodeURIComponent(newFlowerName));
  assert(
    '下架后前台列表不再展示',
    afterOff.json.code === 0 && afterOff.json.data.total === 0,
    afterOff.json.data && afterOff.json.data.total
  );

  const on = await request('PUT', '/admin/flowers/' + flowerId + '/status', { status: 'on' }, adminToken);
  assertOk('商品上架', on);

  // 8. 删除保护：已有订单的商品不可删除
  const protect = await request('DELETE', '/admin/flowers/1', null, adminToken);
  assertRejected('已有订单的商品删除被拦截', protect);

  // 9. 删除自建的无订单商品
  const del = await request('DELETE', '/admin/flowers/' + flowerId, null, adminToken);
  assertOk('删除无关联商品', del);

  const afterDel = await request('GET', '/flowers/' + flowerId);
  assert('删除后商品不可访问', afterDel.json.code !== 0, afterDel.json);

  console.log('');
  console.log('【二、分类管理】');

  // 10. 新增分类 —— 重名拦截
  const dupCat = await request('POST', '/categories', { name: firstCategory.name }, adminToken);
  assertRejected('分类重名被拦截', dupCat);

  // 11. 新增分类 —— 正常
  const newCatName = '测试分类' + stamp;
  const cat = await request('POST', '/categories', { name: newCatName, description: '自动化测试分类', sort: 99 }, adminToken);
  const createdCat = assertOk('新增分类', cat);
  const catId = createdCat && createdCat.data ? createdCat.data.id : null;

  // 12. 编辑分类
  const catUpdate = await request('PUT', '/categories/' + catId, { name: newCatName + 'E', description: '自动化测试分类（已编辑）', sort: 99 }, adminToken);
  assertOk('编辑分类', catUpdate);

  // 13. 分类下挂有商品时禁止删除
  const catProtect = await request('DELETE', '/categories/' + firstCategory.id, null, adminToken);
  assertRejected('含商品的分类删除被拦截', catProtect);

  // 14. 空分类可删除
  const catDel = await request('DELETE', '/categories/' + catId, null, adminToken);
  assertOk('删除空分类', catDel);

  console.log('');
  console.log('【三、用户管理】');

  // 15. 新增用户 —— 账号格式校验
  const badUser = await request('POST', '/admin/users', { username: 'ab', password: '123456', nickname: '格式测试' }, adminToken);
  assertRejected('账号格式非法被拦截', badUser);

  // 16. 新增用户 —— 正常
  const newUser = 'testuser' + stamp;
  const user = await request(
    'POST',
    '/admin/users',
    { username: newUser, password: '123456', nickname: '自动化测试用户', phone: '13800138000', role: 'customer' },
    adminToken
  );
  const createdUser = assertOk('新增用户', user);
  const userId = createdUser && createdUser.data ? createdUser.data.id : null;

  // 17. 新用户可登录
  const userLogin = await request('POST', '/auth/login', { username: newUser, password: '123456' });
  assert('新用户可正常登录', userLogin.json.code === 0, userLogin.json);

  // 18. 禁用账号
  const disable = await request('PUT', '/admin/users/' + userId + '/status', { status: 'disabled' }, adminToken);
  assertOk('禁用用户', disable);

  // 19. 禁用后无法登录
  const disabledLogin = await request('POST', '/auth/login', { username: newUser, password: '123456' });
  assert('禁用后无法登录', disabledLogin.json.code !== 0, disabledLogin.json);

  // 20. 重置密码
  const resetPwd = await request('PUT', '/admin/users/' + userId + '/password', { password: '666666' }, adminToken);
  assertOk('重置密码', resetPwd);

  // 21. 启用账号后可用新密码登录
  const enable = await request('PUT', '/admin/users/' + userId + '/status', { status: 'active' }, adminToken);
  assertOk('启用用户', enable);

  const newPwdLogin = await request('POST', '/auth/login', { username: newUser, password: '666666' });
  assert('重置后可用新密码登录', newPwdLogin.json.code === 0, newPwdLogin.json);

  // 22. 不能禁用自己
  const selfDisable = await request('PUT', '/admin/users/1/status', { status: 'disabled' }, adminToken);
  const selfOk = selfDisable.json.code !== 0 || selfDisable.status === 400;
  assert('禁止禁用当前登录账号', selfOk, selfDisable.json);

  console.log('');
  console.log('【四、评价管理】');

  // 取一条评价
  const rvList = await request('GET', '/admin/reviews?page=1&pageSize=1', null, adminToken);
  if (rvList.json.code === 0 && rvList.json.data.list.length > 0) {
    const rv = rvList.json.data.list[0];

    // 23. 商家回复
    const reply = await request('PUT', '/admin/reviews/' + rv.id + '/reply', { reply: '感谢您的支持，自动化测试回复' }, adminToken);
    assertOk('评价回复', reply);

    // 24. 回复内容为空被拦截
    const emptyReply = await request('PUT', '/admin/reviews/' + rv.id + '/reply', { reply: '' }, adminToken);
    assertRejected('空回复被拦截', emptyReply);

    // 25. 隐藏评价
    const hide = await request('PUT', '/admin/reviews/' + rv.id + '/status', { status: 'hidden' }, adminToken);
    assertOk('隐藏评价', hide);

    // 26. 恢复显示
    const show = await request('PUT', '/admin/reviews/' + rv.id + '/status', { status: 'visible' }, adminToken);
    assertOk('恢复显示评价', show);

    // 27. 前台评价列表可读
    const flowerReviews = await request('GET', '/flowers/' + rv.flower_id + '/reviews?page=1&pageSize=5');
    assert('前台评价列表可读取', flowerReviews.json.code === 0, flowerReviews.json);
  } else {
    assert('评价管理（未取到评价数据，跳过）', false, rvList.json);
  }

  console.log('');
  console.log('【五、订单管理】');

  // 28. 后台多条件筛选
  const ordList = await request('GET', '/admin/orders?page=1&pageSize=5', null, adminToken);
  assert('后台订单列表', ordList.json.code === 0, ordList.json);

  const filtered = await request('GET', '/admin/orders?page=1&pageSize=5&status=pending', null, adminToken);
  const allPending = filtered.json.code === 0 && filtered.json.data.list.every((o) => o.status === 'pending');
  assert('按状态筛选订单', allPending, filtered.json.data && filtered.json.data.list);

  // 取一笔待发货订单做发货演示
  const paidList = await request('GET', '/admin/orders?page=1&pageSize=5&status=paid', null, adminToken);
  if (paidList.json.code === 0 && paidList.json.data.list.length > 0) {
    const ord = paidList.json.data.list[0];

    // 29. 物流单号过短被拦截
    const shortNo = await request(
      'POST',
      '/admin/orders/' + ord.id + '/ship',
      { expressCompany: '顺丰速运', expressNo: '12' },
      adminToken
    );
    assertRejected('物流单号过短被拦截', shortNo);

    // 30. 正常发货
    const ship = await request(
      'POST',
      '/admin/orders/' + ord.id + '/ship',
      { expressCompany: '顺丰速运', expressNo: 'SF' + stamp },
      adminToken
    );
    assertOk('订单发货', ship);

    const afterShip = await request('GET', '/admin/orders/' + ord.id, null, adminToken);
    assert(
      '发货后状态为 shipped 且含物流信息',
      afterShip.json.code === 0 &&
        afterShip.json.data.status === 'shipped' &&
        !!afterShip.json.data.express_no,
      afterShip.json.data
    );

    // 31. 重复发货被状态机拦截
    const shipAgain = await request(
      'POST',
      '/admin/orders/' + ord.id + '/ship',
      { expressCompany: '中通快递', expressNo: 'ZT' + stamp },
      adminToken
    );
    assertRejected('重复发货被状态机拦截', shipAgain);

    // 32. 状态推进至已完成
    const toComplete = await request('PUT', '/admin/orders/' + ord.id + '/status', { status: 'completed' }, adminToken);
    assertOk('订单推进至已完成', toComplete);

    // 33. 已完成后无法再发货
    const shipAfterDone = await request(
      'POST',
      '/admin/orders/' + ord.id + '/ship',
      { expressCompany: '圆通速递', expressNo: 'YT' + stamp },
      adminToken
    );
    assertRejected('已完成订单不可再发货', shipAfterDone);
  } else {
    assert('订单发货流程（未取到待发货订单，跳过）', false, paidList.json);
  }

  // 34. 管理员取消订单触发库存回滚
  const paidList2 = await request('GET', '/admin/orders?page=1&pageSize=5&status=paid', null, adminToken);
  if (paidList2.json.code === 0 && paidList2.json.data.list.length > 0) {
    const ord2 = paidList2.json.data.list[0];
    const detail2 = await request('GET', '/admin/orders/' + ord2.id, null, adminToken);
    const item = detail2.json.code === 0 ? detail2.json.data.items[0] : null;

    if (item) {
      // 取取消前的商品库存
      const before = await request('GET', '/flowers/' + item.flower_id);
      const stockBefore = before.json.code === 0 ? before.json.data.stock : null;

      const cancel = await request('PUT', '/admin/orders/' + ord2.id + '/status', { status: 'canceled' }, adminToken);
      assertOk('管理员取消订单', cancel);

      const afterCancel = await request('GET', '/flowers/' + item.flower_id);
      assert(
        '取消后库存已回滚',
        afterCancel.json.code === 0 && afterCancel.json.data.stock === stockBefore + item.quantity,
        { before: stockBefore, after: afterCancel.json.data && afterCancel.json.data.stock, qty: item.quantity }
      );
    } else {
      assert('取消后库存回滚（缺少订单明细）', false, detail2.json);
    }
  } else {
    assert('管理员取消订单（无可取消订单，跳过）', false, paidList2.json);
  }

  console.log('');
  console.log('【六、操作日志审计】');

  // 35. 操作日志记录上述写操作
  const logs = await request('GET', '/admin/logs?limit=50', null, adminToken);
  const logList = logs.json.code === 0 ? logs.json.data.list || logs.json.data : [];
  const actions = logList.map((l) => l.action || '');
  assert('操作日志记录了新增商品', actions.some((a) => a.indexOf('新增商品') >= 0 || a.indexOf('新增') >= 0), actions.slice(0, 8));
  assert('操作日志记录了发货操作', actions.some((a) => a.indexOf('发货') >= 0), actions.slice(0, 8));
  assert('操作日志记录了用户操作', actions.some((a) => a.indexOf('用户') >= 0), actions.slice(0, 8));

  // 36. 越权校验：普通用户访问管理端接口
  const custLogin = await request('POST', '/auth/login', { username: 'customer', password: '123456' });
  const custToken = custLogin.json.code === 0 ? custLogin.json.data.token : null;
  const forbid = await request('GET', '/admin/users?page=1&pageSize=1', null, custToken);
  assert('普通用户访问用户管理接口被拦截', forbid.status === 403 || forbid.json.code !== 0, forbid.json);

  const forbid2 = await request('POST', '/categories', { name: '越权分类' + stamp }, custToken);
  assert('普通用户新增分类被拦截', forbid2.status === 403 || forbid2.json.code !== 0, forbid2.json);

  // 37. 未登录访问管理端
  const noAuth = await fetch(BASE + '/admin/stats/overview');
  const noAuthJson = await noAuth.json();
  assert('未登录访问后台统计被拦截', noAuth.status === 401 || noAuthJson.code !== 0, noAuthJson);

  console.log('');
  console.log('----------------------------------------');
  console.log('测试结束：通过 ' + passed + ' 项，失败 ' + failed + ' 项');
  console.log('----------------------------------------');

  process.exit(failed > 0 ? 1 : 0);
})();
