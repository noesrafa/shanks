<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		rows?: number;
		class?: string;
		oninput?: (e: Event) => void;
		onkeydown?: (e: KeyboardEvent) => void;
	}

	let {
		value = $bindable(''),
		placeholder = '',
		disabled = false,
		rows = 4,
		class: className = '',
		oninput,
		onkeydown
	}: Props = $props();
</script>

<textarea
	{placeholder}
	{disabled}
	{rows}
	{oninput}
	{onkeydown}
	bind:value
	class={cn(
		'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none',
		className
	)}
></textarea>
