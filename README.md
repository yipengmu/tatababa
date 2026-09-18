# 塔塔爸爸.ai

人物认知优先的个人主页与轻量内容后台。前台围绕“AI 时代的牛马职场、育儿教育、生活智慧”三个并列专题展开，后台供站点所有者维护人物文案、专题、文章、产品、游戏和二维码入口。

## 技术栈

- Node.js 20+
- Express 5 + EJS + TypeScript
- 原生 CSS / JavaScript
- 本地 JSON 文件存储
- Neon PostgreSQL 生产存储
- Vercel Express Runtime / Fluid Compute

## 本地运行

```bash
npm install
npm run dev
```

- 公开主页：<http://localhost:3000>
- 内容后台：<http://localhost:3000/admin>
- 本地开发账号：`admin`
- 本地开发密码：`tatababa-local`

本地后台保存后，内容会写入 `data/site-content.json`。

## 常用脚本

```bash
npm run typecheck
npm test
npm run build
npm run auth:hash -- '至少十二位的新密码'
DATABASE_URL='postgresql://...' npm run db:init
```

## Vercel 生产配置

Vercel 会自动识别 `src/index.ts` 中导出的 Express 应用。`public/**` 由 Vercel CDN 提供，Express 负责页面渲染、登录和内容 API。

生产环境必须配置：

```text
ADMIN_USERNAME
ADMIN_PASSWORD_HASH
AUTH_SECRET
DATABASE_URL
PUBLIC_SITE_URL
```

推荐通过 Vercel Marketplace 安装 Neon。配置好 `DATABASE_URL` 后运行一次 `npm run db:init` 建表并写入初始内容。没有数据库时，Vercel 上的公开页面仍能读取随代码发布的内容，但后台保存会被明确拒绝，避免产生“看似成功、实际丢失”的修改。

部署说明参考：

- <https://vercel.com/docs/frameworks/backend/express>
- <https://vercel.com/docs/storage>
- <https://vercel.com/docs/project-configuration/vercel-json>

## 内容和素材

- 内容数据：`data/site-content.json`
- 视频号二维码：`public/assets/video-channel-qr.jpg`
- 公众号二维码：`public/assets/wechat-official-qr.jpg`
- 原始公众号专题截图：`public/assets/wechat-topics.jpg`
- 社交分享图：`public/og.png`
- 产品方案：`docs/personal-homepage-spec.md`
- 视觉参考：`docs/design-references.md`

正式上线前需要把“技术转 PD”“产品经理”“程序员转型”、家谱产品、口播 App 和孩子游戏的真实链接补进后台。
