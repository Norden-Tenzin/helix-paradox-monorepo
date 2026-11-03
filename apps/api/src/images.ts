import { sniffImage, stripMetadata, type ImageType } from "./image-bytes";

export const IMAGE_ROUTE = "/api/images/";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_GRID_IMAGES = 3;

const EXTENSIONS: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** An uploaded image, checked by its bytes and with its metadata removed, ready to store. */
export interface PreparedImage {
  bytes: Uint8Array;
  type: ImageType;
}

/** Legacy rows (e.g. imported from Firebase) store absolute URLs instead of R2 keys. */
export const isExternal = (value: string) => /^https?:\/\//.test(value);

export function imageUrl(value: string) {
  return isExternal(value) ? value : IMAGE_ROUTE + value;
}

/** Maps a URL we previously handed out back to the value stored in the database. */
export function toStoredValue(value: string) {
  return value.startsWith(IMAGE_ROUTE) ? value.slice(IMAGE_ROUTE.length) : value;
}

/**
 * Checks an upload is really a JPEG, PNG or WebP (by its first bytes, not the type the browser
 * claims) and strips its metadata. Returns an error message for anything else.
 */
export async function prepareImage(file: File): Promise<PreparedImage | string> {
  if (file.size > MAX_IMAGE_BYTES) return "Images must be 5MB or smaller";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return "Images must be JPEG, PNG or WebP";
  try {
    return { bytes: stripMetadata(bytes, type), type };
  } catch {
    return "That image looks damaged. Try saving it again.";
  }
}

export async function putImage(bucket: R2Bucket, characterId: string, image: PreparedImage) {
  const key = `characters/${characterId}/${crypto.randomUUID()}.${EXTENSIONS[image.type]}`;
  await bucket.put(key, image.bytes, {
    httpMetadata: { contentType: image.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return key;
}

/** Every stored image of a character, for deleting them all. */
export const imagesOf = (c: { displayImage: string; thumbImage: string | null; gridImages: string[] }) =>
  [c.displayImage, c.thumbImage, ...c.gridImages].filter((v): v is string => !!v);

export async function deleteImages(bucket: R2Bucket, values: string[]) {
  const keys = values.filter((v) => v && !isExternal(v));
  if (keys.length > 0) await bucket.delete(keys);
}
