<script lang="ts">
	import { themeStore, type Theme } from '$lib/stores/theme.svelte';
	import { cn } from '$lib/utils';
	import { Sun, Monitor, Moon } from 'lucide-svelte';

	const options: { value: Theme; label: string; icon: typeof Sun }[] = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'auto', label: 'Auto', icon: Monitor },
		{ value: 'dark', label: 'Dark', icon: Moon }
	];
</script>

<div class="flex items-center gap-0.5 rounded-md border border-border p-0.5">
	{#each options as option}
		<button
			onclick={() => themeStore.set(option.value)}
			title={option.label}
			class={cn(
				'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
				themeStore.current === option.value
					? 'bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:text-foreground hover:bg-accent'
			)}
		>
			<option.icon size={14} />
			<span class="hidden sm:inline">{option.label}</span>
		</button>
	{/each}
</div>
