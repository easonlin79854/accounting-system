# Cloudflare Accounting System (MVP Skeleton)

Monorepo 單人多幣別記帳系統骨架，包含：

- `apps/web`: React + Vite + Tailwind (amber/yellow theme)
- `apps/api`: Cloudflare Worker + Hono REST API (`/api/*`)
- `packages/shared`: 共用型別與 Zod schema
- `apps/api/migrations`: Cloudflare D1 migrations

## MVP 功能

- 交易 CRUD（date/type/amount/currency/merchant/note）
- tags（多個）管理與交易關聯
- attachments（多個）metadata（D1）+ 檔案（R2）
- 月彙總報表（依幣別顯示 income/expense）
- 附件白名單：jpg/png/webp/heic/pdf，預設 10MB

## 專案結構

```txt
apps/
  api/
    src/index.ts
    migrations/0001_init.sql
    wrangler.toml
  web/
    src/
packages/
  shared/
pnpm-workspace.yaml
```

## 本機開發

### 1) 安裝依賴

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install
```

可依需要先複製環境範例：

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

### 2) 啟動前端（Vite）

```bash
pnpm dev:web
```

預設：<http://localhost:5173>

### 3) 啟動 API（Wrangler dev）

```bash
pnpm dev:api
```

預設：<http://localhost:8787>

### 4) 建立/套用 D1 migration

```bash
cd apps/api
wrangler d1 migrations apply accounting-db --local
```

部署環境請改成你的 D1 database name 並移除 `--local`。

## API 端點（MVP）

- `GET /api/transactions?month=YYYY-MM&currency=TWD`
- `POST /api/transactions`
- `GET /api/transactions/:id`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `GET /api/tags`
- `POST /api/tags`
- `GET /api/reports/monthly?month=YYYY-MM`
- `POST /api/transactions/:id/attachments`（multipart/form-data, `file`）
- `GET /api/attachments/:id/download`

## Cloudflare 部署（高層）

1. 建立 D1 database（例如 `accounting-db`）
2. 建立 R2 bucket（例如 `accounting-attachments`）
3. 在 `apps/api/wrangler.toml` 填入正確 `database_id` 與 bucket 名稱
4. 部署 Worker：
   ```bash
   cd apps/api
   wrangler deploy
   ```
5. 部署前端到 Cloudflare Pages（連接此 repo，build command: `pnpm --filter @accounting/web build`，output: `apps/web/dist`）
6. 建議讓 Pages 與 Worker 使用同網域 `/api` route（避免 CORS）
   - 例如為 Worker 設定 route：`your-domain.com/api/*`
   - 前端 `VITE_API_BASE_URL=/api`

若 API 必須獨立子網域，可在 web 設 `VITE_API_BASE_URL=https://api.your-domain.com/api`，或用 Pages Functions 做簡單代理。

## 建議 PR 標題

`chore: bootstrap Cloudflare accounting system (web + worker + D1 + R2)`

## PR 內容應包含

- 功能摘要
- 本機啟動方式
- Cloudflare 部署步驟
