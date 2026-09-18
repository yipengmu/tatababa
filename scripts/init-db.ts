import { neon } from "@neondatabase/serverless";
import { defaultContent } from "../src/content/default-content.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("缺少 DATABASE_URL。请先配置 Neon PostgreSQL 连接字符串。");
  process.exitCode = 1;
} else {
  const sql = neon(databaseUrl);
  await sql`
    CREATE TABLE IF NOT EXISTS site_content (
      id TEXT PRIMARY KEY,
      content JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  const payload = JSON.stringify(defaultContent);
  await sql`
    INSERT INTO site_content (id, content)
    VALUES ('main', ${payload}::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
  console.log("site_content 表已就绪。");
}
