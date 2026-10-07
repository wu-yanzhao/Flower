# 13 全面 Bug 复检报告（按严重程度排序）

> 时间：2026-10-07 12:23
> 范围：`E:\Flower\server`（后端）+ 顺带说明前端
> 方法：复用上一轮 `docs/11` 的逐文件审计结论，本次**重新核实**所有条目（代码自上次后未改动，仅结束过占用端口的进程），并**新增一项自动化校验**：对 `src/routes/*` 中每个 `Controller.method` 引用与对应控制器 `exports.method` 做交叉比对。**结果：全项目仅 `reviewController.mine` 一处路由/导出不匹配**（即 B1），无其他 handler 拼写类崩溃。
> 严重程度定义：**高** = 崩溃 / 核心数据错误或明确安全漏洞；**中** = 局部功能异常或有限安全影响；**低** = 健壮性、文档、死代码等。

---

## 高（High）

### B1 ｜ `GET /api/reviews/mine` 必然 500 —— 路由引用了不存在的方法
- **位置**：`server/src/routes/member.routes.js:26` 调用 `reviewController.mine`；`server/src/controllers/review.controller.js` 实际导出名为 `exports.myList`（第 56 行）。
- **触发条件**：任意已登录用户请求 `GET /api/reviews/mine`（带 `Authorization`）。
- **实际现象 / 预期**：返回 `500 {"code":500,"message":"服务器内部错误"}`；应为 `200` 并返回该用户的评价列表（`myList` 逻辑完整可用）。
- **根本原因**：方法名拼写不一致。`reviewController.mine` 为 `undefined`，被 `asyncHandler` 包裹后 Express 调用即抛错，被 `errorHandler` 兜成 500。自动化交叉校验已确认这是**全项目唯一**的路由/导出不匹配。
- **修复方案**：将 `member.routes.js:26` 改为 `reviewController.myList`（改 1 个词，零副作用）。
- **备注**：当前前端无页面调用该接口（订单页只做"提交评价"`POST /reviews`），故不影响商城演示；但答辩翻接口清单一点必崩，**强烈建议修**。

### B2 ｜ 管理员取消订单不回退销量，导致 `flowers.sales` 数据失真
- **位置**：`server/src/controllers/order.controller.js:320-330`（管理员 `adminSetStatus` 的 `canceled` 分支），对照用户端 `cancel`（第 213-222 行）。
- **触发条件**：后台订单列表对任意 `paid`/`shipped` 订单点「取消」。
- **实际现象 / 预期**：库存 `stock` 正确回滚（`stock + qty`），但 `sales` **完全不变**；预期与用户端一致：`sales = sales - qty` 并做非负钳制。
- **根本原因**：管理员分支第 325 行只写了 `UPDATE flowers SET stock = stock + ?`，漏掉 `sales = sales - ?` 及钳制；用户端第 217 行有完整回退。**两条取消路径行为不一致**。
- **实测证据**（事务内模拟后已回滚，未污染数据）：取消前 `stock=58, sales=1288` → 管理员取消后 `stock=60, sales=1288`。
- **影响面**：`flower.controller.js` 的 `sort=sales` 排行、`stats.controller.js:77` 热销 TOP、`stats.controller.js:90` 分类销量饼图均依赖 `sales` 字段 → 图表被污染。当前 `flowers.sales` 与订单真实销量偏差最高达 1891（种子数据为模拟值，B2 会继续叠加误差）。
- **修复方案**：把第 325 行改为与用户端一致：
  ```js
  db.run('UPDATE flowers SET stock = stock + ?, sales = sales - ?, updated_at = ? WHERE id = ?',
    [it.quantity, it.quantity, now(), it.flower_id]);
  // 紧跟一条非负钳制
  db.run('UPDATE flowers SET sales = CASE WHEN sales < 0 THEN 0 ELSE sales END WHERE id = ?', [it.flower_id]);
  ```

### B3 ｜ 同上，管理员可取消 `pending` 订单时 `sales` 从不增加 → 负向错账
- **位置**：`order.controller.js:320-330`；触发源 `web/admin/js/orders.js:61-63`（`pending` 也显示取消按钮）。
- **触发条件**：用户下单（`pending`，此时 `sales + qty`）→ 后台对 `pending` 订单点取消。
- **根本原因**：与 B2 同源，管理员取消分支缺 `sales` 回退。说明 B2 在 `pending/paid/shipped` 三种可取消状态下 **100% 触发**。
- **修复方案**：同 B2，一处修复同时覆盖三种状态。

### B4 ｜ 登录接口泄露"账号是否存在"，可被执行用户名枚举
- **位置**：`server/src/controllers/auth.controller.js:51` 与 `:52`。
- **触发条件**：对 `POST /api/auth/login` 分别提交"存在的账号+错密码"与"不存在的账号+任意密码"。
- **实际现象 / 预期**：存在 → `401 账号或密码错误`；不存在 → `401 账号不存在，请注册后再登录`；两者应**完全一致**。
- **根本原因**：第 51 行先判 `!user` 抛语义化文案，第 52 行才校验密码。响应差异暴露用户名是否存在，可先枚举出 `admin`/`customer` 再针对性爆破。
- **修复方案**：两处统一抛出 `new HttpError(401, '账号或密码错误')`。（前端无依赖该文案的逻辑，改动安全。）

### B5 ｜ JWT 密钥硬编码默认值，密钥一旦泄露可伪造管理员身份
- **位置**：`server/src/config.js:36`，对照 `server/.env.example:5`（明文同值）。
- **触发条件**：不设 `JWT_SECRET` 直接启动（当前即此情况），读取源码即得密钥。
- **实际现象 / 预期**：密钥固定为 `'flower-shop-graduation-project-secret'`；生产/公开环境必须由环境变量注入随机密钥。
- **根本原因**：`process.env.JWT_SECRET || '硬编码默认值'` 兜底。仓库若上传 GitHub，任何人可用该密钥**自行签发合法 token 并伪造 admin**。
- **修复方案**：保留本地默认值以便开箱即用，但加保护：
  1. `config.js` 在 `env === 'production'` 且未设 `JWT_SECRET` 时**抛错拒绝启动**；
  2. 启动横幅打印 `⚠️ 正在使用默认 JWT 密钥，仅限本地演示`；
  3. `.env.example` 中把该值改为 `请替换为随机字符串`。
- **关联小项（B5a，低）**：`utils/jwt.js:52` 用 `expected !== s` 做签名比较（非 `timingSafeEqual`），且未校验 header `alg`。本实现因始终重算 HMAC，`alg:none` 不可利用，但建议改用 `crypto.timingSafeEqual` 以达标。

---

## 中（Medium）

### B6 ｜ `logout` 是空操作，token 在 7 天内持续有效
- **位置**：`server/src/controllers/auth.controller.js:108`。
- **触发条件**：登录 → 调 `POST /api/auth/logout` → 用同一旧 token 再请求任意鉴权接口。
- **实际现象 / 预期**：接口返回"已退出登录"，但旧 token 仍通过 `authRequired`；预期退出后旧 token 立即失效。
- **根本原因**：实现为 `(req,res)=>ok(res,null,'已退出登录')`，JWT 无状态，服务端无失效手段。
- **修复方案**：轻量方案——`users` 表加 `token_version` 并入 payload，登出时 `+1`，`resolveUser` 校验版本号。毕设场景若不改，建议在文档中主动说明"JWT 无状态，登出由前端清除凭证实现"（本身是加分技术点）。

### B7 ｜ 隐藏/删除评价后不重算商品评分，前台评分与实际不符
- **位置**：`server/src/controllers/review.controller.js:108`（`setStatus`）与 `:125`（`remove`）。
- **触发条件**：某商品评价被隐藏或删除后查看 `flowers.rating`。
- **实际现象 / 预期**：`flowers.rating` 仍为旧值；预期与 `create`（第 43-47 行）一致，重算 `AVG(visible reviews)`。
- **根本原因**：`create` 有完整重算逻辑，但 `setStatus`/`remove` 只改 `reviews` 表，**未回写 `flowers.rating`**；而 `flowers.rating` 正是前台列表展示字段。
- **实测证据**：扫描 18 个商品，**6 个** `flowers.rating` 与实时平均值不一致（如"永恒之心·永生花音乐盒"字段 5.0 vs 实时 4.0）。
- **修复方案**：抽出私有函数 `recalcRating(db, flowerId)`，在 `create`/`setStatus`/`remove` 三处统一调用（单文件内改动）。

### B8 ｜ `generateOrderNo()` 无唯一性校验，同秒并发可能撞号
- **位置**：`server/src/utils/helpers.js:7-15`。
- **触发条件**：高并发同秒下单（或脚本连续下单）。
- **实际现象 / 预期**：订单号 = `FS`+`yyyyMMddHHmmss`+4 位随机；同秒仅 10000 种组合，无查库去重、无重试。
- **根本原因**：第 13-14 行直接拼接返回，未校验 `orders.order_no` 唯一性。
- **实测证据**：模拟"同秒生成 200 个" → 去重后仅 199 个，碰撞 1 次（约 0.5%）。
- **修复方案**：生成后 `SELECT 1 FROM orders WHERE order_no=?` 校验冲突则重试（≤3 次），或随机位扩到 6 位。

---

## 低（Low）

### B9 ｜ `.env.example` 遗漏 `STATIC_DIR`，与实际配置不一致
- **位置**：`server/.env.example`（全文 14 行）对照 `config.js:44`。
- **触发条件**：阅读示例了解可配置项。
- **根本原因**：`STATIC_DIR` 是后续迁移静态资源目录时新增的，`config.js` 支持但示例未同步。
- **修复方案**：补充 `# 后端静态资源目录（默认 server/static）` + `# STATIC_DIR=./static`。

### B10 ｜ `upload-test.js` 上传目录指向已废弃路径，断言不可靠
- **位置**：`server/scripts/upload-test.js:17`。
- **触发条件**：执行 `npm run test:upload`。
- **实际现象 / 预期**：当前 13/13 通过，但清理逻辑指向 `web/assets/images/uploads`，实际写入 `server/static/uploads` → 断言作用在空目录上，**看似通过实则未验证真实落盘**。
- **修复方案**：改为读取 `config.staticDir` 拼接 `uploads`。

### B11 ｜ `makeTransaction` 注释承诺嵌套事务保护，但实现缺失
- **位置**：`server/src/db/driver.js:47-61`。
- **触发条件**：在 `db.transaction()` 回调内再次调用 `db.transaction()`。
- **实际现象 / 预期**：连续两次 `BEGIN` → SQLite 抛 `cannot start a transaction within a transaction`；注释称"用计数器做简单保护"但未实现。
- **修复方案**：删误导注释改为"不支持嵌套事务"；或补上真正的计数器 + `SAVEPOINT`。

### B12 ｜ `auditLog` 中间件已导出但从未挂载（死代码）
- **位置**：`server/src/middleware/auth.js:66-76`（定义）、`:78`（导出）。
- **触发条件**：全项目 grep `auditLog` 仅命中定义与导出。
- **根本原因**：审计日志改由各 controller 内直接调 `logOperation()` 实现，该中间件属早期设计遗留。
- **修复方案**：**建议保留**并补注释说明"预留能力，当前由 controller 内 `logOperation` 承担"——答辩被问到审计实现时反而可讲；贸然删除减少技术点。

### B13 ｜ 同订单内多商品无法分别评价（与表结构设计意图冲突）
- **位置**：`server/src/controllers/review.controller.js:24-25`。
- **触发条件**：一个订单含多种花 → 提交评价 → 再次提交其他商品评价。
- **实际现象 / 预期**：第二次被拒"该订单已评价"；但表 `reviews` 约束是 `UNIQUE(order_id, flower_id)`（按"订单+商品"唯一），设计意图为允许每商品各评一次。
- **根本原因**：第 24 行用 `COUNT(*) WHERE order_id=?`（只看订单）判重。当前前端 `orders.js:100-110` 一次性提交订单内全部商品，路径下不报错；若前端改"逐个评价"立即误报。
- **修复方案**：改为按 `order_id + flower_id` 逐项判重（插入前已有 `orderItems.find` 做归属校验，补唯一性判断即可）。可选优化，不改不影响演示。

### B14（本次新发现）｜ `user.controller.js` 用 `hash.split('$')[4]` 取盐，取到的是 `p` 参数
- **位置**：`server/src/controllers/user.controller.js:59` 与 `:84`，均写 `hash.split('$')[4]`。
- **触发条件**：管理员"新增用户"或"重置密码"。
- **实际现象 / 预期**：格式为 `scrypt$N$r$p$salt$hash`，`split('$')` 后盐在**索引 5**，`[4]` 取到的是 `p` 参数（`'1'`）；`users.salt` 列被写入错误值。
- **根本原因**：索引写错。
- **影响评估**：经核查，`salt` 列**不参与登录校验**——`verifyPassword` 直接解析完整的 `password_hash` 字符串（`auth.controller.js:52`/`96`），`safeUser` 也剥离 `salt` 不外传。因此**当前登录功能不受影响**，但该列存错值属潜在隐患（日后若重构依赖 `salt` 列会出错）。
- **修复方案**：改为 `hash.split('$')[5]`；或直接不再单独存 `salt` 列（因 `password_hash` 已含全部信息）。

---

## 修复优先级建议

| 优先级 | 条目 | 理由 |
| --- | --- | --- |
| **P0 立即修** | B1 | 1 个词改动，消除必崩接口 |
| **P0 立即修** | B2 + B3 | 2~3 行改动，修正核心数据一致性，影响多个后台图表 |
| **P1 建议修** | B4、B5 | 改动极小，消除明确安全漏洞，答辩可讲 |
| **P1 建议修** | B7 | 影响前台展示评分准确性，集中在单文件 |
| **P2 可选** | B6、B8、B9、B14 | 安全加固 / 数据健壮性 / 文档一致性，收益中等 |
| **P3 记录即可** | B10、B11、B12、B13、B5a | 本地演示无实际影响；B12 可作答辩技术点 |

---

## 前端说明
上一轮（Request 4）已修复管理端"打不开"的前端缺陷（`api.js` 的超时/异常/401 重定向、`dashboard.js` 空 catch）。本次未对前端 JS 做逐文件重审；若需要，我可单独再做一轮前端（含 `web/assets/js`、`web/admin/js`）的全面审查，重点查前后端字段契约与未捕获异常。
