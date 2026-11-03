import { loadJson, type Character, type CharacterDetail, type CharacterPage, type Collection } from '#lib/api.ts';
import type { PageLoad } from './$types';

/** Characters shown under "More from {uploader}". */
const FROM_UPLOADER = 5;

export const load: PageLoad = async ({ fetch, params }) => {
	const id = encodeURIComponent(params.id);
	// The extras are nice-to-haves: if one fails, the page still loads without it.
	const optional = <T>(path: string, fallback: T, read: (body: never) => T = (b) => b) =>
		fetch(path)
			.then(async (r) => (r.ok ? read(await r.json()) : fallback))
			.catch(() => fallback);
	const similar = optional<Character[]>(`/api/characters/${id}/similar`, []);
	const collections = optional<Collection[]>(`/api/collections?character=${id}`, []);
	const character = await loadJson<CharacterDetail>(fetch, `/api/characters/${id}`);
	// One extra, so there are still enough once this character is left out.
	const fromUploader = optional<Character[]>(
		`/api/characters?author=${encodeURIComponent(character.author_id)}&limit=${FROM_UPLOADER + 1}`,
		[],
		(body: CharacterPage) => body.page.filter((c) => c.id !== character.id).slice(0, FROM_UPLOADER)
	);
	return { character, similar: await similar, collections: await collections, fromUploader: await fromUploader };
};
