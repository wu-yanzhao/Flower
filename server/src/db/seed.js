'use strict';

const { hashPassword } = require('../utils/password');
const { generateOrderNo, money, now } = require('../utils/helpers');

/**
 * 演示数据初始化
 * 仅在 flowers 表为空时执行（reset 脚本会先删库再调用）
 */

const CATEGORIES = [
  { name: '爱情玫瑰', description: '以玫瑰为主花材，表达爱意与浪漫', sort: 1 },
  { name: '生日祝福', description: '生日送花首选，阳光可爱', sort: 2 },
  { name: '感恩母爱', description: '康乃馨为主，献给最亲爱的妈妈', sort: 3 },
  { name: '清新百合', description: '百合、郁金香，淡雅清香', sort: 4 },
  { name: '永生花盒', description: '可保存 3 年以上的永生花礼盒', sort: 5 },
  { name: '开业庆典', description: '开业花篮、商务花礼', sort: 6 },
];

function flower(cid, name, subtitle, price, originalPrice, stock, sales, image, extra) {
  return Object.assign(
    {
      category_id: cid,
      name,
      subtitle,
      price,
      original_price: originalPrice,
      stock,
      sales,
      image,
      status: 'on',
      recommended: 0,
      rating: 5,
      material: '主花材：当季鲜切花；配材：尤加利叶、满天星',
      flower_language: '愿你的每一天都如鲜花般灿烂',
      packing: '韩式雾面纸 + 缎带蝴蝶结 + 保鲜棉 + 免费贺卡',
      description:
        '每一束鲜花均由本地花艺师当日现做，花材清晨直达，冷链配送，' +
        '承诺“送达时如不新鲜，无条件重做”。支持全国大部分城市当日达，' +
        '下单后可备注配送时间段，我们会尽量为您安排。',
    },
    extra || {}
  );
}

const FLOWERS = [
  flower(1, '一生挚爱·红玫瑰 33 朵', '经典 33 朵红玫瑰，告白首选', 399, 568, 60, 1286, '/assets/images/flowers/flower-01.svg', { recommended: 1, flower_language: '一生一世，只爱你一人', material: '主花材：A 级红玫瑰 33 朵；配材：尤加利叶', rating: 4.9 }),
  flower(1, '怦然心动·香槟玫瑰 19 朵', '温柔香槟色，送给心动的她', 299, 398, 45, 862, '/assets/images/flowers/flower-02.svg', { recommended: 1, flower_language: '你是我所有温柔的归处', material: '主花材：香槟玫瑰 19 朵；配材：白色满天星', rating: 4.8 }),
  flower(1, '甜蜜告白·粉玫瑰 11 朵', '初恋般的粉色悸动', 199, 268, 80, 1543, '/assets/images/flowers/flower-03.svg', { recommended: 1, flower_language: '喜欢你，是我藏不住的心事', rating: 4.7 }),
  flower(1, '蓝色妖姬·永生蓝玫瑰', '神秘高雅，独一无二的浪漫', 459, 599, 30, 421, '/assets/images/flowers/flower-04.svg', { flower_language: '奇迹与不可能的爱', rating: 4.6 }),

  flower(2, '生日快乐·向日葵混搭花束', '阳光向日葵，祝你岁岁欢愉', 259, 328, 70, 976, '/assets/images/flowers/flower-05.svg', { recommended: 1, flower_language: '愿你如向日葵般明媚', material: '主花材：向日葵 5 支、香槟玫瑰 9 朵', rating: 4.9 }),
  flower(2, '星河璀璨·满天星花束', '满天星点缀，浪漫不张扬', 189, 258, 90, 1132, '/assets/images/flowers/flower-06.svg', { flower_language: '我甘愿做配角，只为你闪耀', rating: 4.7 }),
  flower(2, '童话公主·粉紫混搭花束', '少女心满满的生日惊喜', 329, 428, 55, 642, '/assets/images/flowers/flower-07.svg', { flower_language: '愿你永远被宠成公主', rating: 4.8 }),

  flower(3, '母爱如歌·康乃馨 20 朵', '粉色康乃馨，送给最美的妈妈', 219, 298, 100, 1893, '/assets/images/flowers/flower-08.svg', { recommended: 1, flower_language: '妈妈，您辛苦了', material: '主花材：粉色康乃馨 20 朵', rating: 5 }),
  flower(3, '感恩的心·红色康乃馨礼盒', '经典红色，表达最深的敬意', 269, 358, 65, 754, '/assets/images/flowers/flower-09.svg', { flower_language: '健康长寿，平安喜乐', rating: 4.8 }),
  flower(3, '萱草忘忧·康乃馨百合混搭', '祝妈妈无忧无虑，笑口常开', 359, 468, 40, 386, '/assets/images/flowers/flower-10.svg', { flower_language: '忘却一切烦忧', rating: 4.7 }),

  flower(4, '清雅百合·白色香水百合', '亭亭玉立，清香满室', 289, 388, 50, 821, '/assets/images/flowers/flower-11.svg', { recommended: 1, flower_language: '百年好合，纯洁无瑕', rating: 4.9 }),
  flower(4, '郁见你·七彩郁金香', '荷兰进口郁金香，春日限定', 239, 318, 35, 566, '/assets/images/flowers/flower-12.svg', { flower_language: '美丽的你，值得一切美好', rating: 4.6 }),
  flower(4, '素心若雪·白玫瑰百合花束', '极简黑白灰，高级感十足', 319, 428, 28, 302, '/assets/images/flowers/flower-13.svg', { flower_language: '纯粹的爱，不染尘埃', rating: 4.5 }),

  flower(5, '永恒之心·永生花音乐盒', '可保存三年，伴音乐旋转', 599, 799, 25, 258, '/assets/images/flowers/flower-14.svg', { recommended: 1, flower_language: '时光不老，爱意永恒', packing: '高档礼盒 + 手提袋 + 定制贺卡', rating: 5 }),
  flower(5, '星语心愿·永生花玻璃罩', 'ins 风摆件，送闺蜜首选', 429, 568, 30, 197, '/assets/images/flowers/flower-15.svg', { flower_language: '愿你心愿都能实现', rating: 4.7 }),

  flower(6, '开业大吉·三层落地花篮', '开业庆典标配，大气喜庆', 899, 1188, 20, 143, '/assets/images/flowers/flower-16.svg', { flower_language: '生意兴隆，财源广进', rating: 4.8 }),
  flower(6, '前程似锦·商务祝贺花束', '乔迁升职祝贺，稳重得体', 469, 618, 32, 176, '/assets/images/flowers/flower-17.svg', { flower_language: '前程似锦，步步高升', rating: 4.6 }),
  flower(6, '暖心慰问·探望病人花束', '淡雅不刺激，祝早日康复', 199, 268, 60, 305, '/assets/images/flowers/flower-18.svg', { flower_language: '早日康复，平安顺遂', rating: 4.7 }),
];

const USERS = [
  { username: 'admin', password: 'admin123', nickname: '超级管理员', role: 'admin', phone: '13800000000', email: 'admin@flower.com' },
  { username: 'customer', password: '123456', nickname: '林小满', role: 'customer', phone: '13900000001', email: 'customer@flower.com' },
  { username: 'zhanghua', password: '123456', nickname: '张华', role: 'customer', phone: '13900000002', email: 'zhanghua@flower.com' },
  { username: 'lixiaomei', password: '123456', nickname: '李小美', role: 'customer', phone: '13900000003', email: 'lixiaomei@flower.com' },
  { username: 'wangqiang', password: '123456', nickname: '王强', role: 'customer', phone: '13900000004', email: 'wangqiang@flower.com' },
];

const ADDRESSES = [
  { user: 'customer', receiver: '林小满', phone: '13900000001', region: '广东省 广州市 天河区', detail: '中山大道西 100 号华南公寓 A 座 1802', is_default: 1 },
  { user: 'customer', receiver: '林小满(公司)', phone: '13900000001', region: '广东省 广州市 越秀区', detail: '环市东路 200 号天河大厦 25 层', is_default: 0 },
  { user: 'zhanghua', receiver: '张华', phone: '13900000002', region: '广东省 深圳市 南山区', detail: '科技园南路 88 号腾讯大厦 12 层', is_default: 1 },
  { user: 'lixiaomei', receiver: '李小美', phone: '13900000003', region: '广东省 珠海市 香洲区', detail: '情侣中路 66 号海景花园 3 栋 902', is_default: 1 },
  { user: 'wangqiang', receiver: '王强', phone: '13900000004', region: '广东省 东莞市 南城街道', detail: '鸿福路 50 号万达广场 B 座 1501', is_default: 1 },
];

const REVIEW_TEXTS = [
  { rating: 5, content: '花非常新鲜，包装很用心，女朋友特别喜欢，配送也准时，五星好评！' },
  { rating: 5, content: '第二次购买了，品质一如既往，花艺师搭配得很有品味，推荐！' },
  { rating: 4, content: '花束挺漂亮的，就是配送稍微晚了一点，整体还是满意的。' },
  { rating: 5, content: '妈妈收到很开心，康乃馨开得正好，谢谢你们，以后还会来。' },
  { rating: 4, content: '包装精致，花材新鲜，价格也实惠，性价比很高。' },
  { rating: 3, content: '花是好的，但与图片略有色差，希望以后能更准确一些。' },
];

module.exports = function seed(db) {
  const categoryIds = CATEGORIES.map((c) => {
    const info = db.run('INSERT INTO categories (name, description, sort) VALUES (?,?,?)', [c.name, c.description, c.sort]);
    return info.lastInsertRowid;
  });

  // 花材/图片映射：FLOWERS 中使用的是 1..6 的分类序号，这里替换为真实自增 id
  FLOWERS.forEach((f, index) => {
    f.category_id = categoryIds[(f.category_id || 1) - 1];
    const info = db.run(
      `INSERT INTO flowers
        (category_id, name, subtitle, price, original_price, stock, sales, image,
         description, material, flower_language, packing, status, recommended, rating, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        f.category_id, f.name, f.subtitle, f.price, f.original_price, f.stock, f.sales, f.image,
        f.description, f.material, f.flower_language, f.packing, f.status, f.recommended, f.rating,
        now(), now(),
      ]
    );
    f.id = info.lastInsertRowid;
  });

  const userIds = {};
  USERS.forEach((u) => {
    const hash = hashPassword(u.password);
    const info = db.run(
      'INSERT INTO users (username, password_hash, salt, nickname, phone, email, role, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [u.username, hash, hash.split('$')[4], u.nickname, u.phone, u.email, u.role, 'active', now()]
    );
    userIds[u.username] = info.lastInsertRowid;
  });

  ADDRESSES.forEach((a) => {
    db.run('INSERT INTO addresses (user_id, receiver, phone, region, detail, is_default) VALUES (?,?,?,?,?,?)', [
      userIds[a.user], a.receiver, a.phone, a.region, a.detail, a.is_default,
    ]);
  });

  // 收藏
  db.run('INSERT INTO favorites (user_id, flower_id) VALUES (?,?)', [userIds.customer, FLOWERS[0].id]);
  db.run('INSERT INTO favorites (user_id, flower_id) VALUES (?,?)', [userIds.customer, FLOWERS[4].id]);

  // 购物车
  db.run('INSERT INTO cart_items (user_id, flower_id, quantity, checked) VALUES (?,?,?,?)', [userIds.customer, FLOWERS[0].id, 1, 1]);
  db.run('INSERT INTO cart_items (user_id, flower_id, quantity, checked) VALUES (?,?,?,?)', [userIds.customer, FLOWERS[7].id, 2, 1]);

  // ---------------- 历史订单（用于统计图表） ----------------
  const customers = ['customer', 'zhanghua', 'lixiaomei', 'wangqiang'];
  const statuses = ['completed', 'completed', 'completed', 'completed', 'shipped', 'paid', 'pending', 'canceled'];
  const express = ['顺丰速运', '京东物流', '中通快递', '花艺同城专送'];

  let seedIndex = 0;
  for (let dayOffset = 13; dayOffset >= 0; dayOffset -= 1) {
    const count = dayOffset > 8 ? 1 + (seedIndex % 2) : 1 + ((seedIndex + dayOffset) % 3);
    for (let i = 0; i < count; i += 1) {
      seedIndex += 1;
      const username = customers[seedIndex % customers.length];
      const userId = userIds[username];
      const fidx = (seedIndex * 3 + i) % FLOWERS.length;
      const f = FLOWERS[fidx];
      const fidx2 = (fidx + 5) % FLOWERS.length;
      const f2 = FLOWERS[fidx2];
      const qty = 1 + (seedIndex % 2);
      const qty2 = seedIndex % 3 === 0 ? 1 : 0;

      const items = [{ f, qty }];
      if (qty2) items.push({ f: f2, qty: qty2 });

      const total = money(items.reduce((sum, it) => sum + it.f.price * it.qty, 0));
      const discount = total >= 500 ? 50 : total >= 300 ? 20 : 0;
      const pay = money(total - discount);
      const status = statuses[seedIndex % statuses.length];
      const base = new Date();
      base.setDate(base.getDate() - dayOffset);
      base.setHours(9 + (seedIndex % 10), (seedIndex * 7) % 60, 0, 0);
      const createdAt = formatTime(base);
      const addr = ADDRESSES.find((a) => a.user === username);

      const orderInfo = db.run(
        `INSERT INTO orders
          (order_no, user_id, receiver_name, receiver_phone, receiver_address, remark,
           total_amount, discount_amount, pay_amount, item_count, status, pay_method,
           express_company, express_no, created_at, paid_at, shipped_at, completed_at, canceled_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          generateOrderNo(), userId, addr.receiver, addr.phone, `${addr.region} ${addr.detail}`,
          seedIndex % 4 === 0 ? '请尽量在下午 3 点后送达，谢谢！' : '',
          total, discount, pay, items.reduce((s, it) => s + it.qty, 0), status,
          status === 'pending' ? null : '微信支付',
          status === 'shipped' || status === 'completed' ? express[seedIndex % express.length] : null,
          status === 'shipped' || status === 'completed' ? `SF${100000000000 + seedIndex * 37}` : null,
          createdAt,
          status === 'pending' || status === 'canceled' ? null : createdAt,
          status === 'shipped' || status === 'completed' ? createdAt : null,
          status === 'completed' ? createdAt : null,
          status === 'canceled' ? createdAt : null,
        ]
      );
      const orderId = orderInfo.lastInsertRowid;

      items.forEach((it) => {
        db.run(
          'INSERT INTO order_items (order_id, flower_id, flower_name, flower_image, price, quantity, subtotal) VALUES (?,?,?,?,?,?,?)',
          [orderId, it.f.id, it.f.name, it.f.image, it.f.price, it.qty, money(it.f.price * it.qty)]
        );
      });

      if (status === 'completed' && seedIndex % 2 === 0) {
        const rv = REVIEW_TEXTS[seedIndex % REVIEW_TEXTS.length];
        db.run(
          'INSERT INTO reviews (order_id, user_id, flower_id, rating, content, status, created_at) VALUES (?,?,?,?,?,?,?)',
          [orderId, userId, f.id, rv.rating, rv.content, 'visible', createdAt]
        );
      }
    }
  }

  // 后台操作日志示例
  db.run('INSERT INTO operation_logs (admin_id, admin_name, module, action, detail, created_at) VALUES (?,?,?,?,?,?)', [
    userIds.admin, '超级管理员', '商品', '新增商品', '新增「一生挚爱·红玫瑰 33 朵」', now(),
  ]);
  db.run('INSERT INTO operation_logs (admin_id, admin_name, module, action, detail, created_at) VALUES (?,?,?,?,?,?)', [
    userIds.admin, '超级管理员', '订单', '发货', '订单发货，物流：顺丰速运', now(),
  ]);
};

function formatTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds()
  )}`;
}
