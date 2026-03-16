<script lang="ts">
	// --- Types ---
	interface Comment {
		id: number;
		content: string;
		userName: string;
		createdAt: string;
	}

	interface Post {
		id: number;
		userId: number;
		content: string;
		numLikes: number;
		createdAt: string;
		userName: string;
		userBio: string;
		comments: Comment[];
	}

	interface ActionResult {
		agent: string;
		action: string;
		post?: Post;
		postId?: number;
		comment?: string;
	}

	interface AgentCard {
		name: string;
		bio: string;
		interests: string[];
	}

	// --- State ---
	let currentStep = $state(1);
	let seedText = $state('');
	let requirement = $state('');

	// Step 2: agents (hardcoded for now, will be auto-generated in Sprint 6)
	const agents: AgentCard[] = [
		{
			name: 'Maya Chen',
			bio: 'AI researcher and coffee addict. Exploring the frontier of machine learning.',
			interests: ['AI', 'deep learning', 'coffee', 'hiking']
		},
		{
			name: 'Carlos Rivera',
			bio: 'Street photographer capturing urban stories. Based in Mexico City.',
			interests: ['photography', 'street art', 'travel', 'film']
		},
		{
			name: 'Priya Sharma',
			bio: 'Climate activist and environmental science student. Every action counts.',
			interests: ['climate', 'sustainability', 'renewable energy', 'veganism']
		},
		{
			name: 'Jordan Blake',
			bio: 'Indie game developer and retro computing enthusiast.',
			interests: ['game dev', 'pixel art', 'retro gaming', 'programming']
		},
		{
			name: 'Amara Osei',
			bio: 'Startup founder in fintech. Obsessed with financial inclusion across Africa.',
			interests: ['fintech', 'startups', 'Africa', 'mobile payments']
		}
	];

	// Step 3: simulation
	interface RoundSnapshot {
		round: number;
		actions: ActionResult[];
		posts: Post[];
	}

	let snapshots: RoundSnapshot[] = $state([]);
	let viewingRound = $state(0); // 0 = latest/live
	let totalRounds = $state(0);
	let loading = $state(false);
	let error = $state('');

	// Derived: which snapshot to display
	let displaySnapshot = $derived(
		viewingRound === 0 || snapshots.length === 0
			? snapshots[snapshots.length - 1]
			: snapshots[viewingRound - 1]
	);
	let displayPosts = $derived(displaySnapshot?.posts ?? []);
	let displayActions = $derived(displaySnapshot?.actions ?? []);
	let displayRound = $derived(displaySnapshot?.round ?? 0);
	let isLive = $derived(viewingRound === 0 || viewingRound === totalRounds);

	const steps = [
		{ num: 1, label: 'Seed' },
		{ num: 2, label: 'Agents' },
		{ num: 3, label: 'Simulate' },
		{ num: 4, label: 'Report' },
		{ num: 5, label: 'Chat' }
	];

	async function simulate() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/simulate', { method: 'POST' });
			const data = await res.json();
			if (data.error) {
				error = data.error;
			} else {
				totalRounds++;
				snapshots = [
					...snapshots,
					{
						round: totalRounds,
						actions: data.actions,
						posts: data.posts
					}
				];
				viewingRound = 0; // jump to live
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to connect';
		} finally {
			loading = false;
		}
	}

	function onSliderChange(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value);
		viewingRound = val;
	}

	function actionLabel(a: ActionResult): string {
		if (a.action === 'create_post') return `${a.agent} posted`;
		if (a.action === 'like_post') return `${a.agent} liked #${a.postId}`;
		if (a.action === 'create_comment') return `${a.agent} commented #${a.postId}`;
		if (a.action === 'follow') return `${a.agent} followed ${(a as any).target}`;
		return `${a.agent} idle`;
	}
</script>

<!-- Top bar -->
<header class="topbar">
	<div class="brand">SHANKS</div>
	<nav class="steps">
		{#each steps as step}
			<button
				class="step"
				class:active={currentStep === step.num}
				class:done={currentStep > step.num}
				onclick={() => (currentStep = step.num)}
			>
				<span class="step-num">{step.num}</span>
				{step.label}
			</button>
		{/each}
	</nav>
	<div class="spacer"></div>
</header>

<!-- Main content -->
<main class="content">
	{#if currentStep === 1}
		<!-- STEP 1: Seed material input -->
		<div class="step-panel centered">
			<div class="seed-form">
				<h2>Seed Material</h2>
				<p class="hint">Paste your source material (news article, policy document, market data, etc.) and describe what you want to predict.</p>

				<label>
					Source text
					<textarea
						bind:value={seedText}
						placeholder="Paste the article, document, or data you want to analyze..."
						rows="10"
					></textarea>
				</label>

				<label>
					Prediction question
					<input
						type="text"
						bind:value={requirement}
						placeholder="e.g. How will the public react to this policy change?"
					/>
				</label>

				<button class="primary" onclick={() => (currentStep = 2)}>
					Next: Generate Agents
				</button>
			</div>
		</div>

	{:else if currentStep === 2}
		<!-- STEP 2: Agents overview (like MiroFish environment setup) -->
		<div class="step-panel">
			<div class="agents-header">
				<h2>Agents</h2>
				<div class="agent-stats">
					<div class="stat">
						<span class="stat-num">{agents.length}</span>
						<span class="stat-label">Agents</span>
					</div>
					<div class="stat">
						<span class="stat-num">4</span>
						<span class="stat-label">Actions available</span>
					</div>
				</div>
			</div>

			<div class="agents-grid">
				{#each agents as agent}
					<div class="agent-card">
						<div class="agent-name">{agent.name}</div>
						<div class="agent-bio">{agent.bio}</div>
						<div class="agent-tags">
							{#each agent.interests as tag}
								<span class="tag">{tag}</span>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div class="step-actions">
				<button class="secondary" onclick={() => (currentStep = 1)}>Back</button>
				<button class="primary" onclick={() => (currentStep = 3)}>Next: Simulate</button>
			</div>
		</div>

	{:else if currentStep === 3}
		<!-- STEP 3: Simulation with timeline -->
		<div class="step-panel sim-layout">
			<div class="sim-sidebar">
				<h3>Controls</h3>
				<button class="primary full-width" onclick={simulate} disabled={loading}>
					{loading ? 'Running...' : `Run round ${totalRounds + 1}`}
				</button>

				<div class="sim-stats">
					<div class="stat-row">
						<span>Rounds</span>
						<strong>{totalRounds}</strong>
					</div>
					<div class="stat-row">
						<span>Posts</span>
						<strong>{displayPosts.length}</strong>
					</div>
					<div class="stat-row">
						<span>Agents</span>
						<strong>{agents.length}</strong>
					</div>
				</div>

				{#if totalRounds > 0}
					<h3>Timeline</h3>
					<div class="timeline">
						<input
							type="range"
							min="1"
							max={totalRounds}
							value={viewingRound === 0 ? totalRounds : viewingRound}
							oninput={onSliderChange}
							class="slider"
						/>
						<div class="timeline-labels">
							<span>Round 1</span>
							<span class="timeline-current">
								{#if isLive}
									Round {totalRounds} (live)
								{:else}
									Round {viewingRound}
								{/if}
							</span>
							<span>Round {totalRounds}</span>
						</div>
						{#if !isLive}
							<button class="live-btn" onclick={() => (viewingRound = 0)}>
								Jump to live
							</button>
						{/if}
					</div>
				{/if}

				{#if displayActions.length > 0}
					<h3>Round {displayRound} log</h3>
					<div class="action-list">
						{#each displayActions as a}
							<div class="action-item" class:like={a.action === 'like_post'} class:post={a.action === 'create_post'} class:comment={a.action === 'create_comment'} class:follow={a.action === 'follow'} class:nothing={a.action === 'do_nothing'}>
								{actionLabel(a)}
							</div>
						{/each}
					</div>
				{/if}

				{#if totalRounds > 1}
					<h3>All rounds</h3>
					<div class="rounds-list">
						{#each snapshots as snap}
							<button
								class="round-btn"
								class:active={displayRound === snap.round}
								onclick={() => (viewingRound = snap.round)}
							>
								<span class="round-num">R{snap.round}</span>
								<span class="round-summary">
									{snap.actions.filter((a) => a.action === 'create_post').length}p
									{snap.actions.filter((a) => a.action === 'like_post').length}l
									{snap.actions.filter((a) => a.action === 'create_comment').length}c
									{snap.actions.filter((a) => a.action === 'follow').length}f
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="sim-feed">
				{#if error}
					<div class="error">{error}</div>
				{/if}

				{#if !isLive && totalRounds > 0}
					<div class="viewing-past">
						Viewing round {viewingRound} of {totalRounds}
					</div>
				{/if}

				{#if displayPosts.length === 0}
					<div class="empty">No posts yet. Run the first round to start the simulation.</div>
				{/if}

				{#each displayPosts as post}
					<article class="post">
						<div class="post-header">
							<strong>{post.userName}</strong>
							<span class="bio">{post.userBio}</span>
						</div>
						<p class="post-content">{post.content}</p>
						<div class="post-footer">
							{#if post.numLikes > 0}
								<span class="likes">&hearts; {post.numLikes}</span>
							{/if}
							<time>{new Date(post.createdAt).toLocaleString()}</time>
						</div>

						{#if post.comments && post.comments.length > 0}
							<div class="comments">
								{#each post.comments as comment}
									<div class="comment">
										<strong>{comment.userName}</strong>
										<span>{comment.content}</span>
									</div>
								{/each}
							</div>
						{/if}
					</article>
				{/each}
			</div>
		</div>

	{:else if currentStep === 4}
		<!-- STEP 4: Report (placeholder) -->
		<div class="step-panel centered">
			<div class="placeholder">
				<h2>Prediction Report</h2>
				<p class="hint">After running the simulation, the ReportAgent will analyze agent behavior and generate a prediction report with cited agent statements.</p>
				<p class="hint">Coming in Sprint 8.</p>
			</div>
		</div>

	{:else if currentStep === 5}
		<!-- STEP 5: Chat (placeholder) -->
		<div class="step-panel centered">
			<div class="placeholder">
				<h2>Deep Interaction</h2>
				<p class="hint">Chat with the ReportAgent or interview individual agents about their decisions and reasoning.</p>
				<p class="hint">Coming in Sprint 9.</p>
			</div>
		</div>
	{/if}
</main>

<style>
	/* --- Top bar --- */
	.topbar {
		display: flex;
		align-items: center;
		padding: 0 20px;
		height: 48px;
		border-bottom: 1px solid #2f3336;
		flex-shrink: 0;
	}

	.brand {
		font-weight: 800;
		font-size: 16px;
		letter-spacing: 1px;
		margin-right: 32px;
	}

	.steps {
		display: flex;
		gap: 4px;
	}

	.step {
		background: none;
		border: 1px solid #2f3336;
		color: #71767b;
		padding: 6px 14px;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.step:hover {
		border-color: #536471;
		color: #e7e9ea;
	}

	.step.active {
		background: #1d9bf0;
		border-color: #1d9bf0;
		color: white;
	}

	.step.done {
		border-color: #00ba7c;
		color: #00ba7c;
	}

	.step-num {
		font-weight: 700;
		font-size: 11px;
	}

	.spacer {
		flex: 1;
	}

	/* --- Main content --- */
	.content {
		flex: 1;
		overflow: hidden;
	}

	.step-panel {
		height: 100%;
		overflow-y: auto;
		padding: 24px;
	}

	.step-panel.centered {
		display: flex;
		justify-content: center;
		padding-top: 60px;
	}

	/* --- Step 1: Seed --- */
	.seed-form {
		width: 100%;
		max-width: 640px;
	}

	.seed-form h2 {
		margin: 0 0 8px;
		font-size: 20px;
	}

	.hint {
		color: #71767b;
		font-size: 14px;
		margin: 0 0 24px;
		line-height: 1.4;
	}

	label {
		display: block;
		margin-bottom: 16px;
		font-size: 13px;
		color: #71767b;
		font-weight: 600;
	}

	textarea,
	input[type='text'] {
		display: block;
		width: 100%;
		margin-top: 6px;
		padding: 12px;
		background: #16181c;
		border: 1px solid #2f3336;
		border-radius: 8px;
		color: #e7e9ea;
		font-size: 14px;
		font-family: inherit;
		resize: vertical;
	}

	textarea:focus,
	input[type='text']:focus {
		outline: none;
		border-color: #1d9bf0;
	}

	/* --- Buttons --- */
	.primary {
		background: #1d9bf0;
		color: white;
		border: none;
		padding: 10px 24px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}

	.primary:hover:not(:disabled) {
		background: #1a8cd8;
	}

	.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.secondary {
		background: none;
		color: #e7e9ea;
		border: 1px solid #2f3336;
		padding: 10px 24px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.secondary:hover {
		border-color: #536471;
	}

	.full-width {
		width: 100%;
	}

	.step-actions {
		display: flex;
		gap: 12px;
		margin-top: 24px;
	}

	/* --- Step 2: Agents --- */
	.agents-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
	}

	.agents-header h2 {
		margin: 0;
		font-size: 20px;
	}

	.agent-stats {
		display: flex;
		gap: 24px;
	}

	.stat {
		text-align: center;
	}

	.stat-num {
		display: block;
		font-size: 24px;
		font-weight: 800;
	}

	.stat-label {
		font-size: 12px;
		color: #71767b;
	}

	.agents-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 12px;
	}

	.agent-card {
		background: #16181c;
		border: 1px solid #2f3336;
		border-radius: 10px;
		padding: 16px;
	}

	.agent-name {
		font-weight: 700;
		font-size: 15px;
		margin-bottom: 4px;
	}

	.agent-bio {
		color: #71767b;
		font-size: 13px;
		margin-bottom: 10px;
		line-height: 1.3;
	}

	.agent-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tag {
		background: #1d3a5c;
		color: #1d9bf0;
		padding: 2px 10px;
		border-radius: 12px;
		font-size: 12px;
	}

	/* --- Step 3: Simulation layout --- */
	.sim-layout {
		display: flex;
		gap: 0;
		padding: 0;
	}

	.sim-sidebar {
		width: 260px;
		flex-shrink: 0;
		padding: 20px;
		border-right: 1px solid #2f3336;
		overflow-y: auto;
	}

	.sim-sidebar h3 {
		margin: 0 0 12px;
		font-size: 14px;
		color: #71767b;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.sim-stats {
		margin-top: 20px;
		margin-bottom: 20px;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		padding: 8px 0;
		font-size: 14px;
		border-bottom: 1px solid #2f3336;
	}

	.stat-row span {
		color: #71767b;
	}

	.action-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.action-item {
		padding: 6px 10px;
		border-radius: 6px;
		font-size: 12px;
		background: #2f3336;
		color: #71767b;
	}

	.action-item.post {
		background: #1d3a5c;
		color: #1d9bf0;
	}

	.action-item.like {
		background: #3d1f2e;
		color: #f91880;
	}

	.action-item.comment {
		background: #1a3a2a;
		color: #00ba7c;
	}

	.action-item.follow {
		background: #2a1a3a;
		color: #a970ff;
	}

	/* --- Timeline --- */
	.timeline {
		margin-bottom: 20px;
	}

	.slider {
		width: 100%;
		height: 4px;
		appearance: none;
		background: #2f3336;
		border-radius: 2px;
		outline: none;
		cursor: pointer;
	}

	.slider::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #1d9bf0;
		cursor: pointer;
	}

	.timeline-labels {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: #71767b;
		margin-top: 4px;
	}

	.timeline-current {
		color: #1d9bf0;
		font-weight: 600;
	}

	.live-btn {
		width: 100%;
		margin-top: 8px;
		padding: 6px;
		background: none;
		border: 1px solid #1d9bf0;
		color: #1d9bf0;
		border-radius: 6px;
		font-size: 12px;
		cursor: pointer;
	}

	.live-btn:hover {
		background: #1d3a5c;
	}

	.rounds-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.round-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		background: none;
		border: 1px solid #2f3336;
		border-radius: 6px;
		color: #e7e9ea;
		font-size: 12px;
		cursor: pointer;
		text-align: left;
	}

	.round-btn:hover {
		border-color: #536471;
	}

	.round-btn.active {
		border-color: #1d9bf0;
		background: #1d3a5c;
	}

	.round-num {
		font-weight: 700;
		min-width: 24px;
	}

	.round-summary {
		color: #71767b;
	}

	.viewing-past {
		background: #1d3a5c;
		color: #1d9bf0;
		padding: 8px 20px;
		font-size: 13px;
		text-align: center;
		font-weight: 600;
	}

	.sim-feed {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	.empty {
		padding: 40px;
		text-align: center;
		color: #71767b;
		font-size: 14px;
	}

	.error {
		background: #67000d;
		color: #ff6b6b;
		padding: 12px;
		margin: 12px;
		border-radius: 8px;
		font-size: 14px;
	}

	/* --- Posts --- */
	.post {
		padding: 16px 20px;
		border-bottom: 1px solid #2f3336;
	}

	.post-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 6px;
	}

	.post-header strong {
		font-size: 14px;
	}

	.bio {
		color: #71767b;
		font-size: 12px;
	}

	.post-content {
		margin: 0 0 8px;
		font-size: 14px;
		line-height: 1.4;
	}

	.post-footer {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.likes {
		color: #f91880;
		font-size: 13px;
	}

	time {
		color: #71767b;
		font-size: 12px;
	}

	.comments {
		margin-top: 10px;
		padding-left: 14px;
		border-left: 2px solid #2f3336;
	}

	.comment {
		padding: 6px 0;
		font-size: 13px;
		line-height: 1.3;
	}

	.comment strong {
		color: #e7e9ea;
		margin-right: 6px;
		font-size: 12px;
	}

	.comment span {
		color: #d6d9db;
	}

	/* --- Placeholder --- */
	.placeholder {
		max-width: 480px;
		text-align: center;
	}

	.placeholder h2 {
		margin: 0 0 12px;
		font-size: 20px;
	}
</style>
