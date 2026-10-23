import type { Attachment } from 'svelte/attachments';

/**
 * Section entrance: marks each `[data-reveal]` child with its order (for the stagger) and
 * adds `.is-in` once the section scrolls into view. Without script, nothing is ever hidden.
 */
export const reveal: Attachment<HTMLElement> = (node) => {
	const parts = node.querySelectorAll<HTMLElement>('[data-reveal]');
	parts.forEach((part, i) => part.style.setProperty('--i', String(i)));

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				parts.forEach((part) => part.classList.add('is-in'));
				observer.disconnect();
			}
		},
		{ rootMargin: '0px 0px -12% 0px' }
	);
	observer.observe(node);
	return () => observer.disconnect();
};
