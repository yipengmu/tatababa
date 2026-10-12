import { z } from "zod";

const topicIdSchema = z.enum(["career", "parenting", "life"]);
const optionalUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") return true;
    if (!URL.canParse(value)) return false;
    return ["http:", "https:"].includes(new URL(value).protocol);
  }, "链接必须是 http 或 https 地址");

const profileSchema = z.object({
  brand: z.string().trim().min(1).max(60),
  eyebrow: z.string().trim().min(1).max(100),
  headline: z.string().trim().min(1).max(100),
  headlineAccent: z.string().trim().min(1).max(100),
  intro: z.string().trim().min(1).max(600),
  identityTags: z.array(z.string().trim().min(1).max(30)).max(8)
});

const topicSchema = z.object({
  id: topicIdSchema,
  number: z.string().trim().min(1).max(4),
  shortTitle: z.string().trim().min(1).max(30),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  note: z.string().trim().min(1).max(100),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  detailTitle: z.string().trim().min(1).max(180),
  detailIntro: z.string().trim().min(1).max(800),
  principle: z.string().trim().min(1).max(240)
});

const entrySchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]+$/).max(80),
  topicId: topicIdSchema,
  kind: z.enum(["series", "article", "product", "game", "topic"]),
  eyebrow: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(800),
  href: optionalUrlSchema,
  cover: z.string().trim().max(500),
  actionLabel: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  status: z.enum(["published", "comingSoon", "draft"]),
  featured: z.boolean(),
  order: z.number().int().min(0).max(9999)
});

const channelSchema = z.object({
  id: z.enum(["video", "wechat"]),
  platform: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(120),
  handle: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  qrImage: z.string().trim().min(1).max(500),
  href: optionalUrlSchema
});

export const siteContentSchema = z.object({
  profile: profileSchema,
  topics: z.array(topicSchema).length(3),
  entries: z.array(entrySchema).max(200),
  channels: z.array(channelSchema).length(2),
  settings: z.object({
    contactEmail: z.string().trim().refine((value) => value === "" || z.email().safeParse(value).success),
    footerLine: z.string().trim().min(1).max(160),
    showAdminLink: z.boolean()
  }),
  updatedAt: z.iso.datetime()
}).superRefine((content, context) => {
  const topicIds = content.topics.map((topic) => topic.id);
  if (new Set(topicIds).size !== topicIds.length || !["career", "parenting", "life"].every((id) => topicIds.includes(id as typeof topicIds[number]))) {
    context.addIssue({ code: "custom", path: ["topics"], message: "必须且只能包含三个不同的固定专题" });
  }
  const entryIds = content.entries.map((entry) => entry.id);
  if (new Set(entryIds).size !== entryIds.length) {
    context.addIssue({ code: "custom", path: ["entries"], message: "内容 ID 不能重复" });
  }
});
