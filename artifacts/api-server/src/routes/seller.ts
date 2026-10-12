import {
  and,
  desc,
  eq,
  ne,
  sql,
} from "drizzle-orm";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  CreateSellerProductBody,
  CreateSellerProductResponse,
  DeleteSellerProductParams,
  GetSellerOverviewResponse,
  GetSellerShopStatusResponse,
  ListSellerProductsResponse,
  ResubmitShopApplicationBody,
  ResubmitShopApplicationResponse,
  SubmitShopApplicationBody,
  SubmitShopApplicationResponse,
  UpdateSellerProductBody,
  UpdateSellerProductParams,
  UpdateSellerProductResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  categoriesTable,
  conversationsTable,
  productsTable,
  productImagesTable,
  pincodesTable,
  shopApplicationsTable,
  shopsTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { currentUser, requireRole, requireUser } from "../middlewares/auth";
import {
  HttpError,
  cleanText,
  normalizePhone,
  normalizeWhatsApp,
  parseInput,
} from "../lib/http";
import { parseSellerImagePath, resolveProductImage } from "../lib/productImage";
import { getSellerObject, setObjectAclPolicy } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import {
  getActiveCategory,
  getActiveSubscription,
  requireSellerShop,
} from "../lib/marketplace";

const router = Router();
const sellerActionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Please wait before trying this seller action again." },
});

router.use(requireUser);

function isValidPinCode(pinCode: string) {
  return /^\d{6}$/.test(pinCode);
}

function mapApplication(row: typeof shopApplicationsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    ownerName: row.ownerName,
    category: row.categoryName,
    address: row.address,
    pinCode: row.pinCode,
    contactPhone: row.contactPhone,
    whatsappNumber: row.whatsappNumber,
    status: row.status,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
  };
}

async function retireImageIfUnused(imageUrl: string | null, ownerId: number, excludingProductId: number) {
  if (!imageUrl) return;
  const path = parseSellerImagePath(imageUrl);
  if (!path || path.ownerId !== ownerId) return;
  const [reference] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(and(eq(productsTable.imageUrl, imageUrl), ne(productsTable.id, excludingProductId)))
    .limit(1);
  if (reference) return;
  try {
    const file = await getSellerObject(ownerId, path.relativePath);
    await setObjectAclPolicy(file, { owner: String(ownerId), visibility: "private" });
  } catch (error) {
    logger.warn({ err: error }, "Could not privatize an unused product image");
  }
}

async function getLatestApplication(userId: number) {
  const [row] = await db
    .select()
    .from(shopApplicationsTable)
    .where(eq(shopApplicationsTable.userId, userId))
    .orderBy(desc(shopApplicationsTable.createdAt))
    .limit(1);
  return row ?? null;
}

async function getOwnedShopCard(userId: number) {
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
      isPremium: sql<boolean>`exists (
        select 1 from subscriptions
        where subscriptions.shop_id = ${shopsTable.id}
          and subscriptions.status = 'active'
          and subscriptions.expires_at > now()
      )`,
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
        eq(shopsTable.ownerId, userId),
        eq(shopsTable.status, "approved"),
        eq(shopsTable.pinCodeVerified, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function getProductForSeller(productId: number, shopId: number) {
  const [row] = await db
    .select({
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
    })
    .from(productsTable)
    .innerJoin(shopsTable, eq(shopsTable.id, productsTable.shopId))
    .innerJoin(
      categoriesTable,
      eq(categoriesTable.id, productsTable.categoryId),
    )
    .where(
      and(
        eq(productsTable.id, productId),
        eq(productsTable.shopId, shopId),
      ),
    )
    .limit(1);
  return row ?? null;
}

router.get("/seller/shop-status", async (req, res) => {
  const user = currentUser(req);
  const [application, shopRow] = await Promise.all([
    getLatestApplication(user.id),
    db
      .select({ id: shopsTable.id, status: shopsTable.status })
      .from(shopsTable)
      .where(eq(shopsTable.ownerId, user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const shop =
    shopRow?.status === "approved" ? await getOwnedShopCard(user.id) : null;
  res.json(
    GetSellerShopStatusResponse.parse({
      application: application ? mapApplication(application) : null,
      shop,
    }),
  );
});

async function parseApplicationBody(body: unknown) {
  const input = parseInput(SubmitShopApplicationBody, body);
  if (!isValidPinCode(input.pinCode)) {
    throw new HttpError(400, "Use a six-digit Indian PIN code.", "invalid_pincode");
  }
  const category = await getActiveCategory(input.category);
  const [pin] = await db
    .select({ id: pincodesTable.id })
    .from(pincodesTable)
    .where(
      and(
        eq(pincodesTable.pinCode, input.pinCode),
        eq(pincodesTable.active, true),
      ),
    )
    .limit(1);
  if (!pin) {
    throw new HttpError(400, "This PIN code is not currently supported. Contact NearLoop support to have it reviewed.", "unsupported_pincode");
  }
  return {
    name: cleanText(input.name),
    ownerName: cleanText(input.ownerName),
    category,
    address: cleanText(input.address),
    pinCode: input.pinCode,
    contactPhone: normalizePhone(input.contactPhone),
    whatsappNumber: normalizeWhatsApp(input.whatsappNumber),
  };
}

router.post("/seller/applications", sellerActionLimiter, async (req, res) => {
  const user = currentUser(req);
  if (user.role === "admin") {
    throw new HttpError(409, "Admin accounts cannot register a seller shop.", "admin_seller_conflict");
  }
  const input = await parseApplicationBody(req.body);
  const existingApplication = await getLatestApplication(user.id);
  if (existingApplication) {
    throw new HttpError(
      409,
      existingApplication.status === "pending"
        ? "Your shop application is already under review."
        : "Use the resubmit action to update your existing application.",
      "application_exists",
    );
  }
  const [existingShop] = await db
    .select({ id: shopsTable.id })
    .from(shopsTable)
    .where(eq(shopsTable.ownerId, user.id))
    .limit(1);
  if (existingShop) {
    throw new HttpError(409, "A shop record already exists for this seller.", "shop_exists");
  }

  const result = await db.transaction(async (tx) => {
    const [application] = await tx
      .insert(shopApplicationsTable)
      .values({
        userId: user.id,
        name: input.name,
        ownerName: input.ownerName,
        categoryId: input.category.id,
        categoryName: input.category.name,
        address: input.address,
        pinCode: input.pinCode,
        contactPhone: input.contactPhone,
        whatsappNumber: input.whatsappNumber,
        status: "pending",
      })
      .returning();
    if (!application) throw new HttpError(500, "Unable to save the shop application.");

    const [shop] = await tx
      .insert(shopsTable)
      .values({
        ownerId: user.id,
        applicationId: application.id,
        name: input.name,
        ownerName: input.ownerName,
        categoryId: input.category.id,
        address: input.address,
        pinCode: input.pinCode,
        pinCodeVerified: false,
        contactPhone: input.contactPhone,
        whatsappNumber: input.whatsappNumber,
        status: "pending",
      })
      .returning();
    if (!shop) throw new HttpError(500, "Unable to create the pending shop record.");

    await tx
      .update(usersTable)
      .set({ role: "seller", updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    return application;
  });

  res.status(201).json(
    SubmitShopApplicationResponse.parse({
      application: mapApplication(result),
      shop: null,
    }),
  );
});

router.patch("/seller/applications", sellerActionLimiter, async (req, res) => {
  const user = currentUser(req);
  if (user.role === "admin") {
    throw new HttpError(409, "Admin accounts cannot register a seller shop.", "admin_seller_conflict");
  }
  const input = await parseApplicationBody(
    parseInput(ResubmitShopApplicationBody, req.body),
  );
  const application = await getLatestApplication(user.id);
  if (!application || application.status !== "rejected") {
    throw new HttpError(409, "Only a rejected application can be resubmitted.", "resubmit_not_allowed");
  }

  const [shop] = await db
    .select()
    .from(shopsTable)
    .where(eq(shopsTable.applicationId, application.id))
    .limit(1);
  if (!shop || shop.status !== "rejected") {
    throw new HttpError(409, "This application is not available for resubmission.", "resubmit_not_allowed");
  }

  const updatedApplication = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(shopApplicationsTable)
      .set({
        name: input.name,
        ownerName: input.ownerName,
        categoryId: input.category.id,
        categoryName: input.category.name,
        address: input.address,
        pinCode: input.pinCode,
        contactPhone: input.contactPhone,
        whatsappNumber: input.whatsappNumber,
        status: "pending",
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(shopApplicationsTable.id, application.id))
      .returning();
    await tx
      .update(shopsTable)
      .set({
        name: input.name,
        ownerName: input.ownerName,
        categoryId: input.category.id,
        address: input.address,
        pinCode: input.pinCode,
        pinCodeVerified: false,
        contactPhone: input.contactPhone,
        whatsappNumber: input.whatsappNumber,
        status: "pending",
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(shopsTable.id, shop.id));
    if (!updated) throw new HttpError(500, "Unable to resubmit the shop application.");
    return updated;
  });

  res.json(
    ResubmitShopApplicationResponse.parse({
      application: mapApplication(updatedApplication),
      shop: null,
    }),
  );
});

router.get(
  "/seller/overview",
  requireRole("seller"),
  async (req, res) => {
    const user = currentUser(req);
    const shop = await requireSellerShop(user.id);
    const [productCounts, inquiryCount, latestSubscription] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          available: sql<number>`count(*) filter (where ${productsTable.available})::int`,
        })
        .from(productsTable)
        .where(eq(productsTable.shopId, shop.id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversationsTable)
        .where(eq(conversationsTable.shopId, shop.id)),
      db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.shopId, shop.id))
        .orderBy(desc(subscriptionsTable.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);
    const subscription = latestSubscription;
    const now = Date.now();
    const subscriptionStatus =
      subscription?.status === "active" &&
      subscription.expiresAt &&
      subscription.expiresAt.getTime() > now
        ? "active"
        : subscription?.status === "pending"
          ? "pending"
          : subscription
            ? "expired"
            : "inactive";

    res.json(
      GetSellerOverviewResponse.parse({
        shop: await getOwnedShopCard(user.id),
        totalProducts: productCounts[0]?.total ?? 0,
        availableProducts: productCounts[0]?.available ?? 0,
        inquiries: inquiryCount[0]?.count ?? 0,
        profileViews: shop.profileViews,
        subscriptionStatus,
        expiresAt: subscription?.expiresAt ?? null,
      }),
    );
  },
);

router.get(
  "/seller/products",
  requireRole("seller"),
  async (req, res) => {
    const shop = await requireSellerShop(currentUser(req).id);
    const products = await db
      .select({
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
      })
      .from(productsTable)
      .innerJoin(shopsTable, eq(shopsTable.id, productsTable.shopId))
      .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
      .where(eq(productsTable.shopId, shop.id))
      .orderBy(desc(productsTable.createdAt));
    res.json(ListSellerProductsResponse.parse(products));
  },
);

router.post(
  "/seller/products",
  sellerActionLimiter,
  requireRole("seller"),
  async (req, res) => {
    const user = currentUser(req);
    const shop = await requireSellerShop(user.id);
    const input = parseInput(CreateSellerProductBody, req.body);
    const category = await getActiveCategory(input.category);
    const premium = await getActiveSubscription(shop.id);
    const imageUrl = await resolveProductImage(input.imageUrl, user.id);
    const [created] = await db
      .insert(productsTable)
      .values({
        shopId: shop.id,
        name: cleanText(input.name),
        categoryId: category.id,
        description: input.description?.trim() || null,
        pricePaise: Math.round(input.price * 100),
        available: input.available,
        imageUrl,
        isFeatured: Boolean(input.isFeatured && premium),
      })
      .returning();
    if (!created) throw new HttpError(500, "Unable to create the product.");
    const imagePath = imageUrl ? parseSellerImagePath(imageUrl) : null;
    if (imagePath) {
      await db.insert(productImagesTable).values({
        productId: created.id,
        objectPath: imagePath.relativePath,
        altText: cleanText(input.name),
      });
    }
    const product = await getProductForSeller(created.id, shop.id);
    if (!product) throw new HttpError(500, "Unable to load the new product.");
    res.status(201).json(CreateSellerProductResponse.parse(product));
  },
);

router.patch(
  "/seller/products/:productId",
  sellerActionLimiter,
  requireRole("seller"),
  async (req, res) => {
    const user = currentUser(req);
    const shop = await requireSellerShop(user.id);
    const { productId } = parseInput(UpdateSellerProductParams, req.params);
    const input = parseInput(UpdateSellerProductBody, req.body);
    const [owned] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.shopId, shop.id),
        ),
      )
      .limit(1);
    if (!owned) throw new HttpError(404, "Product not found in your shop.", "product_not_found");
    const [previous] = await db
      .select({ imageUrl: productsTable.imageUrl })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    const changes: Partial<typeof productsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) changes.name = cleanText(input.name);
    if (input.category !== undefined) {
      changes.categoryId = (await getActiveCategory(input.category)).id;
    }
    if (input.description !== undefined) {
      changes.description = input.description?.trim() || null;
    }
    if (input.price !== undefined) {
      changes.pricePaise = Math.round(input.price * 100);
    }
    if (input.available !== undefined) changes.available = input.available;
    if (input.imageUrl !== undefined) {
      changes.imageUrl = await resolveProductImage(input.imageUrl, user.id);
    }
    if (input.isFeatured !== undefined) {
      const premium = await getActiveSubscription(shop.id);
      changes.isFeatured = Boolean(input.isFeatured && premium);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(productsTable)
        .set(changes)
        .where(
          and(
            eq(productsTable.id, productId),
            eq(productsTable.shopId, shop.id),
          ),
        );
      if (input.imageUrl !== undefined) {
        await tx.delete(productImagesTable).where(eq(productImagesTable.productId, productId));
        const imagePath = changes.imageUrl ? parseSellerImagePath(changes.imageUrl) : null;
        if (imagePath) {
          await tx.insert(productImagesTable).values({
            productId,
            objectPath: imagePath.relativePath,
            altText: cleanText(input.name ?? ""),
          });
        }
      }
    });
    if (input.imageUrl !== undefined && previous?.imageUrl && previous.imageUrl !== changes.imageUrl) {
      await retireImageIfUnused(previous.imageUrl, user.id, productId);
    }
    const product = await getProductForSeller(productId, shop.id);
    if (!product) throw new HttpError(404, "Product not found in your shop.", "product_not_found");
    res.json(UpdateSellerProductResponse.parse(product));
  },
);

router.delete(
  "/seller/products/:productId",
  sellerActionLimiter,
  requireRole("seller"),
  async (req, res) => {
    const user = currentUser(req);
    const shop = await requireSellerShop(user.id);
    const { productId } = parseInput(DeleteSellerProductParams, req.params);
    const [existing] = await db
      .select({ imageUrl: productsTable.imageUrl })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.shopId, shop.id)))
      .limit(1);
    if (!existing) throw new HttpError(404, "Product not found in your shop.", "product_not_found");
    const [deleted] = await db
      .delete(productsTable)
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.shopId, shop.id),
        ),
      )
      .returning({ id: productsTable.id });
    if (!deleted) throw new HttpError(404, "Product not found in your shop.", "product_not_found");
    await retireImageIfUnused(existing.imageUrl, user.id, productId);
    res.status(204).end();
  },
);

export default router;
