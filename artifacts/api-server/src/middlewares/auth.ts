import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, shopsTable, shopApplicationsTable, usersTable } from "@workspace/db";
import type { User } from "@workspace/db";
import { HttpError } from "../lib/http";

declare global {
  namespace Express {
    interface Request {
      nearloopUser?: User;
    }
  }
}

function configuredAdmins(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getOrCreateLocalUser(clerkUserId: string): Promise<User> {
  const identity = await clerkClient.users.getUser(clerkUserId);
  const emailAddress =
    identity.emailAddresses.find(
      (item) =>
        item.id === identity.primaryEmailAddressId &&
        item.verification?.status === "verified",
    ) ??
    identity.emailAddresses.find((item) => item.verification?.status === "verified");

  if (!emailAddress?.emailAddress) {
    throw new HttpError(403, "Verify an email address with your sign-in provider before using NearLoop.", "verified_email_required");
  }

  const email = emailAddress.emailAddress.trim().toLowerCase();
  const identityName = identity.fullName?.trim() || email.split("@")[0] || "NearLoop user";
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .limit(1);

  const isConfiguredAdmin = configuredAdmins().has(email);
  let role: User["role"] = "customer";
  if (isConfiguredAdmin) {
    role = "admin";
  } else if (existing?.role === "admin") {
    const hasShop = await db
      .select({ id: shopsTable.id })
      .from(shopsTable)
      .where(eq(shopsTable.ownerId, existing.id))
      .limit(1);
    const hasApplication = await db
      .select({ id: shopApplicationsTable.id })
      .from(shopApplicationsTable)
      .where(eq(shopApplicationsTable.userId, existing.id))
      .limit(1);
    role = hasShop.length || hasApplication.length ? "seller" : "customer";
  } else {
    role = existing?.role ?? "customer";
  }

  if (!existing) {
    const [created] = await db
      .insert(usersTable)
      .values({
        clerkUserId,
        email,
        name: identityName,
        role,
      })
      .returning();
    if (!created) throw new HttpError(500, "Unable to create your account profile.", "profile_unavailable");
    return created;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ email, role, updatedAt: new Date() })
    .where(eq(usersTable.id, existing.id))
    .returning();
  if (!updated) throw new HttpError(500, "Unable to load your account profile.", "profile_unavailable");
  return updated;
}

export const requireUser: RequestHandler = async (req, _res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      next(new HttpError(401, "Sign in to continue.", "authentication_required"));
      return;
    }
    req.nearloopUser = await getOrCreateLocalUser(userId);
    if (req.nearloopUser.status !== "active") {
      next(new HttpError(403, "This account is currently suspended.", "account_suspended"));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...roles: User["role"][]): RequestHandler {
  return (req, _res, next) => {
    if (!req.nearloopUser) {
      next(new HttpError(401, "Sign in to continue.", "authentication_required"));
      return;
    }
    if (!roles.includes(req.nearloopUser.role)) {
      next(new HttpError(403, "You do not have permission to access this resource.", "permission_denied"));
      return;
    }
    next();
  };
}

export function currentUser(req: Express.Request): User {
  if (!req.nearloopUser) {
    throw new HttpError(401, "Sign in to continue.", "authentication_required");
  }
  return req.nearloopUser;
}
