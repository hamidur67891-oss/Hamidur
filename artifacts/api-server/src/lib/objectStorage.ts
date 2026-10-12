import { randomUUID } from "node:crypto";
import { Storage, type File } from "@google-cloud/storage";
import { HttpError } from "./http";

const SIDECAR = "http://127.0.0.1:1106";
const ACL_METADATA_KEY = "custom:aclPolicy";
const client = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

function privateObjectDir(): string {
  const value = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!value) throw new Error("Private object storage is not configured.");
  return value.replace(/\/+$/, "");
}

function parseBucketPath(value: string) {
  const normalized = value.startsWith("/") ? value : `/${value}`;
  const [, bucketName, ...objectParts] = normalized.split("/");
  const objectName = objectParts.join("/");
  if (!bucketName || !objectName) throw new Error("Invalid object storage path.");
  return { bucketName, objectName };
}

export async function createSellerUpload(ownerId: number) {
  const objectName = `sellers/${ownerId}/uploads/${randomUUID()}`;
  const { bucketName, objectName: bucketObjectName } = parseBucketPath(
    `${privateObjectDir()}/${objectName}`,
  );
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const signedResponse = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: bucketObjectName,
      method: "PUT",
      expires_at: expiresAt,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!signedResponse.ok) {
    throw new HttpError(503, "Photo storage is temporarily unavailable.", "storage_unavailable");
  }
  const result = (await signedResponse.json()) as { signed_url?: unknown };
  if (typeof result.signed_url !== "string") {
    throw new HttpError(503, "Photo storage could not create an upload URL.", "storage_unavailable");
  }
  return {
    uploadURL: result.signed_url,
    objectPath: `/objects/${objectName}`,
  };
}

export async function getSellerObject(ownerId: number, relativePath: string): Promise<File> {
  const match = /^sellers\/(\d+)\/uploads\/([0-9a-f-]{36})$/i.exec(relativePath);
  if (!match || Number(match[1]) !== ownerId) {
    throw new HttpError(403, "This photo does not belong to your seller account.", "photo_owner_mismatch");
  }
  const { bucketName, objectName } = parseBucketPath(
    `${privateObjectDir()}/${relativePath}`,
  );
  const file = client.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) throw new HttpError(404, "The uploaded photo was not found.", "photo_not_found");
  return file;
}

export async function getObjectByRelativePath(relativePath: string): Promise<File> {
  if (!/^sellers\/\d+\/uploads\/[0-9a-f-]{36}$/i.test(relativePath)) {
    throw new HttpError(404, "The photo was not found.", "photo_not_found");
  }
  const { bucketName, objectName } = parseBucketPath(
    `${privateObjectDir()}/${relativePath}`,
  );
  const file = client.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) throw new HttpError(404, "The photo was not found.", "photo_not_found");
  return file;
}

export async function getObjectAclPolicy(file: File): Promise<ObjectAclPolicy | null> {
  const [metadata] = await file.getMetadata();
  const rawPolicy = metadata.metadata?.[ACL_METADATA_KEY];
  if (typeof rawPolicy !== "string") return null;
  try {
    const policy = JSON.parse(rawPolicy) as Partial<ObjectAclPolicy>;
    if (
      typeof policy.owner === "string" &&
      (policy.visibility === "public" || policy.visibility === "private")
    ) {
      return { owner: policy.owner, visibility: policy.visibility };
    }
  } catch {
    // Malformed ACL metadata is treated as private.
  }
  return null;
}

export async function setObjectAclPolicy(file: File, policy: ObjectAclPolicy) {
  const [metadata] = await file.getMetadata();
  await file.setMetadata({
    metadata: {
      ...(metadata.metadata ?? {}),
      [ACL_METADATA_KEY]: JSON.stringify(policy),
    },
  });
}

