import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  GetCurrentUserResponse,
  ListNotificationsResponse,
  MarkNotificationReadParams,
  SubmitComplaintBody,
  SubmitComplaintResponse,
  UpdateCurrentUserBody,
  UpdateCurrentUserResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  complaintsTable,
  messagesTable,
  notificationsTable,
  productsTable,
  shopsTable,
  usersTable,
} from "@workspace/db";
import { requireUser, currentUser } from "../middlewares/auth";
import {
  HttpError,
  cleanText,
  normalizePhone,
  parseInput,
} from "../lib/http";

const router = Router();
const complaintLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Please wait before submitting another report." },
});

router.use(requireUser);

router.get("/me", async (req, res) => {
  const user = currentUser(req);
  res.json(
    GetCurrentUserResponse.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      pinCode: user.pinCode,
    }),
  );
});

router.patch("/me", async (req, res) => {
  const user = currentUser(req);
  const body = parseInput(UpdateCurrentUserBody, req.body);
  const changes: Partial<typeof usersTable.$inferInsert> = {};
  if (body.name !== undefined) changes.name = cleanText(body.name);
  if (body.phone !== undefined) {
    changes.phone = body.phone ? normalizePhone(body.phone) : null;
  }
  if (body.pinCode !== undefined) changes.pinCode = body.pinCode;
  if (!Object.keys(changes).length) {
    throw new HttpError(400, "Provide at least one profile field to update.", "empty_update");
  }

  const [updated] = await db
    .update(usersTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();
  if (!updated) throw new HttpError(404, "Account profile not found.", "profile_not_found");
  res.json(
    UpdateCurrentUserResponse.parse({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      pinCode: updated.pinCode,
    }),
  );
});

router.get("/notifications", async (req, res) => {
  const user = currentUser(req);
  const rows = await db
    .select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      body: notificationsTable.body,
      createdAt: notificationsTable.createdAt,
      readAt: notificationsTable.readAt,
    })
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);
  res.json(ListNotificationsResponse.parse(rows));
});

router.patch("/notifications/:notificationId/read", async (req, res) => {
  const user = currentUser(req);
  const { notificationId } = parseInput(MarkNotificationReadParams, req.params);
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.userId, user.id),
      ),
    );
  res.status(204).end();
});

router.post("/complaints", complaintLimiter, async (req, res) => {
  const user = currentUser(req);
  const body = parseInput(SubmitComplaintBody, req.body);
  const shopId = body.shopId ?? null;
  const productId = body.productId ?? null;

  if (shopId !== null) {
    const [shop] = await db
      .select({ id: shopsTable.id })
      .from(shopsTable)
      .where(eq(shopsTable.id, shopId))
      .limit(1);
    if (!shop) throw new HttpError(404, "The reported shop was not found.", "shop_not_found");
  }
  if (productId !== null) {
    const [product] = await db
      .select({ id: productsTable.id, shopId: productsTable.shopId })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);
    if (!product) {
      throw new HttpError(404, "The reported product was not found.", "product_not_found");
    }
    if (shopId !== null && product.shopId !== shopId) {
      throw new HttpError(400, "The product does not belong to the reported shop.", "report_target_mismatch");
    }
  }

  const [complaint] = await db
    .insert(complaintsTable)
    .values({
      userId: user.id,
      shopId,
      productId,
      subject: cleanText(body.subject),
      details: body.details.trim(),
    })
    .returning();
  if (!complaint) throw new HttpError(500, "Unable to submit the report.", "report_unavailable");

  res.status(201).json(
    SubmitComplaintResponse.parse({
      ...complaint,
      createdAt: complaint.createdAt,
    }),
  );
});

export default router;
