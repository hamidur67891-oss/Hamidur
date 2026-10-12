import { getAuth } from "@clerk/express";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import {
  getObjectAclPolicy,
  getObjectByRelativePath,
  createSellerUpload,
} from "../lib/objectStorage";
import { validateImageFile } from "../lib/productImage";
import { HttpError, parseInput } from "../lib/http";
import { getOrCreateLocalUser, currentUser, requireRole, requireUser } from "../middlewares/auth";
import { isPublicProductImage, requireSellerShop } from "../lib/marketplace";

const router = Router();
const uploadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.post(
  "/storage/uploads/request-url",
  uploadLimiter,
  requireUser,
  requireRole("seller"),
  async (req, res) => {
    const user = currentUser(req);
    await requireSellerShop(user.id);
    const input = parseInput(RequestUploadUrlBody, req.body);
    if (
      input.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(input.contentType)
    ) {
      throw new HttpError(400, "Use a JPEG, PNG, WebP, or AVIF image up to 5 MB.", "invalid_image_file");
    }
    const upload = await createSellerUpload(user.id);
    res.json(
      RequestUploadUrlResponse.parse({
        ...upload,
        metadata: input,
      }),
    );
  },
);

router.get("/storage/objects/*objectPath", async (req, res, next) => {
  try {
    const rawPath = req.params.objectPath;
    const relativePath = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
    const file = await getObjectByRelativePath(relativePath);
    const policy = await getObjectAclPolicy(file);
    const isPublic = policy?.visibility === "public" &&
      await isPublicProductImage(`/api/storage/objects/${relativePath}`);

    if (!isPublic) {
      const { userId } = getAuth(req);
      if (!userId) {
        throw new HttpError(403, "This photo is private.", "private_photo");
      }
      const user = await getOrCreateLocalUser(userId);
      const ownerId = Number(/^sellers\/(\d+)\//.exec(relativePath)?.[1]);
      if (
        !Number.isInteger(ownerId) ||
        ownerId !== user.id ||
        user.role !== "seller" ||
        user.status !== "active"
      ) {
        throw new HttpError(403, "This photo belongs to another seller.", "private_photo");
      }
    }

    const { contentType, size } = await validateImageFile(file);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(size));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", isPublic ? "public, max-age=300" : "private, no-store");
    file.createReadStream().on("error", next).pipe(res);
  } catch (error) {
    next(error);
  }
});

export default router;
