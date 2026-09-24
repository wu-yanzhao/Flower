-- =============================================================
-- 鲜花订购与管理系统 —— 数据库表结构（SQLite）
-- 说明：所有表均使用 IF NOT EXISTS，重复启动不会破坏已有数据
-- =============================================================

-- 1. 用户表（顾客 / 管理员）
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,          -- 登录账号
  password_hash TEXT    NOT NULL,                 -- scrypt 口令摘要
  salt          TEXT    NOT NULL,                 -- 随机盐值
  nickname      TEXT    NOT NULL,                 -- 昵称
  phone         TEXT,
  email         TEXT,
  avatar        TEXT,
  role          TEXT    NOT NULL DEFAULT 'customer', -- customer | admin
  status        TEXT    NOT NULL DEFAULT 'active',   -- active | disabled
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT
);

-- 2. 收货地址表
CREATE TABLE IF NOT EXISTS addresses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  receiver    TEXT    NOT NULL,
  phone       TEXT    NOT NULL,
  region      TEXT    NOT NULL,                    -- 省 / 市 / 区
  detail      TEXT    NOT NULL,                    -- 详细地址
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_address_user ON addresses(user_id);

-- 3. 鲜花分类表
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 4. 鲜花商品表
CREATE TABLE IF NOT EXISTS flowers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id    INTEGER NOT NULL,
  name           TEXT    NOT NULL,
  subtitle       TEXT,                             -- 副标题 / 一句话卖点
  price          REAL    NOT NULL,                 -- 现价
  original_price REAL,                              -- 原价（划线价）
  stock          INTEGER NOT NULL DEFAULT 0,        -- 库存
  sales          INTEGER NOT NULL DEFAULT 0,        -- 累计销量
  image          TEXT,                              -- 主图
  description    TEXT,                              -- 商品详情
  material       TEXT,                              -- 花材
  flower_language TEXT,                             -- 花语
  packing        TEXT,                              -- 包装说明
  status         TEXT    NOT NULL DEFAULT 'on',     -- on 上架 | off 下架
  recommended    INTEGER NOT NULL DEFAULT 0,        -- 是否首页推荐
  rating         REAL    NOT NULL DEFAULT 5.0,      -- 综合评分（冗余字段，展示用）
  created_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at     TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE INDEX IF NOT EXISTS idx_flower_category ON flowers(category_id);
CREATE INDEX IF NOT EXISTS idx_flower_status  ON flowers(status);

-- 5. 购物车表（同一用户同一商品只保留一条记录）
CREATE TABLE IF NOT EXISTS cart_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  flower_id  INTEGER NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1,
  checked    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT,
  UNIQUE (user_id, flower_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (flower_id) REFERENCES flowers(id) ON DELETE CASCADE
);

-- 6. 订单表
CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no         TEXT    NOT NULL UNIQUE,        -- 业务订单号
  user_id          INTEGER NOT NULL,
  receiver_name    TEXT    NOT NULL,
  receiver_phone   TEXT    NOT NULL,
  receiver_address TEXT    NOT NULL,
  remark           TEXT,
  total_amount     REAL    NOT NULL DEFAULT 0,     -- 商品总额
  discount_amount  REAL    NOT NULL DEFAULT 0,     -- 优惠金额
  pay_amount       REAL    NOT NULL DEFAULT 0,     -- 实付金额
  item_count       INTEGER NOT NULL DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'pending',
  -- pending 待付款 | paid 待发货 | shipped 待收货 | completed 已完成 | canceled 已取消
  pay_method       TEXT,
  express_company  TEXT,
  express_no       TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  paid_at          TEXT,
  shipped_at       TEXT,
  completed_at     TEXT,
  canceled_at      TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_order_user   ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);

-- 7. 订单明细表（下单时快照商品信息，避免商品改价影响历史订单）
CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL,
  flower_id    INTEGER NOT NULL,
  flower_name  TEXT    NOT NULL,
  flower_image TEXT,
  price        REAL    NOT NULL,
  quantity     INTEGER NOT NULL,
  subtotal     REAL    NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_item_order ON order_items(order_id);

-- 8. 评价表
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  flower_id  INTEGER NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5,           -- 1~5 星
  content    TEXT,
  reply      TEXT,                                  -- 管理员回复
  status     TEXT    NOT NULL DEFAULT 'visible',    -- visible | hidden
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (order_id, flower_id),
  FOREIGN KEY (order_id)  REFERENCES orders(id)  ON DELETE CASCADE,
  FOREIGN KEY (flower_id) REFERENCES flowers(id)
);
CREATE INDEX IF NOT EXISTS idx_review_flower ON reviews(flower_id);

-- 9. 收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  flower_id  INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (user_id, flower_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (flower_id) REFERENCES flowers(id) ON DELETE CASCADE
);

-- 10. 后台操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id   INTEGER,
  admin_name TEXT,
  module     TEXT    NOT NULL,                     -- 商品 / 订单 / 用户 / 评价 / 分类
  action     TEXT    NOT NULL,                     -- 新增 / 修改 / 下架 / 发货 ...
  detail     TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
