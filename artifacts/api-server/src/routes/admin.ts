import { and, desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  CreateAdminCategoryBody,
  CreateAdminCategoryResponse,
  CreateAdminPincodeBody,
  CreateAdminPincodeResponse,
  DeleteAdminCategoryParams,
  DeleteAdminPincodeParams,
  GetAdminBillingResponse,
  GetAdminOverviewResponse,
  ListAdminCategoriesResponse,
  ListAdminComplaintsResponse,
  ListAdminPincodesResponse,
  ListAdminProductsResponse,
  ListAdminSellersResponse,
  ListAdminShopsQueryParams,
  ListAdminShopsResponse,
  UpdateAdminCategoryBody,
  UpdateAdminCategoryParams,
  UpdateAdminCategoryResponse,
  UpdateAdminComplaintBody,
  UpdateAdminComplaintParams,
  UpdateAdminComplaintResponse,
  UpdateAdminPincodeBody,
  UpdateAdminPincodeParams,
  UpdateAdminPincodeResponse,
  UpdateAdminProductBody,
  UpdateAdminProductParams,
  UpdateAdminProductResponse,
  UpdateAdminSellerBody,
  UpdateAdminSellerParams,
  UpdateAdminSellerResponse,
  UpdateAdminShopBody,
  UpdateAdminShopParams,
  UpdateAdminShopResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  categoriesTable,
  complaintsTable,
  notificationsTable,
  paymentsTable,
  pincodesTable,
  productsTable,
  shopApplicationsTable,
  shopsTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { requireRole, requireUser } from "../middlewares/auth";
import {
  HttpError,
  cleanText,
  parseInput,
} from "../lib/http";

const router = Router();
const adminLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Please pause before making more admin changes." },
});

router.use(requireUser, requireRole("admin"));

const adminShopSelection = {
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
  ownerId: shopsTable.ownerId,
  ownerEmail: usersTable.email,
  status: shopsTable.status,
  rejectionReason: shopsTable.rejectionReason,
};

async function getAdminShop(shopId: number) {
  const [shop] = await db
    .select(adminShopSelection)
    .from(shopsTable)
    .innerJoin(usersTable, eq(usersTable.id, shopsTable.ownerId))
    .innerJoin(categoriesTable, eq(categoriesTable.id, shopsTable.categoryId))
    .where(eq(shopsTable.id, shopId))
    .limit(1);
  return shop ?? null;
}

async function adminSeller(userId: number) {
  const [seller] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      phone: usersTable.phone,
      status: usersTable.status,
      shopName: shopsTable.name,
      shopStatus: shopsTable.status,
    })
    .from(usersTable)
    .leftJoin(shopsTable, eq(shopsTable.ownerId, usersTable.id))
    .where(and(eq(usersTable.id, userId), eq(usersTable.role, "seller")))
    .limit(1);
  return seller ?? null;
}

router.get("/admin/overview", async (_req, res) => {
  const [
    shops,
    sellers,
    pendingShops,
    products,
    openComplaints,
    activeSubscriptions,
    verifiedRevenue,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(shopsTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, "seller")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(shopsTable)
      .where(eq(shopsTable.status, "pending")),
    db.select({ count: sql<number>`count(*)::int` }).from(productsTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(complaintsTable)
      .where(sql`${complaintsTable.status} in ('open', 'reviewing')`),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.status, "active"),
          sql`${subscriptionsTable.expiresAt} > now()`,
        ),
      ),
    db
      .select({
        amount: sql<number>`coalesce(sum(${paymentsTable.amountInrPaise}), 0)::float8 / 100.0`,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "verified")),
  ]);
  res.json(
    GetAdminOverviewResponse.parse({
      shops: shops[0]?.count ?? 0,
      sellers: sellers[0]?.count ?? 0,
      pendingShops: pendingShops[0]?.count ?? 0,
      products: products[0]?.count ?? 0,
      openComplaints: openComplaints[0]?.count ?? 0,
      activeSubscriptions: activeSubscriptions[0]?.count ?? 0,
      verifiedRevenueInr: verifiedRevenue[0]?.amount ?? 0,
    }),
  );
});

router.get("/admin/shops", async (req, res) => {
  const { status } = parseInput(ListAdminShopsQueryParams, req.query);
  const shops = await db
    .select(adminShopSelection)
    .from(shopsTable)
    .innerJoin(usersTable, eq(usersTable.id, shopsTable.ownerId))
    .innerJoin(categoriesTable, eq(categoriesTable.id, shopsTable.categoryId))
    .where(status && status !== "all" ? eq(shopsTable.status, status) : undefined)
    .orderBy(desc(shopsTable.createdAt))
    .limit(250);
  res.json(ListAdminShopsResponse.parse(shops));
});

router.patch(
  "/admin/shops/:shopId",
  adminLimiter,
  async (req, res) => {
    const { shopId } = parseInput(UpdateAdminShopParams, req.params);
    const body = parseInput(UpdateAdminShopBody, req.body);
    const [shop] = await db
      .select()
      .from(shopsTable)
      .where(eq(shopsTable.id, shopId))
      .limit(1);
    if (!shop) throw new HttpError(404, "Shop not found.", "shop_not_found");
    const reason = body.reason ? cleanText(body.reason) : null;
    if (body.status === "rejected" && !reason) {
      throw new HttpError(400, "Add a clear reason before rejecting an application.", "rejection_reason_required");
    }
    if (body.status === "approved") {
      const [activePin] = await db
        .select({ id: pincodesTable.id })
        .from(pincodesTable)
        .where(
          and(
            eq(pincodesTable.pinCode, shop.pinCode),
            eq(pincodesTable.active, true),
          ),
        )
        .limit(1);
      const [activeCategory] = await db
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(
          and(
            eq(categoriesTable.id, shop.categoryId),
            eq(categoriesTable.active, true),
          ),
        )
        .limit(1);
      if (!activePin || !activeCategory) {
        throw new HttpError(409, "The shop must use an active category and supported PIN code before approval.", "shop_verification_incomplete");
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(shopsTable)
        .set({
          status: body.status,
          pinCodeVerified:
            body.status === "approved" ? true : shop.pinCodeVerified,
          rejectionReason: body.status === "rejected" ? reason : null,
          updatedAt: new Date(),
        })
        .where(eq(shopsTable.id, shopId));
      await tx
        .update(shopApplicationsTable)
        .set({
          status: body.status,
          rejectionReason: body.status === "rejected" ? reason : null,
          updatedAt: new Date(),
        })
        .where(eq(shopApplicationsTable.id, shop.applicationId));
      await tx.insert(notificationsTable).values({
        userId: shop.ownerId,
        title:
          body.status === "approved"
            ? "Your NearLoop shop is approved"
            : body.status === "rejected"
              ? "Your NearLoop application needs updates"
              : "Your NearLoop shop was suspended",
        body:
          body.status === "approved"
            ? "Your shop passed review. Activate Premium to become visible to nearby shoppers."
            : reason || "Your shop status has been updated by the NearLoop team.",
      });
    });

    const updated = await getAdminShop(shopId);
    if (!updated) throw new HttpError(500, "Unable to load the updated shop.");
    res.json(UpdateAdminShopResponse.parse(updated));
  },
);

router.get("/admin/sellers", async (_req, res) => {
  const sellers = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      phone: usersTable.phone,
      status: usersTable.status,
      shopName: shopsTable.name,
      shopStatus: shopsTable.status,
    })
    .from(usersTable)
    .leftJoin(shopsTable, eq(shopsTable.ownerId, usersTable.id))
    .where(eq(usersTable.role, "seller"))
    .orderBy(desc(usersTable.createdAt))
    .limit(250);
  res.json(ListAdminSellersResponse.parse(sellers));
});

router.patch(
  "/admin/sellers/:userId",
  adminLimiter,
  async (req, res) => {
    const { userId } = parseInput(UpdateAdminSellerParams, req.params);
    const body = parseInput(UpdateAdminSellerBody, req.body);
    const [updated] = await db
      .update(usersTable)
      .set({ status: body.status, updatedAt: new Date() })
      .where(
        and(
          eq(usersTable.id, userId),
          eq(usersTable.role, "seller"),
        ),
      )
      .returning({ id: usersTable.id });
    if (!updated) throw new HttpError(404, "Seller account not found.", "seller_not_found");
    const seller = await adminSeller(updated.id);
    if (!seller) throw new HttpError(500, "Unable to load the updated seller.");
    await db.insert(notificationsTable).values({
      userId,
      title:
        body.status === "suspended"
          ? "Your NearLoop seller account was suspended"
          : "Your NearLoop seller account was restored",
      body:
        body.status === "suspended"
          ? "Seller tools and public shop visibility are unavailable while this account is suspended."
          : "Your seller account has been restored. Check your shop status before publishing.",
    });
    res.json(UpdateAdminSellerResponse.parse(seller));
  },
);

router.get("/admin/products", async (_req, res) => {
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
      shopStatus: shopsTable.status,
      moderationStatus: productsTable.moderationStatus,
      ownerEmail: usersTable.email,
    })
    .from(productsTable)
    .innerJoin(shopsTable, eq(shopsTable.id, productsTable.shopId))
    .innerJoin(usersTable, eq(usersTable.id, shopsTable.ownerId))
    .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
    .orderBy(desc(productsTable.createdAt))
    .limit(500);
  res.json(ListAdminProductsResponse.parse(products));
});

router.patch(
  "/admin/products/:productId",
  adminLimiter,
  async (req, res) => {
    const { productId } = parseInput(UpdateAdminProductParams, req.params);
    const body = parseInput(UpdateAdminProductBody, req.body);
    const [updated] = await db
      .update(productsTable)
      .set({ moderationStatus: body.moderationStatus, updatedAt: new Date() })
      .where(eq(productsTable.id, productId))
      .returning({ id: productsTable.id });
    if (!updated) throw new HttpError(404, "Product not found.", "product_not_found");
    const [product] = await db
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
        shopStatus: shopsTable.status,
        moderationStatus: productsTable.moderationStatus,
        ownerEmail: usersTable.email,
      })
      .from(productsTable)
      .innerJoin(shopsTable, eq(shopsTable.id, productsTable.shopId))
      .innerJoin(usersTable, eq(usersTable.id, shopsTable.ownerId))
      .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
      .where(eq(productsTable.id, updated.id))
      .limit(1);
    if (!product) throw new HttpError(500, "Unable to load the updated product.");
    res.json(UpdateAdminProductResponse.parse(product));
  },
);

router.get("/admin/complaints", async (_req, res) => {
  const complaints = await db
    .select({
      id: complaintsTable.id,
      userId: complaintsTable.userId,
      shopId: complaintsTable.shopId,
      productId: complaintsTable.productId,
      subject: complaintsTable.subject,
      details: complaintsTable.details,
      status: complaintsTable.status,
      adminNote: complaintsTable.adminNote,
      createdAt: complaintsTable.createdAt,
    })
    .from(complaintsTable)
    .orderBy(desc(complaintsTable.createdAt))
    .limit(500);
  res.json(ListAdminComplaintsResponse.parse(complaints));
});

router.patch(
  "/admin/complaints/:complaintId",
  adminLimiter,
  async (req, res) => {
    const { complaintId } = parseInput(UpdateAdminComplaintParams, req.params);
    const body = parseInput(UpdateAdminComplaintBody, req.body);
    const [complaint] = await db
      .update(complaintsTable)
      .set({
        status: body.status,
        adminNote: body.adminNote?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(complaintsTable.id, complaintId))
      .returning();
    if (!complaint) throw new HttpError(404, "Report not found.", "complaint_not_found");
    await db.insert(notificationsTable).values({
      userId: complaint.userId,
      title: "Your NearLoop report was updated",
      body: `Report status: ${body.status}.${body.adminNote ? ` ${body.adminNote.trim()}` : ""}`,
    });
    res.json(UpdateAdminComplaintResponse.parse(complaint));
  },
);

router.get("/admin/billing", async (_req, res) => {
  const [subscriptionRows, paymentRows] = await Promise.all([
    db
      .select()
      .from(subscriptionsTable)
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(500),
    db
      .select()
      .from(paymentsTable)
      .orderBy(desc(paymentsTable.createdAt))
      .limit(500),
  ]);
  res.json(
    GetAdminBillingResponse.parse({
      subscriptions: subscriptionRows.map((subscription) => ({
        id: subscription.id,
        shopId: subscription.shopId,
        status: subscription.status,
        amountInr: subscription.amountInrPaise / 100,
        startsAt: subscription.startsAt,
        expiresAt: subscription.expiresAt,
        renewalReminderSentAt: subscription.renewalReminderSentAt,
      })),
      payments: paymentRows.map((payment) => ({
        id: payment.id,
        subscriptionId: payment.subscriptionId,
        amountInr: payment.amountInrPaise / 100,
        status: payment.status,
        provider: payment.provider,
        reference: payment.reference,
        createdAt: payment.createdAt,
      })),
    }),
  );
});

router.get("/admin/categories", async (_req, res) => {
  const rows = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      active: categoriesTable.active,
    })
    .from(categoriesTable)
    .orderBy(categoriesTable.name);
  res.json(ListAdminCategoriesResponse.parse(rows));
});

function normalizeSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new HttpError(400, "Use a category slug with lowercase letters, numbers, and single hyphens.", "invalid_category_slug");
  }
  return slug;
}

router.post(
  "/admin/categories",
  adminLimiter,
  async (req, res) => {
    const body = parseInput(CreateAdminCategoryBody, req.body);
    const [category] = await db
      .insert(categoriesTable)
      .values({
        name: cleanText(body.name),
        slug: normalizeSlug(body.slug),
      })
      .returning({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        active: categoriesTable.active,
      });
    if (!category) throw new HttpError(500, "Unable to create the category.");
    res.status(201).json(CreateAdminCategoryResponse.parse(category));
  },
);

router.patch(
  "/admin/categories/:categoryId",
  adminLimiter,
  async (req, res) => {
    const { categoryId } = parseInput(UpdateAdminCategoryParams, req.params);
    const body = parseInput(UpdateAdminCategoryBody, req.body);
    const changes: Partial<typeof categoriesTable.$inferInsert> = {};
    if (body.name !== undefined) changes.name = cleanText(body.name);
    if (body.slug !== undefined) changes.slug = normalizeSlug(body.slug);
    if (body.active !== undefined) changes.active = body.active;
    if (Object.keys(changes).length === 0) {
      throw new HttpError(400, "Provide at least one category field to update.", "empty_update");
    }
    const [category] = await db
      .update(categoriesTable)
      .set(changes)
      .where(eq(categoriesTable.id, categoryId))
      .returning({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        active: categoriesTable.active,
      });
    if (!category) throw new HttpError(404, "Category not found.", "category_not_found");
    res.json(UpdateAdminCategoryResponse.parse(category));
  },
);

router.delete(
  "/admin/categories/:categoryId",
  adminLimiter,
  async (req, res) => {
    const { categoryId } = parseInput(DeleteAdminCategoryParams, req.params);
    const [category] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId))
      .limit(1);
    if (!category) throw new HttpError(404, "Category not found.", "category_not_found");
    const [shopUse, applicationUse, productUse] = await Promise.all([
      db.select({ id: shopsTable.id }).from(shopsTable).where(eq(shopsTable.categoryId, categoryId)).limit(1),
      db.select({ id: shopApplicationsTable.id }).from(shopApplicationsTable).where(eq(shopApplicationsTable.categoryId, categoryId)).limit(1),
      db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.categoryId, categoryId)).limit(1),
    ]);
    if (shopUse.length || applicationUse.length || productUse.length) {
      throw new HttpError(409, "This category is assigned to a shop or product. Deactivate it instead.", "category_in_use");
    }
    await db.delete(categoriesTable).where(eq(categoriesTable.id, categoryId));
    res.status(204).end();
  },
);

router.get("/admin/pincodes", async (_req, res) => {
  const rows = await db
    .select({
      id: pincodesTable.id,
      pinCode: pincodesTable.pinCode,
      areaName: pincodesTable.areaName,
      active: pincodesTable.active,
    })
    .from(pincodesTable)
    .orderBy(pincodesTable.pinCode);
  res.json(ListAdminPincodesResponse.parse(rows));
});

router.post(
  "/admin/pincodes",
  adminLimiter,
  async (req, res) => {
    const body = parseInput(CreateAdminPincodeBody, req.body);
    const [pin] = await db
      .insert(pincodesTable)
      .values({
        pinCode: body.pinCode,
        areaName: cleanText(body.areaName),
      })
      .returning({
        id: pincodesTable.id,
        pinCode: pincodesTable.pinCode,
        areaName: pincodesTable.areaName,
        active: pincodesTable.active,
      });
    if (!pin) throw new HttpError(500, "Unable to add the PIN code.");
    res.status(201).json(CreateAdminPincodeResponse.parse(pin));
  },
);

router.patch(
  "/admin/pincodes/:pincodeId",
  adminLimiter,
  async (req, res) => {
    const { pincodeId } = parseInput(UpdateAdminPincodeParams, req.params);
    const body = parseInput(UpdateAdminPincodeBody, req.body);
    const changes: Partial<typeof pincodesTable.$inferInsert> = {};
    if (body.areaName !== undefined) changes.areaName = cleanText(body.areaName);
    if (body.active !== undefined) changes.active = body.active;
    if (Object.keys(changes).length === 0) {
      throw new HttpError(400, "Provide at least one PIN code field to update.", "empty_update");
    }
    const [pin] = await db
      .update(pincodesTable)
      .set(changes)
      .where(eq(pincodesTable.id, pincodeId))
      .returning({
        id: pincodesTable.id,
        pinCode: pincodesTable.pinCode,
        areaName: pincodesTable.areaName,
        active: pincodesTable.active,
      });
    if (!pin) throw new HttpError(404, "PIN code not found.", "pincode_not_found");
    res.json(UpdateAdminPincodeResponse.parse(pin));
  },
);

router.delete(
  "/admin/pincodes/:pincodeId",
  adminLimiter,
  async (req, res) => {
    const { pincodeId } = parseInput(DeleteAdminPincodeParams, req.params);
    const [pin] = await db
      .update(pincodesTable)
      .set({ active: false })
      .where(eq(pincodesTable.id, pincodeId))
      .returning({ id: pincodesTable.id });
    if (!pin) throw new HttpError(404, "PIN code not found.", "pincode_not_found");
    res.status(204).end();
  },
);

export default router;
