import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, z, type ZodTypeAny } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = "request_error",
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function parseInput<Schema extends ZodTypeAny>(
  schema: Schema,
  value: unknown,
): z.infer<Schema> {
  try {
    return schema.parse(value) as z.infer<Schema>;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, "The request contains invalid fields.", "invalid_input");
    }
    throw error;
  }
}

export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePhone(value: string): string {
  const raw = value.trim();
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(digits)) {
    throw new HttpError(
      400,
      "Enter a phone number with 10–15 digits, including the country code when needed.",
      "invalid_phone",
    );
  }
  return `${hasPlus ? "+" : ""}${digits}`;
}

export function normalizeWhatsApp(value: string): string {
  const normalized = normalizePhone(value);
  const digits = normalized.replace(/\D/g, "");
  const nationalNumber = digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;
  if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
    throw new HttpError(
      400,
      "Enter a valid 10-digit Indian mobile number, optionally with +91.",
      "invalid_whatsapp",
    );
  }
  return `91${nationalNumber}`;
}

export function safeImageUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:") {
      throw new HttpError(400, "Product and shop image URLs must use HTTPS.", "invalid_image_url");
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Enter a valid HTTPS image URL.", "invalid_image_url");
  }
}

export const sameOriginWritesOnly: RequestHandler = (req, _res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    next(new HttpError(403, "Cross-site requests are not allowed.", "csrf_rejected"));
    return;
  }

  const origin = req.get("origin");
  if (!origin && fetchSite !== "same-origin") {
    next(new HttpError(403, "A same-origin browser request is required.", "csrf_rejected"));
    return;
  }
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
      const requestHost = (forwardedHost || req.get("host") || "").toLowerCase();
      if (!requestHost || originHost !== requestHost) {
        next(new HttpError(403, "This request did not come from the NearLoop app.", "csrf_rejected"));
        return;
      }
    } catch {
      next(new HttpError(403, "Invalid request origin.", "csrf_rejected"));
      return;
    }
  }
  next();
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.code, message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: "invalid_input", message: "The request contains invalid fields." });
    return;
  }

  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500
      ? error.status
      : 500;

  res.status(status).json({
    error: status === 500 ? "internal_error" : "request_error",
    message:
      status === 500
        ? "The request could not be completed."
        : "The request could not be completed.",
  });
};

