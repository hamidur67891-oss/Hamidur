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
import { categoriesTable, shopsTable, usersTable } from "./identity";

export const moderationStatusEnum = pgEnum("product_moderation_status", [
  "visible",
  "hidden",
]);

export const productsTable = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    shopId: integer("shop_id")
      .notNull()
      .references(() => shopsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "restrict" }),
    description: varchar("description", { length: 2000 }),
    pricePaise: integer("price_paise").notNull(),
    available: boolean("available").notNull().default(true),
    imageUrl: varchar("image_url", { length: 500 }),
    isFeatured: boolean("is_featured").notNull().default(false),
    moderationStatus: moderationStatusEnum("moderation_status")
      .notNull()
      .default("visible"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("products_shop_idx").on(table.shopId),
    index("products_category_idx").on(table.categoryId),
    index("products_moderation_available_idx").on(
      table.moderationStatus,
      table.available,
    ),
    check("products_price_nonnegative", sql`${table.pricePaise} >= 0`),
  ],
);

export const productImagesTable = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    objectPath: text("object_path").notNull(),
    altText: varchar("alt_text", { length: 300 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("product_images_product_idx").on(table.productId, table.sortOrder),
    uniqueIndex("product_images_product_object_unique").on(
      table.productId,
      table.objectPath,
    ),
  ],
);

export const productViewsTable = pgTable(
  "product_views",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    viewerId: integer("viewer_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("product_views_product_date_idx").on(table.productId, table.viewedAt),
  ],
);

export type Product = typeof productsTable.$inferSelect;
export type ProductImage = typeof productImagesTable.$inferSelect;
