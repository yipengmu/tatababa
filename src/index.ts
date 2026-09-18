import path from "node:path";
import cookieParser from "cookie-parser";
import ejs from "ejs";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import {
  clearAdminSession,
  getAdminSession,
  hasValidCsrf,
  isAuthConfigured,
  setAdminSession,
  usesLocalDevelopmentCredentials,
  verifyAdminCredentials
} from "./auth.js";
import { getSiteContent } from "./content/repository.js";
import { saveSiteContent } from "./content/repository.js";

const app = express();
const projectRoot = process.cwd();
const port = Number(process.env.PORT ?? 3000);
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function trustedPublicOrigin(): string {
  if (process.env.PUBLIC_SITE_URL && URL.canParse(process.env.PUBLIC_SITE_URL)) {
    const configured = new URL(process.env.PUBLIC_SITE_URL);
    if (["http:", "https:"].includes(configured.protocol)) return configured.origin;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${port}`;
}

app.engine("ejs", ejs.renderFile);
app.set("view engine", "ejs");
app.set("views", path.join(projectRoot, "views"));
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:", "https:"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "connect-src": ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Vercel serves public/** from its CDN. This middleware keeps local development identical.
app.use(express.static(path.join(projectRoot, "public"), { maxAge: "1h", etag: true }));

app.get("/", async (_request, response) => {
  const content = await getSiteContent();
  response.render("home", {
    content,
    pageTitle: "塔塔爸爸.ai｜AI 时代的工作、育儿与生活实践",
    pageDescription:
      "一个技术人、产品实践者和父亲，分享 AI 时代的职场转型、育儿共创、生活思考与独立作品。",
    canonicalUrl: trustedPublicOrigin(),
    socialImageUrl: `${trustedPublicOrigin()}/og.png`
  });
});

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "tatababa-homepage",
    storage: process.env.DATABASE_URL ? "postgres" : process.env.VERCEL ? "read-only-seed" : "local-file"
  });
});

app.get("/admin/login", (request, response) => {
  if (getAdminSession(request)) return response.redirect("/admin");
  return response.render("admin-login", {
    error: request.query.error === "1",
    authConfigured: isAuthConfigured(),
    localCredentials: usesLocalDevelopmentCredentials()
  });
});

app.post("/admin/login", (request, response) => {
  if (!isAuthConfigured()) {
    return response.status(503).render("admin-login", {
      error: false,
      authConfigured: false,
      localCredentials: false
    });
  }

  const username = typeof request.body.username === "string" ? request.body.username : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const requestKey = request.ip || request.socket.remoteAddress || "unknown";
  const now = Date.now();
  for (const [key, value] of loginAttempts) {
    if (value.resetAt <= now) loginAttempts.delete(key);
  }
  const attempt = loginAttempts.get(requestKey);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) {
    response.setHeader("Retry-After", String(Math.ceil((attempt.resetAt - now) / 1000)));
    return response.status(429).send("登录尝试过多，请 15 分钟后再试。 ");
  }
  if (!verifyAdminCredentials(username, password)) {
    const current = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + 15 * 60 * 1000 };
    current.count += 1;
    loginAttempts.set(requestKey, current);
    return response.redirect("/admin/login?error=1");
  }

  loginAttempts.delete(requestKey);

  const session = setAdminSession(response, request);
  if (!session) return response.status(503).send("后台登录尚未完成安全配置。");
  return response.redirect("/admin");
});

app.post("/admin/logout", (_request, response) => {
  clearAdminSession(response);
  response.redirect("/admin/login");
});

app.get("/admin", async (request, response) => {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
  const session = getAdminSession(request);
  if (!session) return response.redirect("/admin/login");
  const content = await getSiteContent();
  return response.render("admin", {
    csrfToken: session.csrf,
    updatedAt: content.updatedAt,
    storageMode: process.env.DATABASE_URL ? "Neon Postgres" : process.env.VERCEL ? "只读种子数据" : "本地文件"
  });
});

app.get("/api/admin/content", async (request, response) => {
  response.setHeader("Cache-Control", "private, no-store");
  if (!getAdminSession(request)) return response.status(401).json({ error: "请先登录。" });
  return response.json(await getSiteContent());
});

app.put("/api/admin/content", async (request, response) => {
  response.setHeader("Cache-Control", "private, no-store");
  const session = getAdminSession(request);
  if (!session) return response.status(401).json({ error: "登录状态已失效。" });
  if (!hasValidCsrf(request, session)) return response.status(403).json({ error: "安全校验失败，请刷新后台。" });

  try {
    const content = await saveSiteContent(request.body);
    return response.json({ ok: true, content });
  } catch (error) {
    if (error instanceof ZodError) {
      return response.status(400).json({
        error: "内容中有不符合要求的字段。",
        fields: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      });
    }
    throw error;
  }
});

app.use((_request, response) => {
  response.status(404).send("Not found");
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error(error);
  response.status(500).json({ error: "服务器暂时开小差了，请稍后再试。" });
});

if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`塔塔爸爸.ai running at http://localhost:${port}`);
  });
}

export default app;
