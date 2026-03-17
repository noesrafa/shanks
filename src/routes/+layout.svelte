<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Onest:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
	<link rel="icon" href={favicon} />
	<title>Shanks</title>
</svelte:head>

<div class="app">
	{@render children()}
</div>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		font-family: 'Onest', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #000;
		color: #e7e9ea;
	}

	.app {
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
</style>
