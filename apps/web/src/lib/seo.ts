// Characters that could end the script element, start an HTML entity, or (in old parsers) end a
// JavaScript line, each replaced by its JSON \u escape, which reads back as the same text.
const UNSAFE = new RegExp('[<>&\\u2028\\u2029]', 'g');
const escapeChar = (ch: string) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');

/**
 * Structured data for search engines, as a <script type="application/ld+json"> element. Text
 * people typed (names, descriptions, tags) can't break out of it.
 */
export function jsonLd(data: unknown) {
	return `<script type="application/ld+json">${JSON.stringify(data).replace(UNSAFE, escapeChar)}</script>`;
}
