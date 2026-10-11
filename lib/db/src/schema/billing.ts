import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { shopsTable } from "./identity";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "pending",
  "active",
  "expired",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "verified",
  "failed",
]);

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    shopId: integer("shop_id")
      .notNull()
      .references(() => shopsTable.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull().default("pending"),
    amountInrPaise: integer("amount_inr_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    renewalReminderSentAt: timestamp("renewal_reminder_sent_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("subscriptions_shop_created_idx").on(table.shopId, table.createdAt),
    index("subscriptions_expiry_idx").on(table.status, table.expiresAt),
    uniqueIndex("subscriptions_one_active_per_shop")
      .on(table.shopId)
      .where(sql`${table.status} = 'active'`),
    check(
      "subscriptions_amount_nonnegative",
      sql`${table.amountInrPaise} >= 0`,
    ),
  ],
);

export const paymentsTable = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: "cascade" }),
    amountInrPaise: integer("amount_inr_paise").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    provider: text("provider").notNull(),
    reference: text("reference"),
    providerEventId: text("provider_event_id").unique(),
    testTokenHash: text("test_token_hash"),
    testTokenExpiresAt: timestamp("test_token_expires_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (table) => [
    index("payments_subscription_date_idx").on(
      table.subscriptionId,
      table.createdAt,
    ),
    index("payments_status_date_idx").on(table.status, table.createdAt),
    check("payments_amount_nonnegative", sql`${table.amountInrPaise} >= 0`),
  ],
);

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
