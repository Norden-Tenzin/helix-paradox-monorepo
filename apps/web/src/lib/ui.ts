// Shared class recipes. One button shape for the whole site: square corners, flat fill.

const buttonBase =
	'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,translate] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0';

const variants = {
	accent: 'bg-accent text-accent-ink hover:bg-ink',
	solid: 'bg-ink text-ground hover:bg-accent',
	quiet: 'bg-raised text-ink hover:bg-ink hover:text-ground',
	danger: 'bg-danger text-ground hover:bg-ink'
} as const;

const sizes = {
	md: 'h-12 px-6 text-body',
	sm: 'h-10 px-4 text-small'
} as const;

export function button(variant: keyof typeof variants = 'accent', size: keyof typeof sizes = 'md') {
	return `${buttonBase} ${variants[variant]} ${sizes[size]}`;
}

/** Form fields keep their own edge, as real inputs should. */
export const field =
	'block w-full bg-surface px-4 text-body text-ink placeholder:text-muted border border-raised transition-colors focus:border-accent focus:outline-none';

export const fieldLabel = 'block text-small text-muted mb-2';

export const menuContent = 'z-50 min-w-48 bg-raised p-2 text-ink shadow-2xl shadow-black/60'; // taste-skill-ignore: menus float

export const menuItem =
	'flex cursor-default select-none items-center gap-3 px-3 py-2.5 text-small outline-none data-highlighted:bg-ink data-highlighted:text-ground';

export const overlay = 'fixed inset-0 z-50 bg-black/80';

export const dialogContent =
	'fixed left-1/2 top-1/2 z-50 grid w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-6 bg-surface p-8 shadow-2xl shadow-black/60'; // taste-skill-ignore: dialogs float
