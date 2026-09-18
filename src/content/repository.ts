import { promises as fs } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import type { SiteContent } from "./model.js";
import { siteContentSchema } from "./schema.js";
import { defaultContent } from "./default-content.js";

const contentFile = process.env.CONTENT_FILE || path.join(process.cwd(), "data", "site-content.json");

async function loadLocalContent(): Promise<SiteContent> {
  try {
    const raw = await fs.readFile(contentFile, "utf8");
    return siteContentSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return structuredClone(defaultContent);
    }
    throw error;
  }
}

async function saveLocalContent(content: SiteContent): Promise<void> {
  await fs.mkdir(path.dirname(contentFile), { recursive: true });
  const temporaryFile = `${contentFile}.${process.pid}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  await fs.rename(temporaryFile, contentFile);
}

function databaseClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  return neon(databaseUrl);
}

async function loadDatabaseContent(): Promise<SiteContent | null> {
  const sql = databaseClient();
  if (!sql) return null;
  const rows = await sql`SELECT content FROM site_content WHERE id = 'main' LIMIT 1`;
  const row = rows[0] as { content?: unknown } | undefined;
  if (!row?.content) return structuredClone(defaultContent);
  return siteContentSchema.parse(row.content);
}

async function saveDatabaseContent(content: SiteContent): Promise<void> {
  const sql = databaseClient();
  if (!sql) throw new Error("DATABASE_URL is not configured");
  const payload = JSON.stringify(content);
  await sql`
    INSERT INTO site_content (id, content, updated_at)
    VALUES ('main', ${payload}::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
  `;
}

export async function getSiteContent(): Promise<SiteContent> {
  if (process.env.DATABASE_URL) {
    return (await loadDatabaseContent()) ?? structuredClone(defaultContent);
  }
  return loadLocalContent();
}

export async function saveSiteContent(input: unknown): Promise<SiteContent> {
  const content = siteContentSchema.parse({
    ...(input as Record<string, unknown>),
    updatedAt: new Date().toISOString()
  });

  if (process.env.DATABASE_URL) {
    await saveDatabaseContent(content);
    return content;
  }

  if (process.env.VERCEL) {
    throw new Error("生产环境尚未配置 DATABASE_URL，内容保存已被安全阻止。 ");
  }

  await saveLocalContent(content);
  return content;
}
