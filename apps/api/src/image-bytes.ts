// Works out what an uploaded image really is from its first bytes (the browser's `file.type` is
// whatever the sender says), and removes metadata such as EXIF (camera, GPS position, time) from
// it before it's stored. The upload page already re-encodes every image to WebP in the browser,
// which drops metadata too; this covers anything sent to the API directly.
//
// Only JPEG, PNG and WebP are accepted: they're what the upload page and screenshots produce, and
// they're simple enough to clean without an image library.

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);
const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

/** The image's real type from its magic number, or null if it isn't one we accept. */
export function sniffImage(b: Uint8Array): ImageType | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  return null;
}

/** The image without its metadata. Throws if the file is cut short or malformed. */
export function stripMetadata(b: Uint8Array, type: ImageType): Uint8Array {
  if (type === "image/jpeg") return stripJpeg(b);
  if (type === "image/png") return stripPng(b);
  return stripWebp(b);
}

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

class BadImage extends Error {}

// JPEG: a run of segments (FF xx, 2-byte length) up to the image data (SOS). Drops APP1 (EXIF
// and XMP), APP13 (IPTC / Photoshop) and comments; keeps APP0 (JFIF), APP2 (colour profile) and
// APP14 (Adobe colour transform), which change how the picture looks.
const JPEG_DROP = new Set([0xe1, 0xed, 0xfe]);

function stripJpeg(b: Uint8Array) {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let at = 2;
  while (at < b.length) {
    if (b[at] !== 0xff) throw new BadImage("Bad JPEG segment");
    let marker = b[at + 1];
    // Any number of 0xFF fill bytes may come before a marker.
    while (marker === 0xff) marker = b[++at + 1];
    if (marker === undefined) throw new BadImage("JPEG cut short");
    // Start of scan: everything from here on is image data.
    if (marker === 0xda) {
      parts.push(b.subarray(at));
      return concat(parts);
    }
    if (marker === 0xd9) break;
    const length = (b[at + 2] << 8) | b[at + 3];
    if (length < 2 || at + 2 + length > b.length) throw new BadImage("JPEG cut short");
    if (!JPEG_DROP.has(marker)) parts.push(b.subarray(at, at + 2 + length));
    at += 2 + length;
  }
  throw new BadImage("JPEG has no image data");
}

// PNG: an 8-byte signature, then chunks (4-byte length, 4-byte type, data, 4-byte CRC). Drops
// EXIF and the text and time chunks, which is where cameras and editors put metadata.
const PNG_DROP = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

function stripPng(b: Uint8Array) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let at = 8;
  while (at + 12 <= b.length) {
    const length = view.getUint32(at);
    const type = ascii(b, at + 4, 4);
    const end = at + 12 + length;
    if (end > b.length) throw new BadImage("PNG cut short");
    if (!PNG_DROP.has(type)) parts.push(b.subarray(at, end));
    at = end;
    if (type === "IEND") return concat(parts);
  }
  throw new BadImage("PNG has no end");
}

// WebP: a RIFF container of chunks (4-char id, 4-byte little-endian size, data padded to an even
// length). Drops the EXIF and XMP chunks, clears their flags in the VP8X header, and fixes the
// RIFF size.
function stripWebp(b: Uint8Array) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const parts: Uint8Array[] = [];
  let at = 12;
  while (at + 8 <= b.length) {
    const id = ascii(b, at, 4);
    const size = view.getUint32(at + 4, true);
    const end = at + 8 + size + (size & 1);
    if (at + 8 + size > b.length) throw new BadImage("WebP cut short");
    if (id === "VP8X") {
      const chunk = b.slice(at, Math.min(end, b.length));
      chunk[8] &= ~(0x08 | 0x04); // EXIF and XMP present
      parts.push(chunk);
    } else if (id !== "EXIF" && id !== "XMP ") {
      parts.push(b.subarray(at, Math.min(end, b.length)));
    }
    at = end;
  }
  if (parts.length === 0) throw new BadImage("WebP has no image data");
  const body = concat(parts);
  const header = new Uint8Array(12);
  header.set(b.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return concat([header, body]);
}
