import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import {
  GetCatalogQueryParams,
  GetCatalogResponse,
  GetProductParams,
  GetProductResponse,
  GetShopParams,
  GetShopResponse,
  ListCategoriesResponse,
  SearchProductsQueryParams,
  SearchProductsResponse,
  SearchShopsQueryParams,
  SearchShopsResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  categoriesTable,
  productsTable,
  shopsTable,
} from "@workspace/db";
import { HttpError, cleanText, parseInput } from "../lib/http";
import { getPublicShop, visibleShopConditions } from "../lib/marketplace";

const router = Router();

const productFields = {
  id: productsTable.id,
  shopId: productsTable.shopId,
  shopName: shopsTable.name,
  name: productsTable.name,
  category: categoriesTable.name,
  description: productsTable.description,
  price: sql<number>`(${productsTable.pricePaise} / 100.0)::float8`,
  available: productsTable.available,
  imageUrl: productsTable.imageUrl,
  pinCode: shopsTable.pinCode,
  isFeatured: productsTable.isFeatured,
};

function searchPattern(q: string | undefined) {
  if (!q?.trim()) return undefined;
  const escaped = q.trim().replace(/[\\%_]/g, "\\$&");
  return `%${escaped}%`;
}

function categoryPredicate(category: string | undefined) {
  if (!category?.trim()) return undefined;
  return eq(categoriesTable.slug, category.trim().toLowerCase());
}

router.get("/catalog", async (req, res) => {
  const query = parseInput(GetCatalogQueryParams, req.query);
  const [categories] = await Promise.all([
    db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        active: categoriesTable.active,
      })
      .from(categoriesTable)
      .where(eq(categoriesTable.active, true))
      .orderBy(categoriesTable.name),
  ]);

  if (!query.pinCode) {
    res.json(
      GetCatalogResponse.parse({
        pinCode: null,
        categories,
        shops: [],
        products: [],
      }),
    );
    return;
  }

  const categoryFilter = categoryPredicate(query.category);
  const [shops, products] = await Promise.all([
    db
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
          select count(*)::int from products
          where products.shop_id = ${shopsTable.id}
            and products.moderation_status = 'visible'
        )`,
      })
      .from(shopsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, shopsTable.categoryId))
      .where(
        and(
          visibleShopConditions(query.pinCode),
          categoryFilter,
          eq(categoriesTable.active, true),
        ),
      )
      .orderBy(desc(shopsTable.createdAt))
      .limit(12),
    db
      .select(productFields)
      .from(productsTable)
      .innerJoin(shopsTable, eq(shopsTable.id, productsTable.shopId))
      .innerJoin(
        categoriesTable,
        eq(categoriesTable.id, productsTable.categoryId),
      )
      .where(
        and(
          visibleShopConditions(query.pinCode),
          eq(productsTable.moderationStatus, "visible"),
          eq(categoriesTable.active, true),
          categoryFilter,
        ),
      )
      .orderBy(desc(productsTable.isFeatured), desc(productsTable.createdAt))
      .limit(18),
  ]);

  res.json(
    GetCatalogResponse.parse({
      pinCode: query.pinCode,
      categories,
      shops,
      products,
    }),
  );
});

router.get("/categories", async (_req, res) => {
  const categories = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      active: categoriesTable.active,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.active, true))
    .orderBy(categoriesTable.name);
  res.json(ListCategoriesResponse.parse(categories));
});

router.get("/shops", async (req, res) => {
  const query = parseInput(SearchShopsQueryParams, req.query);
  const pattern = searchPattern(query.q);
  const categoryFilter = categoryPredicate(query.category);
  const textFilter = pattern
    ? or(
        ilike(shopsTable.name, pattern),
        ilike(shopsTable.address, pattern),
        ilike(categoriesTable.name, pattern),
      )
    : undefined;
  const shops = await db
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
        select count(*)::int from products
        where products.shop_id = ${shopsTable.id}
          and products.moderation_status = 'visible'
      )`,
    })
    .from(shopsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, shopsTable.categoryId))
    .where(
      and(
        visibleShopConditions(query.pinCode),
        categoryFilter,
        textFilter,
        eq(categoriesTable.active, true),
      ),
    )
    .orderBy(desc(shopsTable.createdAt))
    .limit(50);

  res.json(SearchShopsResponse.parse(shops));
});

router.get("/shops/:shopId", async (req, res) => {
  const { shopId } = parseInput(GetShopParams, req.params);
  if (shopId < 1) throw new HttpError(400, "Shop ID must be a positive integer.");
  const shop = await getPublicShop(shopId);
  if (!shop) throw new HttpError(404, "This shop is not currently visible.", "shop_not_found");

  await db
    .update(shopsTable)
    .set({ profileViews: sql`${shopsTable.profileViews} + 1` })
    .where(eq(shopsTable.id, shopId));

  const products = await db
    .select(productFields)
    .from(productsTable)
    .innerJoin(shopsTable, eq(shopsTable.id, productsTable.shopId))
    .innerJoin(
      categoriesTable,
      eq(categoriesTable.id, productsTable.categoryId),
    )
    .where(
      and(
        eq(productsTable.shopId, shopId),
        eq(productsTable.moderationStatus, "visible"),
        eq(categoriesTable.active, true),
        visibleShopConditions(),
      ),
    )
    .orderBy(desc(productsTable.isFeatured), desc(productsTable.createdAt))
    .limit(100);

  res.json(GetShopResponse.parse({ shop, products }));
});

router.get("/products", async (req, res) => {
  const query = parseInput(SearchProductsQueryParams, req.query);
  const pattern = searchPattern(query.q);
  const categoryFilter = categoryPredicate(query.category);
  const textFilter = pattern
    ? or(
        ilike(productsTable.name, pattern),
        ilike(productsTable.description, pattern),
        ilike(categoriesTable.name, pattern),
        ilike(shopsTable.name, pattern),
      )
    : undefined;
  const products = await db
    .select(productFields)
    .from(productsTable)
    .innerJoin(shopsTable, eq(shopsTable.id, productsTable.shopId))
    .innerJoin(
      categoriesTable,
      eq(categoriesTable.id, productsTable.categoryId),
    )
    .where(
      and(
        visibleShopConditions(query.pinCode),
        eq(productsTable.moderationStatus, "visible"),
        eq(categoriesTable.active, true),
        categoryFilter,
        textFilter,
      ),
    )
    .orderBy(desc(productsTable.isFeatured), desc(productsTable.createdAt))
    .limit(50);
  res.json(SearchProductsResponse.parse(products));
});

router.get("/products/:productId", async (req, res) => {
  const { productId } = parseInput(GetProductParams, req.params);
  if (productId < 1) throw new HttpError(400, "Product ID must be a positive integer.");
  const [product] = await db
    .select(productFields)
    .from(productsTable)
    .innerJoin(shopsTable, eq(shopsTable.id, productsTable.shopId))
    .innerJoin(
      categoriesTable,
      eq(categoriesTable.id, productsTable.categoryId),
    )
    .where(
      and(
        eq(productsTable.id, productId),
        eq(productsTable.moderationStatus, "visible"),
        eq(categoriesTable.active, true),
        visibleShopConditions(),
      ),
    )
    .limit(1);
  if (!product) {
    throw new HttpError(404, "This product is not currently visible.", "product_not_found");
  }

  const shop = await getPublicShop(product.shopId);
  if (!shop) throw new HttpError(404, "This shop is not currently visible.", "shop_not_found");
  res.json(GetProductResponse.parse({ product, shop }));
});

export default router;
