<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
		type?: string;
		onkeydown?: (e: KeyboardEvent) => void;
		oninput?: (e: Event) => void;
	}

	let {
		value = $bindable(''),
		placeholder = '',
		disabled = false,
		class: className = '',
		type = 'text',
		onkeydown,
		oninput
	}: Props = $props();
</script>

<input
	{type}
	{placeholder}
	{disabled}
	{onkeydown}
	{oninput}
	bind:value
	class={cn(
		'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
/>
