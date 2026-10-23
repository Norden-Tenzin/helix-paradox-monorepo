// Tailwind class recipes shared across components (stand-ins for the old shadcn/ui primitives).

const buttonBase =
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xs text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';

const variants = {
	default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
	secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
	ghost: 'hover:bg-accent hover:text-accent-foreground',
	destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90'
} as const;

const sizes = {
	default: 'h-9 px-4 py-2',
	sm: 'h-8 px-3 text-xs',
	icon: 'h-9 w-9'
} as const;

export function button(variant: keyof typeof variants = 'default', size: keyof typeof sizes = 'default') {
	return `${buttonBase} ${variants[variant]} ${sizes[size]}`;
}

export const input =
	'flex w-full rounded-xs border border-input bg-secondary px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50';

export const label = 'text-xs font-mono font-bold uppercase tracking-widest';

export const menuContent =
	'z-50 min-w-32 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md';

export const menuItem =
	'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50';

export const overlay = 'fixed inset-0 z-50 bg-black/80';

export const dialogContent =
	'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-card p-6 shadow-lg sm:rounded-lg';
