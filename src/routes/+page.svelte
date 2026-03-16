<script lang="ts">
	interface Post {
		id: number;
		userId: number;
		content: string;
		numLikes: number;
		createdAt: string;
		userName: string;
		userBio: string;
	}

	interface ActionResult {
		agent: string;
		action: string;
		post?: Post;
		postId?: number;
	}

	let posts: Post[] = $state([]);
	let lastActions: ActionResult[] = $state([]);
	let round = $state(0);
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
				posts = data.posts;
				lastActions = data.actions;
				round++;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to connect';
		} finally {
			loading = false;
		}
	}

	function actionLabel(a: ActionResult): string {
		if (a.action === 'create_post') return `${a.agent} wrote a new post`;
		if (a.action === 'like_post') return `${a.agent} liked post #${a.postId}`;
		return `${a.agent} did nothing`;
	}
</script>

<div class="container">
	<header>
		<h1>Shanks</h1>
		<p class="subtitle">Prediction engine with LLM agents</p>
		<button onclick={simulate} disabled={loading}>
			{loading ? 'Simulating...' : `Simular ronda ${round + 1}`}
		</button>
	</header>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if lastActions.length > 0}
		<div class="actions-log">
			<strong>Round {round}:</strong>
			{#each lastActions as a}
				<span class="action-chip" class:like={a.action === 'like_post'} class:post={a.action === 'create_post'} class:nothing={a.action === 'do_nothing'}>
					{actionLabel(a)}
				</span>
			{/each}
		</div>
	{/if}

	<div class="feed">
		{#each posts as post}
			<article class="post">
				<div class="post-header">
					<strong>{post.userName}</strong>
					<span class="bio">{post.userBio}</span>
				</div>
				<p class="content">{post.content}</p>
				<div class="post-footer">
					{#if post.numLikes > 0}
						<span class="likes">&hearts; {post.numLikes}</span>
					{/if}
					<time>{new Date(post.createdAt).toLocaleString()}</time>
				</div>
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

	.actions-log {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		padding: 12px;
		margin-bottom: 16px;
		border: 1px solid #2f3336;
		border-radius: 8px;
		font-size: 13px;
	}

	.action-chip {
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 12px;
	}

	.action-chip.post {
		background: #1d3a5c;
		color: #1d9bf0;
	}

	.action-chip.like {
		background: #3d1f2e;
		color: #f91880;
	}

	.action-chip.nothing {
		background: #2f3336;
		color: #71767b;
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

	.post-footer {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.likes {
		color: #f91880;
		font-size: 14px;
	}

	time {
		color: #71767b;
		font-size: 13px;
	}
</style>
