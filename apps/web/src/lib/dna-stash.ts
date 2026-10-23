// Carries a DNA string pasted on the home page into the upload form (survives the sign-up detour).

const KEY = 'helix:pending-dna';

export function stashDna(dna: string) {
	try {
		sessionStorage.setItem(KEY, dna);
	} catch {
		// storage unavailable; the user pastes again on the form
	}
}

export function takeStashedDna(): string | null {
	try {
		const dna = sessionStorage.getItem(KEY);
		sessionStorage.removeItem(KEY);
		return dna;
	} catch {
		return null;
	}
}
