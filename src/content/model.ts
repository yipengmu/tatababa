export type TopicId = "career" | "parenting" | "life";
export type EntryKind = "series" | "article" | "product" | "game" | "topic";
export type EntryStatus = "published" | "comingSoon" | "draft";

export interface ProfileContent {
  brand: string;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  intro: string;
  identityTags: string[];
}

export interface TopicContent {
  id: TopicId;
  number: string;
  shortTitle: string;
  title: string;
  description: string;
  note: string;
  accent: string;
  detailTitle: string;
  detailIntro: string;
  principle: string;
}

export interface ContentEntry {
  id: string;
  topicId: TopicId;
  kind: EntryKind;
  eyebrow: string;
  title: string;
  summary: string;
  href: string;
  cover: string;
  actionLabel: string;
  tags: string[];
  status: EntryStatus;
  featured: boolean;
  order: number;
}

export interface SocialChannel {
  id: "video" | "wechat";
  platform: string;
  title: string;
  handle: string;
  description: string;
  qrImage: string;
  href: string;
}

export interface SiteSettings {
  contactEmail: string;
  footerLine: string;
  showAdminLink: boolean;
}

export interface SiteContent {
  profile: ProfileContent;
  topics: TopicContent[];
  entries: ContentEntry[];
  channels: SocialChannel[];
  settings: SiteSettings;
  updatedAt: string;
}
