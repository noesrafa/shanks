<script lang="ts">
	interface Post {
		id: number;
		userId: number;
		content: string;
		createdAt: string;
		userName: string;
		userBio: string;
	}

	let posts: Post[] = $state([]);
	let loading = $state(false);
	let error = $state('');

	async function simulate() {
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/simulate', { method: 'POST' });
			const data = await res.json();

			if (data.error) {
				error = data.error;
			} else {
				posts = [...data.posts, ...posts];
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to connect';
		} finally {
			loading = false;
		}
	}
</script>

<div class="container">
	<header>
		<h1>Oasis Mini</h1>
		<p class="subtitle">Social simulation with LLM agents</p>
		<button onclick={simulate} disabled={loading}>
			{loading ? 'Simulating...' : 'Simular'}
		</button>
	</header>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="feed">
		{#each posts as post}
			<article class="post">
				<div class="post-header">
					<strong>{post.userName}</strong>
					<span class="bio">{post.userBio}</span>
				</div>
				<p class="content">{post.content}</p>
				<time>{new Date(post.createdAt).toLocaleString()}</time>
			</article>
		{/each}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #000;
		color: #e7e9ea;
	}

	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: 20px;
	}

	header {
		text-align: center;
		margin-bottom: 24px;
		padding-bottom: 16px;
		border-bottom: 1px solid #2f3336;
	}

	h1 {
		margin: 0 0 4px;
		font-size: 24px;
	}

	.subtitle {
		color: #71767b;
		margin: 0 0 16px;
		font-size: 14px;
	}

	button {
		background: #1d9bf0;
		color: white;
		border: none;
		padding: 10px 24px;
		border-radius: 20px;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: #1a8cd8;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error {
		background: #67000d;
		color: #ff6b6b;
		padding: 12px;
		border-radius: 8px;
		margin-bottom: 16px;
		font-size: 14px;
	}

	.feed {
		display: flex;
		flex-direction: column;
	}

	.post {
		padding: 16px;
		border-bottom: 1px solid #2f3336;
	}

	.post-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 8px;
	}

	.post-header strong {
		font-size: 15px;
	}

	.bio {
		color: #71767b;
		font-size: 13px;
	}

	.content {
		margin: 0 0 8px;
		font-size: 15px;
		line-height: 1.4;
	}

	time {
		color: #71767b;
		font-size: 13px;
	}
</style>
