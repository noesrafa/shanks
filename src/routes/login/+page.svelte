<script lang="ts">
	import type { ActionData } from './$types';
	import Button from '$lib/components/ui/button.svelte';
	import { Lock, LogIn, Loader2, AlertCircle } from 'lucide-svelte';

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
			<p class="mt-1 text-sm text-muted-foreground">Motor de prediccion</p>
		</div>

		<form
			method="POST"
			class="space-y-4"
			onsubmit={() => {
				loading = true;
			}}
		>
			<div class="space-y-1.5">
				<label for="password" class="text-sm font-medium text-foreground flex items-center gap-1.5">
					<Lock size={13} />
					Contrasena
				</label>
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
				<p class="text-sm text-destructive flex items-center gap-1.5">
					<AlertCircle size={13} />
					{form.error}
				</p>
			{/if}

			<Button type="submit" class="w-full" disabled={loading}>
				{#if loading}
					<Loader2 size={14} class="animate-spin" />
					Entrando...
				{:else}
					<LogIn size={14} />
					Entrar
				{/if}
			</Button>
		</form>
	</div>
</div>
