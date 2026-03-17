<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		variant?: 'default' | 'secondary' | 'destructive' | 'success' | 'outline';
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { variant = 'default', class: className = '', children }: Props = $props();

	const variants: Record<string, string> = {
		default: 'bg-primary/15 text-primary border-transparent',
		secondary: 'bg-secondary text-secondary-foreground border-transparent',
		destructive: 'bg-destructive/15 text-destructive border-transparent',
		success: 'bg-success/15 text-success border-transparent',
		outline: 'text-foreground border-border'
	};
</script>

<span
	class={cn(
		'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
		variants[variant],
		className
	)}
>
	{@render children?.()}
</span>
