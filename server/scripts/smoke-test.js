'use strict';

/**
 * 接口冒烟测试（无需依赖，使用 Node 内置 fetch）
 * ------------------------------------------------------------
 * 覆盖：注册 -> 登录 -> 浏览 -> 搜索 -> 加购 -> 下单 -> 支付
 *      -> 后台发货 -> 确认收货 -> 评价 -> 数据统计
 * 用法：先 npm start，再另开终端执行 npm run test:api
 */

const BASE = process.env.API_BASE || 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

async function request(method, path, body, token) {
  const res = await fetch(BASE + path, {
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

(async function main() {
  console.log('接口冒烟测试开始：', BASE);

  // 1. 健康检查
  const health = await request('GET', '/health');
  assert('健康检查', health.json.code === 0, health.json);

  // 2. 注册校验（空账号应被拒绝）
  const badRegister = await request('POST', '/auth/register', { username: '', password: '123' });
  assert('注册参数校验（空账号拒绝）', badRegister.status === 400, badRegister.json);

  // 3. 注册新用户
  const username = 'test' + Date.now().toString().slice(-6);
  const reg = await request('POST', '/auth/register', {
    username,
    password: '123456',
    nickname: '测试用户',
    phone: '13900001111',
  });
  assert('用户注册', reg.json.code === 0 && !!reg.json.data.token, reg.json);
  const userToken = reg.json.data && reg.json.data.token;

  // 4. 重复注册应失败
  const dup = await request('POST', '/auth/register', { username, password: '123456', nickname: '测试用户' });
  assert('重复注册拦截', dup.status === 400, dup.json);

  // 5. 错误密码登录
  const badLogin = await request('POST', '/auth/login', { username, password: '000000' });
  assert('错误密码登录拦截', badLogin.status === 401, badLogin.json);

  // 6. 管理员登录
  const adminLogin = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  assert('管理员登录', adminLogin.json.code === 0 && adminLogin.json.data.user.role === 'admin', adminLogin.json);
  const adminToken = adminLogin.json.data && adminLogin.json.data.token;

  // 7. 商品列表与搜索
  const list = await request('GET', '/flowers?page=1&pageSize=8');
  assert('商品列表分页', list.json.code === 0 && list.json.data.list.length > 0, list.json);
  const keyword = encodeURIComponent('玫瑰');
  const search = await request('GET', `/flowers?keyword=${keyword}`);
  assert(
    '关键词搜索',
    search.json.code === 0 && search.json.data.list.every((f) => f.name.includes('玫瑰') || f.flower_language.includes('玫瑰')),
    search.json.message
  );

  // 8. 商品详情
  const flowerId = list.json.data.list[0].id;
  const detail = await request('GET', `/flowers/${flowerId}`, null, userToken);
  assert('商品详情', detail.json.code === 0 && detail.json.data.id === flowerId, detail.json);

  // 9. 未登录访问购物车应 401
  const noAuth = await request('GET', '/cart');
  assert('未登录鉴权拦截', noAuth.status === 401, noAuth.json);

  // 10. 加入购物车
  const add = await request('POST', '/cart', { flowerId, quantity: 2 }, userToken);
  assert('加入购物车', add.json.code === 0, add.json);
  const cart = await request('GET', '/cart', null, userToken);
  assert('购物车列表', cart.json.data.list.length > 0, cart.json);

  // 11. 超量购买应被库存校验拦截
  const overflow = await request('POST', '/cart', { flowerId, quantity: 99999 }, userToken);
  assert('库存不足校验', overflow.status === 400, overflow.json);

  // 12. 收货地址
  const addr = await request(
    'POST',
    '/addresses',
    { receiver: '张三', phone: '13900002222', region: '广东省 广州市 天河区', detail: '测试路 1 号', is_default: 1 },
    userToken
  );
  assert('新增收货地址', addr.json.code === 0, addr.json);
  const addrList = await request('GET', '/addresses', null, userToken);
  assert('地址列表', addrList.json.data.length > 0, addrList.json);

  // 13. 提交订单
  const cartIds = cart.json.data.list.map((i) => i.id);
  const order = await request('POST', '/orders', { cartIds, addressId: addrList.json.data[0].id, remark: '冒烟测试订单' }, userToken);
  assert('提交订单', order.json.code === 0 && !!order.json.data.orderNo, order.json);
  const orderId = order.json.data && order.json.data.orderId;

  // 14. 支付
  const pay = await request('POST', `/orders/${orderId}/pay`, { payMethod: '微信支付' }, userToken);
  assert('订单支付', pay.json.code === 0 && pay.json.data.status === 'paid', pay.json);

  // 15. 非法状态流转（已支付状态下再次支付）
  const payAgain = await request('POST', `/orders/${orderId}/pay`, {}, userToken);
  assert('重复支付拦截', payAgain.status === 400, payAgain.json);

  // 16. 后台发货
  const ship = await request('POST', `/admin/orders/${orderId}/ship`, { expressCompany: '顺丰速运', expressNo: 'SF1234567890' }, adminToken);
  assert('后台发货', ship.json.code === 0, ship.json);

  // 17. 确认收货
  const receive = await request('POST', `/orders/${orderId}/receive`, {}, userToken);
  assert('确认收货', receive.json.code === 0, receive.json);

  // 18. 评价
  const review = await request('POST', '/reviews', { orderId, items: [{ flowerId, rating: 5, content: '自动化测试评价：花很新鲜！' }] }, userToken);
  assert('订单评价', review.json.code === 0, review.json);

  // 19. 取消订单后库存回滚（新建一笔再取消）
  const add2 = await request('POST', '/cart', { flowerId, quantity: 1 }, userToken);
  assert('再次加购', add2.json.code === 0, add2.json);
  const cart2 = await request('GET', '/cart', null, userToken);
  const order2 = await request('POST', '/orders', { cartIds: cart2.json.data.list.map((i) => i.id), addressId: addrList.json.data[0].id }, userToken);
  const stockBefore = (await request('GET', `/flowers/${flowerId}`)).json.data.stock;
  const cancel = await request('POST', `/orders/${order2.json.data.orderId}/cancel`, {}, userToken);
  const stockAfter = (await request('GET', `/flowers/${flowerId}`)).json.data.stock;
  assert('取消订单', cancel.json.code === 0, cancel.json);
  assert('取消后库存回滚', stockAfter >= stockBefore, { stockBefore, stockAfter });

  // 20. 数据统计
  const overview = await request('GET', '/admin/stats/overview', null, adminToken);
  assert('后台数据概览', overview.json.code === 0 && typeof overview.json.data.sales === 'number', overview.json);
  const trend = await request('GET', '/admin/stats/trend?days=7', null, adminToken);
  assert('销售趋势', trend.json.code === 0 && trend.json.data.length === 7, trend.json);
  const top = await request('GET', '/admin/stats/top?limit=5', null, adminToken);
  assert('热销商品 TOP5', top.json.code === 0, top.json);

  // 22. 其余后台统计与日志
  const categoryStat = await request('GET', '/admin/stats/category', null, adminToken);
  assert('分类销量统计', categoryStat.json.code === 0 && categoryStat.json.data.length > 0, categoryStat.json);
  const statusStat = await request('GET', '/admin/stats/status', null, adminToken);
  assert('订单状态分布', statusStat.json.code === 0, statusStat.json);
  const recent = await request('GET', '/admin/stats/recent?limit=6', null, adminToken);
  assert('最新订单', recent.json.code === 0, recent.json);
  const logs = await request('GET', '/admin/logs?limit=6', null, adminToken);
  assert('操作日志', logs.json.code === 0, logs.json);

  // 23. 后台商品与用户列表
  const adminFlowers = await request('GET', '/admin/flowers?page=1&pageSize=3', null, adminToken);
  assert('后台商品列表', adminFlowers.json.code === 0, adminFlowers.json);
  const adminUsers = await request('GET', '/admin/users?page=1&pageSize=3', null, adminToken);
  assert('后台用户列表', adminUsers.json.code === 0, adminUsers.json);
  const adminReviews = await request('GET', '/admin/reviews?page=1&pageSize=3', null, adminToken);
  assert('后台评价列表', adminReviews.json.code === 0, adminReviews.json);

  // 21. 权限校验：普通用户访问后台接口
  const forbidden = await request('GET', '/admin/users', null, userToken);
  assert('普通用户越权拦截', forbidden.status === 403, forbidden.json);

  console.log('----------------------------------------');
  console.log(`测试结束：通过 ${passed} 项，失败 ${failed} 项`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('测试执行异常：', err);
  process.exit(1);
});
