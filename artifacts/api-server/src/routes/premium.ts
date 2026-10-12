import {
  and,
  desc,
  eq,
  gt,
  isNull,
  lte,
} from "drizzle-orm";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  CompleteTestPaymentBody,
  CompleteTestPaymentParams,
  CompleteTestPaymentResponse,
  GetMySubscriptionResponse,
  StartSubscriptionBody,
  StartSubscriptionResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  notificationsTable,
  paymentsTable,
  shopsTable,
  subscriptionsTable,
} from "@workspace/db";
import { currentUser, requireRole, requireUser } from "../middlewares/auth";
import { HttpError, parseInput } from "../lib/http";
import { getActiveSubscription, requireSellerShop } from "../lib/marketplace";

const router = Router();
const paymentLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Please wait before retrying Premium billing." },
});

function testModeEnabled() {
  return process.env.NODE_ENV !== "production" &&
    (process.env.PAYMENT_MODE === "test" || !process.env.PAYMENT_MODE);
}

function monthlyPricePaise() {
  const raw = process.env.PREMIUM_PRICE_INR ?? "15";
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    throw new HttpError(500, "PREMIUM_PRICE_INR must be a positive amount no greater than ₹100,000.", "invalid_billing_config");
  }
  return Math.round(amount * 100);
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function safeHashEquals(actualHash: string, expectedHash: string) {
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function expireOverdue(shopId: number) {
  const now = new Date();
  await db
    .update(subscriptionsTable)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(subscriptionsTable.shopId, shopId),
        eq(subscriptionsTable.status, "active"),
        lte(subscriptionsTable.expiresAt, now),
      ),
    );
}

async function latestSubscription(shopId: number) {
  const [row] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.shopId, shopId))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);
  return row ?? null;
}

async function getBillingPayload(shopId: number, userId: number) {
  await expireOverdue(shopId);
  let subscription = await latestSubscription(shopId);
  const now = new Date();
  if (
    subscription?.status === "active" &&
    subscription.expiresAt &&
    subscription.expiresAt.getTime() > now.getTime() &&
    subscription.renewalReminderSentAt === null &&
    subscription.expiresAt.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000
  ) {
    const [reminded] = await db
      .update(subscriptionsTable)
      .set({ renewalReminderSentAt: now })
      .where(
        and(
          eq(subscriptionsTable.id, subscription.id),
          isNull(subscriptionsTable.renewalReminderSentAt),
        ),
      )
      .returning({ id: subscriptionsTable.id });
    if (reminded) {
      await db.insert(notificationsTable).values({
        userId,
        title: "NearLoop Premium renewal reminder",
        body: `Your Premium membership expires on ${subscription.expiresAt.toLocaleDateString("en-IN")}. Renew to keep your shop visible to nearby shoppers.`,
      });
    }
    subscription = await latestSubscription(shopId);
  }

  const payments = await db
    .select()
    .from(paymentsTable)
    .innerJoin(
      subscriptionsTable,
      eq(subscriptionsTable.id, paymentsTable.subscriptionId),
    )
    .where(eq(subscriptionsTable.shopId, shopId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(100);

  return GetMySubscriptionResponse.parse({
    subscription: subscription
      ? {
          id: subscription.id,
          shopId: subscription.shopId,
          status: subscription.status,
          amountInr: subscription.amountInrPaise / 100,
          startsAt: subscription.startsAt,
          expiresAt: subscription.expiresAt,
          renewalReminderSentAt: subscription.renewalReminderSentAt,
        }
      : null,
    payments: payments.map(({ payments: payment }) => ({
      id: payment.id,
      subscriptionId: payment.subscriptionId,
      amountInr: payment.amountInrPaise / 100,
      status: payment.status,
      provider: payment.provider,
      reference: payment.reference,
      createdAt: payment.createdAt,
    })),
    monthlyPriceInr: monthlyPricePaise() / 100,
    testMode: testModeEnabled(),
  });
}

router.use(requireUser, requireRole("seller"));

router.get("/subscriptions", async (req, res) => {
  const user = currentUser(req);
  const shop = await requireSellerShop(user.id);
  res.json(await getBillingPayload(shop.id, user.id));
});

router.post(
  "/subscriptions",
  paymentLimiter,
  async (req, res) => {
    const user = currentUser(req);
    const shop = await requireSellerShop(user.id);
    const body = parseInput(StartSubscriptionBody, req.body);
    if (body.shopId !== shop.id) {
      throw new HttpError(404, "The requested shop is not yours.", "shop_not_found");
    }
    if (!testModeEnabled()) {
      throw new HttpError(
        503,
        "A verified payment provider is not configured. NearLoop will not record or activate an unverified payment.",
        "payment_provider_unavailable",
      );
    }

    const amountInrPaise = monthlyPricePaise();
    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const tokenExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const pending = await db.transaction(async (tx) => {
      await tx
        .select({ id: shopsTable.id })
        .from(shopsTable)
        .where(eq(shopsTable.id, shop.id))
        .for("update");

      await tx
        .update(subscriptionsTable)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(subscriptionsTable.shopId, shop.id),
            eq(subscriptionsTable.status, "active"),
            lte(subscriptionsTable.expiresAt, now),
          ),
        );
      const active = await tx
        .select({ id: subscriptionsTable.id })
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.shopId, shop.id),
            eq(subscriptionsTable.status, "active"),
            gt(subscriptionsTable.expiresAt, now),
          ),
        )
        .limit(1);
      if (active.length) {
        throw new HttpError(409, "Your Premium membership is already active.", "subscription_active");
      }

      const [existing] = await tx
        .select({
          id: subscriptionsTable.id,
          status: subscriptionsTable.status,
          paymentId: paymentsTable.id,
          tokenExpiresAt: paymentsTable.testTokenExpiresAt,
        })
        .from(subscriptionsTable)
        .leftJoin(
          paymentsTable,
          eq(paymentsTable.subscriptionId, subscriptionsTable.id),
        )
        .where(
          and(
            eq(subscriptionsTable.shopId, shop.id),
            eq(subscriptionsTable.status, "pending"),
          ),
        )
        .orderBy(desc(subscriptionsTable.createdAt))
        .limit(1);
      if (existing) {
        if (
          existing.tokenExpiresAt &&
          existing.tokenExpiresAt.getTime() > now.getTime()
        ) {
          if (!existing.paymentId) {
            throw new HttpError(409, "The pending payment record is incomplete. Contact NearLoop support.", "payment_record_incomplete");
          }
          await tx
            .update(paymentsTable)
            .set({
              testTokenHash: hashToken(token),
              testTokenExpiresAt: tokenExpiresAt,
            })
            .where(eq(paymentsTable.id, existing.paymentId));
          return { id: existing.id, status: "pending" as const };
        }
        if (existing.paymentId) {
          await tx
            .update(paymentsTable)
            .set({ status: "failed", testTokenHash: null, testTokenExpiresAt: null })
            .where(eq(paymentsTable.id, existing.paymentId));
        }
        await tx
          .update(subscriptionsTable)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(subscriptionsTable.id, existing.id));
      }

      const [subscription] = await tx
        .insert(subscriptionsTable)
        .values({
          shopId: shop.id,
          status: "pending",
          amountInrPaise,
        })
        .returning();
      if (!subscription) throw new HttpError(500, "Unable to start Premium membership.");
      const [payment] = await tx
        .insert(paymentsTable)
        .values({
          subscriptionId: subscription.id,
          amountInrPaise,
          status: "pending",
          provider: "test",
          testTokenHash: hashToken(token),
          testTokenExpiresAt: tokenExpiresAt,
        })
        .returning({ id: paymentsTable.id });
      if (!payment) throw new HttpError(500, "Unable to create the test payment.");
      return { id: subscription.id, status: subscription.status };
    });

    res.status(201).json(
      StartSubscriptionResponse.parse({
        subscriptionId: pending.id,
        amountInr: amountInrPaise / 100,
        currency: "INR",
        status: pending.status,
        testMode: true,
        testToken: token,
        message: "Development test mode: this token allows a simulated payment only and is never a real payment.",
      }),
    );
  },
);

router.post(
  "/subscriptions/:subscriptionId/simulate-payment",
  paymentLimiter,
  async (req, res) => {
    if (!testModeEnabled()) {
      throw new HttpError(404, "Test payment simulation is disabled.", "test_payment_disabled");
    }
    const user = currentUser(req);
    const shop = await requireSellerShop(user.id);
    const { subscriptionId } = parseInput(CompleteTestPaymentParams, req.params);
    const body = parseInput(CompleteTestPaymentBody, req.body);
    const now = new Date();
    await db.transaction(async (tx) => {
      const [subscription] = await tx
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.id, subscriptionId),
            eq(subscriptionsTable.shopId, shop.id),
          ),
        )
        .for("update")
        .limit(1);
      if (!subscription) {
        throw new HttpError(404, "Payment not found for this shop.", "payment_not_found");
      }
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.subscriptionId, subscriptionId),
            eq(paymentsTable.provider, "test"),
          ),
        )
        .limit(1);
      if (!payment) throw new HttpError(404, "Test payment not found.", "payment_not_found");

      if (payment.status === "verified") return;
      if (payment.status !== "pending" || subscription.status !== "pending") {
        throw new HttpError(409, "This payment has already been completed.", "payment_already_completed");
      }
      if (
        !payment.testTokenHash ||
        !payment.testTokenExpiresAt ||
        payment.testTokenExpiresAt.getTime() <= now.getTime()
      ) {
        await tx
          .update(paymentsTable)
          .set({ status: "failed", testTokenHash: null, testTokenExpiresAt: null })
          .where(eq(paymentsTable.id, payment.id));
        await tx
          .update(subscriptionsTable)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(subscriptionsTable.id, subscription.id));
        return;
      }
      if (!safeHashEquals(hashToken(body.testToken), payment.testTokenHash)) {
        throw new HttpError(403, "The payment token is invalid.", "invalid_payment_token");
      }

      if (body.outcome === "decline") {
        await tx
          .update(paymentsTable)
          .set({
            status: "failed",
            reference: `test-declined-${payment.id}`,
            testTokenHash: null,
            testTokenExpiresAt: null,
          })
          .where(eq(paymentsTable.id, payment.id));
        await tx
          .update(subscriptionsTable)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(subscriptionsTable.id, subscription.id));
        return;
      }

      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await tx
        .update(paymentsTable)
        .set({
          status: "verified",
          reference: `test-verified-${payment.id}`,
          verifiedAt: now,
          testTokenHash: null,
          testTokenExpiresAt: null,
        })
        .where(eq(paymentsTable.id, payment.id));
      await tx
        .update(subscriptionsTable)
        .set({
          status: "active",
          startsAt: now,
          expiresAt,
          updatedAt: now,
        })
        .where(eq(subscriptionsTable.id, subscription.id));
      await tx.insert(notificationsTable).values({
        userId: user.id,
        title: "NearLoop Premium is active",
        body: `Your development test membership is active until ${expiresAt.toLocaleDateString("en-IN")}. No real payment was taken.`,
      });
    });

    res.json(await getBillingPayload(shop.id, user.id));
  },
);

export default router;
