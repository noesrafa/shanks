<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'success' | 'outline';
		size?: 'sm' | 'md' | 'lg' | 'icon';
		disabled?: boolean;
		class?: string;
		onclick?: (e: MouseEvent) => void;
		type?: 'button' | 'submit' | 'reset';
		children?: import('svelte').Snippet;
	}

	let {
		variant = 'default',
		size = 'md',
		disabled = false,
		class: className = '',
		onclick,
		type = 'button',
		children
	}: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

	const variants: Record<string, string> = {
		default: 'bg-primary text-primary-foreground hover:bg-primary/90',
		secondary: 'bg-transparent border border-border text-foreground hover:border-muted-foreground',
		ghost: 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent',
		destructive: 'bg-transparent border border-border text-foreground hover:border-destructive hover:text-destructive',
		success: 'bg-success text-success-foreground hover:bg-success/90',
		outline: 'border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground'
	};

	const sizes: Record<string, string> = {
		sm: 'h-7 rounded-md px-3 text-xs',
		md: 'h-8 rounded-md px-3.5 text-sm',
		lg: 'h-10 rounded-lg px-5 text-sm',
		icon: 'h-8 w-8 rounded-md'
	};
</script>

<button
	{type}
	{disabled}
	class={cn(base, variants[variant], sizes[size], className)}
	{onclick}
>
	{@render children?.()}
</button>
