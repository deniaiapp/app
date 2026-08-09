import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const affiliateProfile = pgTable(
  "affiliate_profile",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    rewardPreference: text("reward_preference").notNull().default("reset_credits"),
    resetCredits: integer("reset_credits").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("affiliate_profile_user_id_idx").on(table.userId),
    uniqueIndex("affiliate_profile_code_idx").on(table.code),
  ],
);

export const affiliateReferral = pgTable(
  "affiliate_referral",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    referrerId: text("referrer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referredUserId: text("referred_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    registeredAt: timestamp("registered_at").defaultNow().notNull(),
    purchaseDeadlineAt: timestamp("purchase_deadline_at").notNull(),
    purchasePlanId: text("purchase_plan_id"),
    purchaseAt: timestamp("purchase_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("affiliate_referral_referred_user_id_idx").on(table.referredUserId),
    index("affiliate_referral_referrer_id_idx").on(table.referrerId),
    index("affiliate_referral_code_idx").on(table.code),
  ],
);

export const affiliateReward = pgTable(
  "affiliate_reward",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    referrerId: text("referrer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referralId: text("referral_id").references(() => affiliateReferral.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    quantity: integer("quantity").notNull().default(1),
    milestone: integer("milestone").notNull().default(0),
    status: text("status").notNull().default("pending"),
    planId: text("plan_id"),
    couponCode: text("coupon_code"),
    note: text("note"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at"),
    sentBy: text("sent_by"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("affiliate_reward_referrer_type_referral_idx").on(
      table.referrerId,
      table.type,
      table.referralId,
    ),
    uniqueIndex("affiliate_reward_registration_milestone_idx")
      .on(table.referrerId, table.milestone)
      .where(sql`${table.type} = 'registration_reset'`),
    index("affiliate_reward_status_idx").on(table.status),
    index("affiliate_reward_referral_id_idx").on(table.referralId),
  ],
);
