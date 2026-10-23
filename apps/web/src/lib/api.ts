import { error } from '@sveltejs/kit';

export type { Character, CharacterPage, Me, PublicUser, Sex, Sort } from 'api/types';
export { MODS } from 'api/types';

/** Reads the `{ error }` body the API sends on failure. */
export async function apiErrorMessage(response: Response) {
	try {
		const body: { error?: unknown } = await response.json();
		if (typeof body?.error === 'string') return body.error;
	} catch {
		// not JSON
	}
	return `Request failed (${response.status})`;
}

/** Fetches JSON from the API inside a load function, turning failures into SvelteKit errors. */
export async function loadJson<T>(fetch: typeof globalThis.fetch, path: string): Promise<T> {
	const response = await fetch(path);
	if (!response.ok) error(response.status, await apiErrorMessage(response));
	return response.json();
}
