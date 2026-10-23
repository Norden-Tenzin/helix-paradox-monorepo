export const IMAGE_ROUTE = "/api/images/";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_GRID_IMAGES = 3;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** Legacy rows (e.g. imported from Firebase) store absolute URLs instead of R2 keys. */
export const isExternal = (value: string) => /^https?:\/\//.test(value);

export function imageUrl(value: string) {
  return isExternal(value) ? value : IMAGE_ROUTE + value;
}

/** Maps a URL we previously handed out back to the value stored in the database. */
export function toStoredValue(value: string) {
  return value.startsWith(IMAGE_ROUTE) ? value.slice(IMAGE_ROUTE.length) : value;
}

export function validateImage(file: File): string | null {
  if (!EXTENSIONS[file.type]) return `Unsupported image type: ${file.type || "unknown"}`;
  if (file.size > MAX_IMAGE_BYTES) return "Images must be 5MB or smaller";
  return null;
}

export async function putImage(bucket: R2Bucket, characterId: string, file: File) {
  const key = `characters/${characterId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return key;
}

export async function deleteImages(bucket: R2Bucket, values: string[]) {
  const keys = values.filter((v) => v && !isExternal(v));
  if (keys.length > 0) await bucket.delete(keys);
}
