# aliexpress-scraper-plus — 功能规格

## 路线

B（按思路重写）：只借鉴原项目 aliexpress-product-scraper 的 README 所描述的功能行为，代码全部独立编写。

## 借鉴的功能点（来自原项目）

1. **商品 ID/URL 输入** — 接受 AliExpress 商品 ID（纯数字）或完整 URL，自动提取 ID
2. **商品基本信息** — 抓取标题、分类 ID、商品 ID、库存数量
3. **价格信息** — 原价与促销价（含货币、格式化金额、数值），支持价格区间（min/max）
4. **商品图片** — 主图列表
5. **商品描述** — HTML 格式描述内容
6. **商品规格** — 属性名-属性值列表（Brand Name, Type 等）
7. **SKU 变体** — 选项维度（颜色、尺寸等）及各 SKU 的价格与库存
8. **评价信息** — 评分统计（总星数、平均分、各星级计数）
9. **买家评论** — 评论列表（用户名、国家、评分、内容、图片等）
10. **店铺信息** — 店名、Logo、店铺编号、评分
11. **物流信息** — 配送商、时效、费用、发货地/目的地
12. **货币信息** — 当前货币代码

## 新增的健壮性功能点

13. **请求重试与指数退避** — 网络失败自动重试（默认 3 次），间隔指数递增 + 随机抖动
14. **可配置超时** — 整体请求超时可配置（默认 30s）
15. **可配置 User-Agent** — 支持自定义 UA 头，内置合理默认值
16. **结构化错误类型** — 自定义错误类（NetworkError, ParseError, ProductNotFoundError），包含 code/message/productId 等字段，不抛原始堆栈
17. **批量输入** — 支持传入 ID/URL 数组，并发抓取多个商品，返回结果数组（含各自状态）
18. **字段标准化输出** — JSON 输出字段命名统一为 camelCase，价格统一为 `{ currency, amount, formatted }` 结构
19. **CLI 工具** — 可作为命令行工具使用（`npx aliexpress-scraper-plus <id>...`）
20. **双模式** — 同时支持 CLI 执行和 `import` 模块调用

## 技术选型

- 运行时：Node.js >= 18
- HTTP 请求：undici / 内置 fetch（不依赖 Puppeteer，轻量化）
- HTML 解析：cheerio
- CLI：内置 argument 解析，无重型框架依赖
- 模块格式：ESM（type: "module"）

## 自测记录

- **日期**：2026-11-15
- **命令**：`npm test`（实际执行 `node --test test/scraper.test.js`）
- **环境**：Node.js v24.22.1, cheerio ^1.0.0
- **第 1 轮**：15 pass / 14 fail。原因：fixture HTML 中 `window.runParams` 使用了 JS 对象字面量语法（键名无引号），`JSON.parse` 无法解析，parser 回退到 meta-tag 路径导致大部分字段为 null。修复：将 fixture 的嵌入数据改为合法 JSON 格式（与真实 AliExpress 页面一致）。同时修正 package.json 的 test 脚本指向具体文件。
- **第 2 轮**：29 pass / 0 fail，全部通过。覆盖 URL/ID 提取（6 项）、完整页面解析（15 项）、meta 降级解析（3 项）、商品不存在（1 项）、错误类序列化（4 项）。
