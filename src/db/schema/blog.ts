import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const blogPostStatusEnum = pgEnum("blog_post_status", ["draft", "published"]);

export const blogPost = pgTable(
  "blog_post",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").notNull(),
    status: blogPostStatusEnum("status").default("draft").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    body: text("body").notNull().default(""),
    titleJa: text("title_ja").notNull().default(""),
    descriptionJa: text("description_ja").notNull().default(""),
    bodyJa: text("body_ja").notNull().default(""),
    author: text("author").notNull().default("Deni AI team"),
    publishedAt: timestamp("published_at"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("blog_post_slug_idx").on(table.slug),
    index("blog_post_status_published_at_idx").on(table.status, table.publishedAt),
  ],
);
