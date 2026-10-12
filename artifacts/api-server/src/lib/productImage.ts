import type { File } from "@google-cloud/storage";
import { HttpError, safeImageUrl } from "./http";
import { getSellerObject, setObjectAclPolicy } from "./objectStorage";

const IMAGE_ROUTE_PREFIX = "/api/storage/objects/";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export function parseSellerImagePath(value: string) {
  if (!value.startsWith(IMAGE_ROUTE_PREFIX)) return null;
  const relativePath = value.slice(IMAGE_ROUTE_PREFIX.length);
  const match = /^sellers\/(\d+)\/uploads\/([0-9a-f-]{36})$/i.exec(relativePath);
  if (!match) {
    throw new HttpError(400, "Choose a valid NearLoop product photo.", "invalid_image_path");
  }
  return { relativePath, ownerId: Number(match[1]) };
}

export async function validateImageFile(file: File) {
  const [metadata] = await file.getMetadata();
  const contentType = typeof metadata.contentType === "string"
    ? metadata.contentType.toLowerCase().split(";")[0].trim()
    : "";
  const size = Number(metadata.size);
  if (!ALLOWED_IMAGE_TYPES.has(contentType) || !Number.isFinite(size) || size < 1 || size > MAX_IMAGE_BYTES) {
    throw new HttpError(400, "Use a JPEG, PNG, WebP, or AVIF image up to 5 MB.", "invalid_image_file");
  }
  const [header] = await file.download({ start: 0, end: 15 });
  if (!hasImageSignature(contentType, header)) {
    throw new HttpError(400, "The uploaded file is not a supported image.", "invalid_image_content");
  }
  return { contentType, size };
}

function hasImageSignature(contentType: string, bytes: Buffer): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  }
  if (contentType === "image/avif") {
    return bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp" &&
      ["avif", "avis"].includes(bytes.toString("ascii", 8, 12));
  }
  return false;
}

export async function resolveProductImage(
  value: string | null | undefined,
  ownerId: number,
): Promise<string | null> {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const parsedPath = parseSellerImagePath(trimmed);
  if (!parsedPath) return safeImageUrl(trimmed);
  if (parsedPath.ownerId !== ownerId) {
    throw new HttpError(403, "You can only use photos uploaded by your own seller account.", "photo_owner_mismatch");
  }
  const file = await getSellerObject(ownerId, parsedPath.relativePath);
  await validateImageFile(file);
  await setObjectAclPolicy(file, { owner: String(ownerId), visibility: "public" });
  return trimmed;
}

