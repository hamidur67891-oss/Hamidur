import {
  and,
  asc,
  eq,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  ListConversationsResponse,
  ListMessagesParams,
  ListMessagesResponse,
  SendMessageBody,
  SendMessageParams,
  SendMessageResponse,
  StartConversationBody,
  StartConversationResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  conversationsTable,
  messagesTable,
  notificationsTable,
  productsTable,
  shopsTable,
  usersTable,
} from "@workspace/db";
import { currentUser, requireUser } from "../middlewares/auth";
import { HttpError, cleanText, parseInput } from "../lib/http";
import { getPublicShop } from "../lib/marketplace";

const router = Router();
const customerAlias = alias(usersTable, "conversation_customer");
const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Please slow down before sending more messages." },
});

router.use(requireUser);

async function getParticipantConversation(conversationId: number, userId: number) {
  const [row] = await db
    .select({
      id: conversationsTable.id,
      shopId: conversationsTable.shopId,
      customerId: conversationsTable.customerId,
      productId: conversationsTable.productId,
      shopOwnerId: shopsTable.ownerId,
      shopName: shopsTable.name,
    })
    .from(conversationsTable)
    .innerJoin(shopsTable, eq(shopsTable.id, conversationsTable.shopId))
    .where(eq(conversationsTable.id, conversationId))
    .limit(1);
  if (!row || (row.customerId !== userId && row.shopOwnerId !== userId)) {
    throw new HttpError(404, "Conversation not found.", "conversation_not_found");
  }
  return row;
}

async function conversationSummary(id: number, viewerId: number) {
  const [row] = await db
    .select({
      id: conversationsTable.id,
      shopId: conversationsTable.shopId,
      shopName: shopsTable.name,
      customerName: customerAlias.name,
      lastMessage: sql<string | null>`(
        select body from messages
        where messages.conversation_id = ${conversationsTable.id}
        order by messages.created_at desc, messages.id desc
        limit 1
      )`,
      lastMessageAt: sql<Date | null>`(
        select created_at from messages
        where messages.conversation_id = ${conversationsTable.id}
        order by messages.created_at desc, messages.id desc
        limit 1
      )`,
      unreadCount: sql<number>`(
        select count(*)::int from messages
        where messages.conversation_id = ${conversationsTable.id}
          and messages.sender_id <> ${viewerId}
          and messages.read_at is null
      )`,
      productId: conversationsTable.productId,
      productName: productsTable.name,
    })
    .from(conversationsTable)
    .innerJoin(shopsTable, eq(shopsTable.id, conversationsTable.shopId))
    .innerJoin(customerAlias, eq(customerAlias.id, conversationsTable.customerId))
    .leftJoin(productsTable, eq(productsTable.id, conversationsTable.productId))
    .where(eq(conversationsTable.id, id))
    .limit(1);
  return row ?? null;
}

router.get("/conversations", async (req, res) => {
  const user = currentUser(req);
  const rows = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .innerJoin(shopsTable, eq(shopsTable.id, conversationsTable.shopId))
    .where(
      or(
        eq(conversationsTable.customerId, user.id),
        eq(shopsTable.ownerId, user.id),
      ),
    )
    .orderBy(conversationsTable.updatedAt);
  const conversations = await Promise.all(
    rows.map((row) => conversationSummary(row.id, user.id)),
  );
  res.json(ListConversationsResponse.parse(conversations.filter(Boolean)));
});

router.post(
  "/conversations",
  writeLimiter,
  async (req, res) => {
    const user = currentUser(req);
    const body = parseInput(StartConversationBody, req.body);
    if (body.shopId < 1 || (body.productId != null && body.productId < 1)) {
      throw new HttpError(400, "Shop and product IDs must be positive integers.", "invalid_id");
    }
    const shop = await getPublicShop(body.shopId);
    if (!shop) throw new HttpError(404, "This shop is not currently available.", "shop_not_found");

    const [shopOwner] = await db
      .select({ ownerId: shopsTable.ownerId })
      .from(shopsTable)
      .where(eq(shopsTable.id, body.shopId))
      .limit(1);
    if (shopOwner?.ownerId === user.id) {
      throw new HttpError(400, "You cannot start a chat with your own shop.", "self_chat_not_allowed");
    }

    if (body.productId != null) {
      const [product] = await db
        .select({
          id: productsTable.id,
          shopId: productsTable.shopId,
          moderationStatus: productsTable.moderationStatus,
        })
        .from(productsTable)
        .where(eq(productsTable.id, body.productId))
        .limit(1);
      if (
        !product ||
        product.shopId !== body.shopId ||
        product.moderationStatus !== "visible"
      ) {
        throw new HttpError(404, "That product is not available at this shop.", "product_not_found");
      }
    }

    const productCondition =
      body.productId == null
        ? isNull(conversationsTable.productId)
        : eq(conversationsTable.productId, body.productId);
    let [conversation] = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.shopId, body.shopId),
          eq(conversationsTable.customerId, user.id),
          productCondition,
        ),
      )
      .limit(1);

    if (!conversation) {
      const [created] = await db
        .insert(conversationsTable)
        .values({
          shopId: body.shopId,
          customerId: user.id,
          productId: body.productId ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: conversationsTable.id });
      conversation = created;
    }
    if (!conversation) {
      [conversation] = await db
        .select({ id: conversationsTable.id })
        .from(conversationsTable)
        .where(
          and(
            eq(conversationsTable.shopId, body.shopId),
            eq(conversationsTable.customerId, user.id),
            productCondition,
          ),
        )
        .limit(1);
    }
    if (!conversation) throw new HttpError(500, "Unable to start this conversation.");

    const summary = await conversationSummary(conversation.id, user.id);
    if (!summary) throw new HttpError(500, "Unable to load this conversation.");
    res.status(201).json(StartConversationResponse.parse(summary));
  },
);

router.get(
  "/conversations/:conversationId/messages",
  async (req, res) => {
    const user = currentUser(req);
    const { conversationId } = parseInput(ListMessagesParams, req.params);
    await getParticipantConversation(conversationId, user.id);
    await db
      .update(messagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messagesTable.conversationId, conversationId),
          ne(messagesTable.senderId, user.id),
          isNull(messagesTable.readAt),
        ),
      );
    const rows = await db
      .select({
        id: messagesTable.id,
        conversationId: messagesTable.conversationId,
        senderId: messagesTable.senderId,
        senderName: usersTable.name,
        body: messagesTable.body,
        createdAt: messagesTable.createdAt,
        readAt: messagesTable.readAt,
      })
      .from(messagesTable)
      .innerJoin(usersTable, eq(usersTable.id, messagesTable.senderId))
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(asc(messagesTable.createdAt), asc(messagesTable.id))
      .limit(500);
    res.json(ListMessagesResponse.parse(rows));
  },
);

router.post(
  "/conversations/:conversationId/messages",
  writeLimiter,
  async (req, res) => {
    const user = currentUser(req);
    const { conversationId } = parseInput(SendMessageParams, req.params);
    const body = parseInput(SendMessageBody, req.body);
    const conversation = await getParticipantConversation(conversationId, user.id);
    const messageBody = cleanText(body.body);
    if (!messageBody) throw new HttpError(400, "Message cannot be empty.", "empty_message");

    const recipientId =
      conversation.customerId === user.id
        ? conversation.shopOwnerId
        : conversation.customerId;
    const [message] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(messagesTable)
        .values({
          conversationId,
          senderId: user.id,
          body: messageBody,
        })
        .returning();
      if (!created) throw new HttpError(500, "Unable to send the message.");
      await tx
        .update(conversationsTable)
        .set({ updatedAt: new Date() })
        .where(eq(conversationsTable.id, conversationId));
      await tx.insert(notificationsTable).values({
        userId: recipientId,
        title: "New NearLoop message",
        body: `${user.name}: ${messageBody.slice(0, 250)}`,
      });
      return [created];
    });

    res.status(201).json(
      SendMessageResponse.parse({
        ...message,
        senderName: user.name,
      }),
    );
  },
);

export default router;
