// How tag names are cleaned and matched. Shared with the web app ("api/tag-names") so the tag
// box treats "Norse saga" and "norse-saga" as one tag exactly as the API will.

/** Tags a character can carry, and how long one can be. */
export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 30;

/** "  norse   SAGA! " → "norse SAGA": trimmed, single-spaced, without characters that aren't words. */
export const cleanTagName = (name: string) =>
  name
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}' -]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TAG_LENGTH);

/** "Norse saga", "norse-saga", "NORSE  SAGA" → "norse-saga": one tag, however it's typed. */
export const tagSlug = (name: string) =>
  cleanTagName(name)
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");
