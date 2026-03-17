<script lang="ts">
	import type { ActionData } from './$types';
	import Button from '$lib/components/ui/button.svelte';

	let { form }: { form: ActionData } = $props();

	let loading = $state(false);
</script>

<svelte:head>
	<title>Shanks — Acceso</title>
</svelte:head>

<div class="flex h-screen items-center justify-center bg-background">
	<div class="w-full max-w-sm px-6">
		<div class="mb-8 text-center">
			<h1 class="text-2xl font-semibold text-foreground">Shanks</h1>
			<p class="mt-1 text-sm text-muted-foreground">Motor de predicción</p>
		</div>

		<form
			method="POST"
			class="space-y-4"
			onsubmit={() => {
				loading = true;
			}}
		>
			<div class="space-y-1.5">
				<label for="password" class="text-sm font-medium text-foreground">Contraseña</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					placeholder="••••••••"
					required
					class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				/>
			</div>

			{#if form?.error}
				<p class="text-sm text-destructive">{form.error}</p>
			{/if}

			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? 'Entrando…' : 'Entrar'}
			</Button>
		</form>
	</div>
</div>
