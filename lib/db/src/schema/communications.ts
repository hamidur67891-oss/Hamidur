import { isNull, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import {
  shopsTable,
  usersTable,
} from "./identity";
import { productsTable } from "./catalog";

export const complaintStatusEnum = pgEnum("complaint_status", [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
]);

export const conversationsTable = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    shopId: integer("shop_id")
      .notNull()
      .references(() => shopsTable.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => productsTable.id, {
      onDelete: "set null",
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
    index("conversations_shop_idx").on(table.shopId, table.updatedAt),
    index("conversations_customer_idx").on(table.customerId, table.updatedAt),
    index("conversations_product_idx").on(table.productId),
    uniqueIndex("conversations_unique_general_shop_customer")
      .on(table.shopId, table.customerId)
      .where(isNull(table.productId)),
    uniqueIndex("conversations_unique_product_shop_customer")
      .on(table.shopId, table.customerId, table.productId)
      .where(sql`${table.productId} is not null`),
  ],
);

export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    senderId: integer("sender_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    body: varchar("body", { length: 2000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("messages_conversation_date_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("messages_unread_idx").on(table.conversationId, table.readAt),
  ],
);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    body: varchar("body", { length: 2000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("notifications_user_date_idx").on(table.userId, table.createdAt),
    index("notifications_unread_idx").on(table.userId, table.readAt),
  ],
);

export const complaintsTable = pgTable(
  "complaints",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    shopId: integer("shop_id").references(() => shopsTable.id, {
      onDelete: "set null",
    }),
    productId: integer("product_id").references(() => productsTable.id, {
      onDelete: "set null",
    }),
    subject: varchar("subject", { length: 160 }).notNull(),
    details: text("details").notNull(),
    status: complaintStatusEnum("status").notNull().default("open"),
    adminNote: varchar("admin_note", { length: 2000 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("complaints_status_date_idx").on(table.status, table.createdAt),
    index("complaints_user_idx").on(table.userId),
  ],
);

export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type Complaint = typeof complaintsTable.$inferSelect;
