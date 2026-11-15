# aliexpress-scraper-plus

轻量、健壮的 AliExpress 商品数据抓取工具，支持 CLI 和模块调用，内置重试、批量抓取与结构化错误处理。

A lightweight, robust AliExpress product scraper with CLI and module API, featuring retry, batch scraping, and structured error handling.

---

## 功能 / Features

- 🔗 **商品 ID / URL 输入** — 支持纯数字 ID 或完整 AliExpress URL，自动提取商品 ID
- 📦 **全面数据提取** — 标题、分类、图片、描述、规格、价格（原价/促销价/区间）、SKU 变体、库存、评分、评论、店铺信息、物流信息、货币
- 🔄 **请求重试与指数退避** — 网络失败自动重试（默认 3 次），间隔指数递增 + 随机抖动
- ⏱ **可配置超时** — 请求超时可配置（默认 30s）
- 🕵️ **可配置 User-Agent** — 支持自定义 UA 头，内置合理默认值
- ⚠️ **结构化错误类型** — `NetworkError`、`ParseError`、`ProductNotFoundError`、`TimeoutError`，均包含 `code`/`message`/`productId` 等字段
- 📋 **批量抓取** — 传入 ID/URL 数组，并发抓取，返回含各自状态的结果数组
- 📐 **标准化输出** — JSON 字段统一 camelCase，价格统一为 `{ currency, amount, formatted }` 结构
- 💻 **CLI 工具** — `npx aliexpress-scraper-plus <id>...` 直接命令行使用
- 🔌 **双模式** — 同时支持 CLI 执行和 `import` 模块调用

---

- 🔗 **Product ID / URL input** — Accepts numeric IDs or full AliExpress URLs, auto-extracts product ID
- 📦 **Comprehensive data extraction** — Title, category, images, description, specs, pricing (original/sale/range), SKU variants, stock, ratings, reviews, store info, shipping, currency
- 🔄 **Retry with exponential backoff** — Auto-retry on network failure (default 3 attempts) with jittered exponential delays
- ⏱ **Configurable timeout** — Request timeout is configurable (default 30s)
- 🕵️ **Configurable User-Agent** — Custom UA header support with sensible defaults
- ⚠️ **Structured error types** — `NetworkError`, `ParseError`, `ProductNotFoundError`, `TimeoutError` with `code`/`message`/`productId` fields
- 📋 **Batch scraping** — Pass an array of IDs/URLs for concurrent scraping with per-item status
- 📐 **Standardized output** — camelCase JSON fields, prices as `{ currency, amount, formatted }`
- 💻 **CLI tool** — Use directly from command line with `npx aliexpress-scraper-plus <id>...`
- 🔌 **Dual mode** — Works as both CLI tool and importable module

## 快速开始 / Quick Start

### 环境要求 / Prerequisites

- Node.js >= 18

### 安装 / Installation

```bash
git clone https://github.com/Fan-Fan-F/aliexpress-scraper-plus.git
cd aliexpress-scraper-plus
npm install
```

### CLI 使用 / CLI Usage

```bash
# 抓取单个商品 / Scrape a single product
node src/cli.js 1005007429636284

# 使用完整 URL / Use full URL
node src/cli.js https://www.aliexpress.com/item/1005007429636284.html --pretty

# 批量抓取 / Batch scrape
node src/cli.js 1005001 1005002 1005003 --concurrency 2

# 查看帮助 / Show help
node src/cli.js --help
```

**CLI 选项 / CLI Options：**

| 选项 / Option | 说明 / Description | 默认 / Default |
|---|---|---|
| `--retries <n>` | 最大重试次数 / Max retries | 3 |
| `--timeout <ms>` | 请求超时（毫秒）/ Timeout in ms | 30000 |
| `--user-agent <ua>` | 自定义 UA / Custom User-Agent | 内置 Chrome UA |
| `--concurrency <n>` | 并发数 / Concurrent requests | 3 |
| `--pretty` | 美化 JSON 输出 / Pretty-print JSON | false |

### 模块调用 / Module API

```javascript
import { scrapeProduct, scrapeProducts } from 'aliexpress-scraper-plus';

// 抓取单个商品 / Scrape one product
const product = await scrapeProduct('1005007429636284', {
  maxRetries: 3,
  timeoutMs: 30000,
});

// 批量抓取 / Batch scrape
const results = await scrapeProducts(
  ['1005001', '1005002', 'https://aliexpress.com/item/1005003.html'],
  { concurrency: 2 }
);
// results: [{ status: 'ok', productId, data }, { status: 'error', productId, error }, ...]
```

### 错误处理 / Error Handling

```javascript
import { scrapeProduct, NetworkError, ProductNotFoundError } from 'aliexpress-scraper-plus';

try {
  const data = await scrapeProduct('invalid-id');
} catch (err) {
  console.log(err.code);    // 'PARSE_ERROR' | 'NETWORK_ERROR' | 'PRODUCT_NOT_FOUND' | 'TIMEOUT'
  console.log(err.toJSON()); // { error: true, name, code, message, productId, ... }
}
```

## 来源与致谢 / Credits

本项目的思路与功能设计受到 [aliexpress-product-scraper](https://github.com/sudheer-ranga/aliexpress-product-scraper) 启发，代码为独立实现。

The design and feature set of this project were inspired by [aliexpress-product-scraper](https://github.com/sudheer-ranga/aliexpress-product-scraper). The code is an independent implementation.

## 许可证 / License

本项目沿用 MIT 许可证，全文见根目录 [LICENSE](./LICENSE)。

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for the full text.
