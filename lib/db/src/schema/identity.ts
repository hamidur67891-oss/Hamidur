import {
  boolean,
  check,
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
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["customer", "seller", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
  "suspended",
]);
export const shopStatusEnum = pgEnum("shop_status", [
  "pending",
  "approved",
  "rejected",
  "suspended",
]);

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    phone: varchar("phone", { length: 16 }),
    pinCode: varchar("pin_code", { length: 6 }),
    role: userRoleEnum("role").notNull().default("customer"),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("users_role_idx").on(table.role),
    index("users_status_idx").on(table.status),
    check("users_pin_code_six_digits", sql`${table.pinCode} IS NULL OR ${table.pinCode} ~ '^[0-9]{6}$'`),
  ],
);

export const categoriesTable = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull().unique(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("categories_active_idx").on(table.active)],
);

export const pincodesTable = pgTable(
  "pincodes",
  {
    id: serial("id").primaryKey(),
    pinCode: varchar("pin_code", { length: 6 }).notNull().unique(),
    areaName: varchar("area_name", { length: 120 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pincodes_active_idx").on(table.active),
    check("pincodes_pin_code_six_digits", sql`${table.pinCode} ~ '^[0-9]{6}$'`),
  ],
);

export const shopApplicationsTable = pgTable(
  "shop_applications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    ownerName: varchar("owner_name", { length: 120 }).notNull(),
    categoryId: integer("category_id").references(() => categoriesTable.id, {
      onDelete: "set null",
    }),
    categoryName: varchar("category_name", { length: 80 }).notNull(),
    address: varchar("address", { length: 500 }).notNull(),
    pinCode: varchar("pin_code", { length: 6 })
      .notNull()
      .references(() => pincodesTable.pinCode),
    contactPhone: varchar("contact_phone", { length: 16 }).notNull(),
    whatsappNumber: varchar("whatsapp_number", { length: 16 }).notNull(),
    status: applicationStatusEnum("status").notNull().default("pending"),
    rejectionReason: varchar("rejection_reason", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("shop_applications_user_idx").on(table.userId),
    index("shop_applications_status_created_idx").on(table.status, table.createdAt),
    uniqueIndex("shop_applications_one_pending_per_user")
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
    check(
      "shop_applications_pin_code_six_digits",
      sql`${table.pinCode} ~ '^[0-9]{6}$'`,
    ),
  ],
);

export const shopsTable = pgTable(
  "shops",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    applicationId: integer("application_id")
      .notNull()
      .unique()
      .references(() => shopApplicationsTable.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    ownerName: varchar("owner_name", { length: 120 }).notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "restrict" }),
    description: varchar("description", { length: 2000 }),
    address: varchar("address", { length: 500 }).notNull(),
    pinCode: varchar("pin_code", { length: 6 })
      .notNull()
      .references(() => pincodesTable.pinCode),
    pinCodeVerified: boolean("pin_code_verified").notNull().default(false),
    contactPhone: varchar("contact_phone", { length: 16 }).notNull(),
    whatsappNumber: varchar("whatsapp_number", { length: 16 }).notNull(),
    imageUrl: varchar("image_url", { length: 500 }),
    status: shopStatusEnum("status").notNull().default("pending"),
    rejectionReason: varchar("rejection_reason", { length: 1000 }),
    profileViews: integer("profile_views").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("shops_pin_status_verified_idx").on(
      table.pinCode,
      table.status,
      table.pinCodeVerified,
    ),
    index("shops_category_idx").on(table.categoryId),
    index("shops_owner_idx").on(table.ownerId),
  ],
);

export type User = typeof usersTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type Pincode = typeof pincodesTable.$inferSelect;
export type ShopApplication = typeof shopApplicationsTable.$inferSelect;
export type Shop = typeof shopsTable.$inferSelect;
