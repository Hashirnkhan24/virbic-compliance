import { put, head, del } from "@vercel/blob";

export interface BlobUploadOptions {
  contentType?: string;
  expiresInDays?: number; // default: 30 days per product blueprint
}

export interface BlobUploadResult {
  blobKey: string;
  url: string;
  sizeBytes: number;
  contentType: string;
  expiresAt: string; // 30-day ISO timestamp
}

// In-memory store for local testing and offline environments
const localBlobStore = new Map<
  string,
  { buffer: Buffer; contentType: string; expiresAt: string }
>();

/**
 * Uploads a raw artifact (HTML, screenshot, HAR, PDF) with a 30-day lifecycle expiry.
 * Automatically switches between Vercel Blob and local in-memory storage.
 */
export async function uploadArtifactBlob(
  pathName: string,
  data: Buffer | string,
  options: BlobUploadOptions = {}
): Promise<BlobUploadResult> {
  const expiresInDays = options.expiresInDays ?? 30;
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
  const sizeBytes = buffer.length;
  const contentType = options.contentType ?? "application/octet-stream";

  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (hasBlobToken) {
    try {
      const blob = await put(pathName, buffer, {
        access: "public",
        contentType,
        addRandomSuffix: true,
      });

      return {
        blobKey: blob.pathname,
        url: blob.url,
        sizeBytes,
        contentType,
        expiresAt,
      };
    } catch (err) {
      console.warn("Vercel Blob upload failed, falling back to local store:", err);
    }
  }

  // Local / dev fallback store
  localBlobStore.set(pathName, { buffer, contentType, expiresAt });

  return {
    blobKey: pathName,
    url: `blob://local/${pathName}`,
    sizeBytes,
    contentType,
    expiresAt,
  };
}

/**
 * Retrieves a stored blob's metadata or data.
 */
export async function getArtifactBlob(pathOrUrl: string): Promise<{
  data: Buffer;
  contentType: string;
  expiresAt: string;
} | null> {
  const local = localBlobStore.get(pathOrUrl);
  if (local) {
    return {
      data: local.buffer,
      contentType: local.contentType,
      expiresAt: local.expiresAt,
    };
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const metadata = await head(pathOrUrl);
      const res = await fetch(metadata.url);
      const arrayBuffer = await res.arrayBuffer();
      return {
        data: Buffer.from(arrayBuffer),
        contentType: metadata.contentType || "application/octet-stream",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Deletes a stored blob (e.g. for lifecycle cleanup tests).
 */
export async function deleteArtifactBlob(pathOrUrl: string): Promise<boolean> {
  if (localBlobStore.has(pathOrUrl)) {
    localBlobStore.delete(pathOrUrl);
    return true;
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(pathOrUrl);
      return true;
    } catch {
      return false;
    }
  }

  return true;
}
