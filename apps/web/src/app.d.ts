// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Me } from 'api/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: Me | null;
		}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
