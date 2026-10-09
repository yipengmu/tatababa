import rawContent from "../../data/site-content.json" with { type: "json" };
import type { SiteContent } from "./model.js";
import { siteContentSchema } from "./schema.js";

/**
 * The JSON file is the single source of truth for site content.
 * Keep this export as the typed, validated fallback used by the repository and
 * database initialization script.
 */
export const defaultContent: SiteContent = siteContentSchema.parse(rawContent);
