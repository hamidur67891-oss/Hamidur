import { and, eq, exists, gt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  categoriesTable,
  productsTable,
  pincodesTable,
  shopsTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import type { Shop } from "@workspace/db";
import { HttpError } from "./http";

export function visibleShopConditions(pinCode?: string) {
  const conditions = [
    eq(shopsTable.status, "approved"),
    eq(shopsTable.pinCodeVerified, true),
    exists(
      db
        .select({ one: sql`1` })
        .from(usersTable)
        .where(
          and(eq(usersTable.id, shopsTable.ownerId), eq(usersTable.status, "active")),
        ),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(pincodesTable)
        .where(
          and(
            eq(pincodesTable.pinCode, shopsTable.pinCode),
            eq(pincodesTable.active, true),
          ),
        ),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.shopId, shopsTable.id),
            eq(subscriptionsTable.status, "active"),
            gt(subscriptionsTable.expiresAt, new Date()),
          ),
        ),
    ),
  ];

  if (pinCode) conditions.push(eq(shopsTable.pinCode, pinCode));
  return and(...conditions);
}

export async function getPublicShop(shopId: number, pinCode?: string) {
  const [row] = await db
    .select({
      id: shopsTable.id,
      name: shopsTable.name,
      category: categoriesTable.name,
      description: shopsTable.description,
      address: shopsTable.address,
      pinCode: shopsTable.pinCode,
      ownerName: shopsTable.ownerName,
      whatsappNumber: shopsTable.whatsappNumber,
      imageUrl: shopsTable.imageUrl,
      isPremium: sql<boolean>`true`,
      productCount: sql<number>`(
        select count(*)::int
        from products
        where products.shop_id = ${shopsTable.id}
          and products.moderation_status = 'visible'
      )`,
    })
    .from(shopsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, shopsTable.categoryId))
    .where(and(eq(shopsTable.id, shopId), visibleShopConditions(pinCode)))
    .limit(1);

  return row ?? null;
}

export async function getSellerShop(ownerId: number) {
  const [shop] = await db
    .select()
    .from(shopsTable)
    .where(and(eq(shopsTable.ownerId, ownerId), eq(shopsTable.status, "approved")))
    .limit(1);
  return shop ?? null;
}

export async function requireSellerShop(ownerId: number): Promise<Shop> {
  const shop = await getSellerShop(ownerId);
  if (!shop) {
    throw new HttpError(403, "An approved shop is required to use seller tools.", "approved_shop_required");
  }
  if (!shop.pinCodeVerified) {
    throw new HttpError(403, "Your shop's service PIN is not verified.", "pincode_not_verified");
  }
  return shop;
}

export async function getActiveSubscription(shopId: number) {
  const now = new Date();
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.shopId, shopId),
        eq(subscriptionsTable.status, "active"),
        gt(subscriptionsTable.expiresAt, now),
      ),
    )
    .limit(1);
  return subscription ?? null;
}

export async function getActiveCategory(categoryName: string) {
  const nameOrSlug = categoryName.trim();
  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(
      and(
        eq(categoriesTable.active, true),
        sql`lower(${categoriesTable.name}) = lower(${nameOrSlug}) OR ${categoriesTable.slug} = ${nameOrSlug.toLowerCase()}`,
      ),
    )
    .limit(1);
  if (!category) {
    throw new HttpError(400, "Choose an active NearLoop category.", "unknown_category");
  }
  return category;
}

export async function shopRowToPublic(shop: Shop) {
  return getPublicShop(shop.id);
}
