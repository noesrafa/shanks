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

	interface GraphNode {
		id: number;
		name: string;
		entityType: string;
		summary: string;
		attributes: Record<string, string>;
	}

	interface GraphEdge {
		id: number;
		sourceNodeId: number;
		targetNodeId: number;
		edgeType: string;
		fact: string;
	}

	// --- Templates ---
	const templates = [
		{
			name: 'AI Regulation War',
			requirement: 'How will the conflict between federal and state AI regulation play out? Which stakeholders will gain or lose influence?',
			seed: `The battle over AI regulation in the United States is intensifying in 2026. On December 11, 2025, President Trump signed an executive order aiming to establish a national AI framework and challenge state AI laws deemed "overly burdensome." The White House directs the Department of Justice to create an AI litigation task force to challenge state laws on grounds of unconstitutional regulation of interstate commerce and federal preemption.

California has enacted the most aggressive state-level AI regulations, including the AI Safety Act, training data transparency requirements, and prohibitions on anticompetitive common pricing algorithms. The California Government Operations Agency administers CalCompute, a public AI cloud consortium. California also blocks unlicensed AI from providing therapy.

New York is pursuing comprehensive AI oversight through the RAISE Act, which targets high-cost AI developers with safety mandates, requires synthetic performer disclosures, and expands automated decision-making oversight. Governor Hochul is reviewing pending AI legislation.

Colorado delayed its comprehensive AI law to June 30, 2026, with requirements facing potential federal preemption challenges. Illinois and Utah restrict unlicensed AI from providing psychological services and mandate disclosures for AI companion interactions.

Meanwhile, the European Commission is considering delays to the EU AI Act implementation, under pressure from U.S. tech companies and EU Member States citing readiness concerns.

Leading the Future, a super PAC backed by OpenAI president Greg Brockman and venture capital firm Andreessen Horowitz, plans to elect candidates who endorse unfettered AI development. Public First funds counter-PACs backing candidates advocating for AI regulation.

Google and Character Technologies settled lawsuits with families of teenagers who killed themselves after interacting with Character.AI chatbots. The Kentucky attorney general sued Character Technologies. OpenAI and Meta face similar lawsuits regarding chatbot safety.

Tech companies argue that a patchwork of state laws will smother innovation and weaken the US position in the AI arms race against China. Safety advocates counter that federal inaction leaves vulnerable populations unprotected, particularly children and workers displaced by automated decision-making.`
		},
		{
			name: 'Crypto Market Crash',
			requirement: 'How will different market participants react and what narratives will dominate public discourse?',
			seed: `A major cryptocurrency exchange, NovaCoin Exchange, collapsed in March 2026 after revelations that its CEO Marcus Webb had been using customer deposits to fund risky leveraged trades. Over $4.2 billion in customer funds are frozen. The SEC, led by Chairman Gary Gensler's successor Paul Atkins, faces criticism for failing to prevent the collapse despite multiple whistleblower complaints filed since 2024.

Senator Elizabeth Warren called for immediate emergency legislation to regulate crypto exchanges as traditional financial institutions. Senator Cynthia Lummis, co-author of the Responsible Financial Innovation Act, argues existing frameworks were sufficient but unenforced.

Coinbase CEO Brian Armstrong publicly distanced his company from NovaCoin, emphasizing Coinbase's proof-of-reserves audits. Binance's Richard Teng offered to acquire NovaCoin's remaining assets. Tether issued a statement denying exposure to NovaCoin.

The Bitcoin price dropped 35% in 48 hours. MicroStrategy's Michael Saylor posted "Bitcoin is not NovaCoin" and announced additional BTC purchases. ARK Invest's Cathie Wood maintained her $1M Bitcoin price target.

Retail investors organized on Reddit's r/cryptocurrency and Twitter, demanding government bailouts. Consumer advocacy groups including Better Markets called for a complete ban on retail crypto trading. The Blockchain Association lobbied against overreaction, arguing the collapse was fraud, not a systemic crypto failure.

JPMorgan Chase CEO Jamie Dimon called cryptocurrency "a fraud wrapped in technology" at a Congressional hearing. Meanwhile, BlackRock's Larry Fink noted that institutional demand for Bitcoin ETFs remained stable despite the crash.`
		},
		{
			name: 'Remote Work Mandate',
			requirement: 'How will employees, managers, and the market react to forced return-to-office policies?',
			seed: `In January 2026, Amazon CEO Andy Jassy announced a strict 5-day return-to-office mandate effective March 1, with no exceptions. This follows similar moves by JPMorgan Chase under Jamie Dimon and Goldman Sachs under David Solomon. Google and Meta maintain hybrid 3-day policies but face internal pressure to follow suit.

Amazon employees organized a walkout with over 30,000 participants. A petition on change.org gathered 500,000 signatures. Blind, the anonymous workplace app, showed 73% of Amazon employees considering quitting. LinkedIn reported a 340% spike in job applications from Amazon employees.

Shopify CEO Tobi Lutke posted "We deleted all recurring meetings and went fully remote in 2023. Productivity is up 18%." Atlassian CEO Scott Farquhar shared data showing their distributed workforce outperforms industry benchmarks. Gitlab published their annual remote work report showing $18M saved in real estate costs.

Stanford economist Nick Bloom published research showing RTO mandates cause 10-15% attrition of top performers. Microsoft's WorkLab released data showing hybrid workers report 20% higher job satisfaction. Gallup polling shows 62% of knowledge workers would take a pay cut to remain remote.

Commercial real estate firms CBRE and JLL lobbied city governments to incentivize office returns, citing urban economic impact. New York Mayor Eric Adams and San Francisco Mayor London Breed supported RTO mandates to revitalize downtown areas.

The National Labor Relations Board received a surge of complaints about retaliation against remote work advocates. Several class-action lawsuits were filed alleging disability discrimination in blanket RTO mandates.`
		}
	];

	function loadTemplate(idx: number) {
		seedText = templates[idx].seed;
		requirement = templates[idx].requirement;
	}

	// --- State ---
	let currentStep = $state(1);
	let seedText = $state('');
	let requirement = $state('');

	// Step 1: graph
	let graphLoading = $state(false);
	let graphError = $state('');
	let projectId = $state(0);
	let graphNodes: GraphNode[] = $state([]);
	let graphEdges: GraphEdge[] = $state([]);
	let ontology: any = $state(null);

	// Step 2: agents (generated from graph)
	interface GeneratedAgent {
		id: number;
		userId: number;
		name: string;
		entityType: string;
		bio: string;
		persona: string;
		interests: string[] | string;
		stance: string;
		activityLevel: number;
	}

	let generatedAgents: GeneratedAgent[] = $state([]);
	let agentsLoading = $state(false);
	let agentsError = $state('');
	let agentsProgress = $state('');

	// Step 4: report
	let report = $state('');
	let reportStats: any = $state(null);
	let reportLoading = $state(false);
	let reportError = $state('');

	// Loading from URL
	let initialLoading = $state(false);
	let initialError = $state('');

	async function generateReport() {
		reportLoading = true;
		reportError = '';
		try {
			const res = await fetch('/api/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId })
			});
			const data = await res.json();
			if (data.error) {
				reportError = data.error;
			} else {
				report = data.report;
				reportStats = data.stats;
			}
		} catch (e) {
			reportError = e instanceof Error ? e.message : 'Failed to generate report';
		} finally {
			reportLoading = false;
		}
	}

	// Step 5: chat
	interface ChatMessage {
		role: 'user' | 'assistant';
		content: string;
	}

	let chatMode = $state<'report' | 'agent'>('report');
	let chatAgent = $state('');
	let chatInput = $state('');
	let chatHistory: ChatMessage[] = $state([]);
	let chatLoading = $state(false);

	let chatMessagesEl: HTMLDivElement | undefined = $state();

	async function scrollChatToBottom() {
		await tick();
		if (chatMessagesEl) {
			chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
		}
	}

	async function sendChat() {
		if (!chatInput.trim() || chatLoading) return;
		const msg = chatInput.trim();
		chatInput = '';
		chatHistory = [...chatHistory, { role: 'user', content: msg }];
		chatLoading = true;
		scrollChatToBottom();

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId,
					message: msg,
					mode: chatMode,
					agentName: chatMode === 'agent' ? chatAgent : undefined,
					history: chatHistory.slice(0, -1),
					report: chatMode === 'report' ? report : undefined
				})
			});
			const data = await res.json();
			if (data.error) {
				chatHistory = [...chatHistory, { role: 'assistant', content: `Error: ${data.error}` }];
			} else {
				chatHistory = [...chatHistory, { role: 'assistant', content: data.reply }];
			}
			scrollChatToBottom();
		} catch {
			chatHistory = [...chatHistory, { role: 'assistant', content: 'Failed to get response.' }];
		} finally {
			chatLoading = false;
		}
	}

	function switchChatMode(mode: 'report' | 'agent', name?: string) {
		chatMode = mode;
		chatAgent = name || '';
		chatHistory = [];
	}

	// For backward compat with sidebar stats
	let agents = $derived(
		generatedAgents.map((a) => ({
			name: a.name,
			bio: a.bio,
			interests: typeof a.interests === 'string' ? a.interests.split(',').map((s: string) => s.trim()) : a.interests
		}))
	);

	async function generateAgents() {
		agentsLoading = true;
		agentsError = '';
		agentsProgress = `Generating personas for ${graphNodes.length} entities...`;
		try {
			const res = await fetch('/api/agents', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId })
			});
			const data = await res.json();
			if (data.error) {
				agentsError = data.error;
			} else {
				generatedAgents = data.agents;
			}
		} catch (e) {
			agentsError = e instanceof Error ? e.message : 'Failed to generate agents';
		} finally {
			agentsLoading = false;
			agentsProgress = '';
		}
	}

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

	async function buildGraph() {
		graphLoading = true;
		graphError = '';
		try {
			const res = await fetch('/api/graph', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Project', seedText, requirement })
			});
			const data = await res.json();
			if (data.error) {
				graphError = data.error;
				return;
			}
			projectId = data.projectId;
			ontology = data.ontology;
			setUrlParam(projectId);

			// Fetch full graph
			const graphRes = await fetch(`/api/graph?projectId=${projectId}`);
			const graphData = await graphRes.json();
			graphNodes = graphData.nodes;
			graphEdges = graphData.edges;
		} catch (e) {
			graphError = e instanceof Error ? e.message : 'Failed to build graph';
		} finally {
			graphLoading = false;
		}
	}

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
			const res = await fetch('/api/simulate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId: projectId || undefined })
			});
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

	// --- URL-based persistence ---
	import { onMount, tick } from 'svelte';

	function setUrlParam(pid: number) {
		const url = new URL(window.location.href);
		if (pid) {
			url.searchParams.set('project', String(pid));
		} else {
			url.searchParams.delete('project');
		}
		window.history.replaceState({}, '', url.toString());
	}

	function getUrlProjectId(): number {
		const url = new URL(window.location.href);
		return parseInt(url.searchParams.get('project') || '0') || 0;
	}

	async function loadProject(pid: number) {
		initialLoading = true;
		initialError = '';
		try {
			const res = await fetch(`/api/project/${pid}`);
			const data = await res.json();
			if (data.error) {
				initialError = data.error;
				return;
			}

			// Restore project state
			projectId = data.project.id;
			seedText = data.project.seedText;
			requirement = data.project.requirement;
			ontology = data.project.ontology;

			// Graph
			graphNodes = data.nodes.map((n: any) => ({
				id: n.id,
				name: n.name,
				entityType: n.entity_type ?? n.entityType,
				summary: n.summary,
				attributes: n.attributes
			}));
			graphEdges = data.edges.map((e: any) => ({
				id: e.id,
				sourceNodeId: e.source_node_id ?? e.sourceNodeId,
				targetNodeId: e.target_node_id ?? e.targetNodeId,
				edgeType: e.edge_type ?? e.edgeType,
				fact: e.fact
			}));

			// Agents
			generatedAgents = (data.agents || []).map((a: any) => ({
				id: a.id,
				userId: a.userId,
				name: a.name,
				entityType: a.entityType,
				bio: a.bio,
				persona: a.persona,
				interests: typeof a.interests === 'string'
					? a.interests.split(',').map((s: string) => s.trim())
					: a.interests,
				stance: a.stance,
				activityLevel: a.activityLevel
			}));

			// Determine currentStep based on available data
			if (generatedAgents.length > 0) {
				// Check if there are posts (simulation ran)
				if (data.posts && data.posts.length > 0) {
					currentStep = 3; // simulation has data
				} else {
					currentStep = 3; // agents exist, ready to simulate
				}
			} else if (graphNodes.length > 0) {
				currentStep = 2; // graph exists, ready for agents
			} else {
				currentStep = 1;
			}

			// Report is not stored in DB, but stats tell us if simulation ran
			// User can re-generate report from step 4
		} catch (e) {
			initialError = e instanceof Error ? e.message : 'Failed to load project';
		} finally {
			initialLoading = false;
		}
	}

	function resetState() {
		currentStep = 1;
		seedText = '';
		requirement = '';
		projectId = 0;
		graphNodes = [];
		graphEdges = [];
		ontology = null;
		generatedAgents = [];
		snapshots = [];
		totalRounds = 0;
		viewingRound = 0;
		report = '';
		reportStats = null;
		chatHistory = [];
		chatInput = '';
		chatMode = 'report';
		chatAgent = '';
		initialError = '';
		setUrlParam(0);
	}

	// Determine which steps have data
	let stepHasData = $derived({
		1: graphNodes.length > 0,
		2: generatedAgents.length > 0,
		3: snapshots.length > 0 || totalRounds > 0,
		4: !!report,
		5: chatHistory.length > 0
	} as Record<number, boolean>);

	onMount(async () => {
		const pid = getUrlProjectId();
		if (pid) {
			await loadProject(pid);
		}
	});
</script>

<!-- Top bar -->
<header class="topbar">
	<div class="brand">SHANKS</div>
	<nav class="steps">
		{#each steps as step}
			<button
				class="step"
				class:active={currentStep === step.num}
				class:done={stepHasData[step.num]}
				onclick={() => (currentStep = step.num)}
			>
				<span class="step-num">{step.num}</span>
				{step.label}
			</button>
		{/each}
	</nav>
	<div class="spacer"></div>
	{#if projectId}
		<button class="new-project-btn" onclick={resetState}>New Project</button>
	{/if}
</header>

<!-- Main content -->
<main class="content">
	{#if initialLoading}
		<div class="step-panel" style="display:flex;align-items:center;justify-content:center;">
			<div class="empty">Loading project...</div>
		</div>
	{:else if initialError}
		<div class="step-panel" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
			<div class="error" style="margin:0;">{initialError}</div>
			<button class="primary" onclick={resetState}>Start Fresh</button>
		</div>
	{:else if currentStep === 1}
		<!-- STEP 1: Seed material + Knowledge Graph -->
		<div class="step-panel graph-layout">
			<div class="seed-side">
				<h2>Seed Material</h2>
				<p class="hint">Pick a template or paste your own.</p>
				<div class="template-btns">
					{#each templates as tpl, i}
						<button class="template-btn" onclick={() => loadTemplate(i)}>{tpl.name}</button>
					{/each}
				</div>

				<label>
					Source text
					<textarea
						bind:value={seedText}
						placeholder="Paste the article, document, or data..."
						rows="8"
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

				{#if graphError}
					<div class="error">{graphError}</div>
				{/if}

				<button class="primary full-width" onclick={buildGraph} disabled={graphLoading || !seedText || !requirement}>
					{graphLoading ? 'Extracting...' : 'Build Knowledge Graph'}
				</button>

				{#if graphNodes.length > 0}
					<div class="step-actions">
						<button class="primary" onclick={() => (currentStep = 2)}>
							Next: Generate Agents
						</button>
					</div>
				{/if}
			</div>

			<div class="graph-side">
				{#if graphNodes.length === 0 && !graphLoading}
					<div class="empty">Knowledge graph will appear here after extraction.</div>
				{:else if graphLoading}
					<div class="empty">Extracting entities and relationships...</div>
				{:else}
					<div class="graph-stats">
						<div class="stat">
							<span class="stat-num">{graphNodes.length}</span>
							<span class="stat-label">Entities</span>
						</div>
						<div class="stat">
							<span class="stat-num">{graphEdges.length}</span>
							<span class="stat-label">Relationships</span>
						</div>
						<div class="stat">
							<span class="stat-num">{ontology?.entities?.length || 0}</span>
							<span class="stat-label">Entity types</span>
						</div>
					</div>

					{#if ontology}
						<h3>Entity Types</h3>
						<div class="type-chips">
							{#each ontology.entities as etype}
								<span class="type-chip" title={etype.description}>{etype.type}</span>
							{/each}
						</div>
					{/if}

					<h3>Entities</h3>
					<div class="entity-list">
						{#each graphNodes as node}
							<div class="entity-item">
								<div class="entity-head">
									<strong>{node.name}</strong>
									<span class="entity-type">{node.entityType}</span>
								</div>
								<div class="entity-summary">{node.summary}</div>
							</div>
						{/each}
					</div>

					{#if graphEdges.length > 0}
						<h3>Relationships</h3>
						<div class="edge-list">
							{#each graphEdges as edge}
								{@const source = graphNodes.find((n) => n.id === edge.sourceNodeId)}
								{@const target = graphNodes.find((n) => n.id === edge.targetNodeId)}
								<div class="edge-item">
									<span class="edge-node">{source?.name ?? '?'}</span>
									<span class="edge-rel">{edge.edgeType}</span>
									<span class="edge-node">{target?.name ?? '?'}</span>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</div>

	{:else if currentStep === 2}
		<!-- STEP 2: Agents (generated from graph, like MiroFish environment setup) -->
		<div class="step-panel">
			<div class="agents-header">
				<h2>Agents</h2>
				<div class="agent-stats">
					<div class="stat">
						<span class="stat-num">{generatedAgents.length}</span>
						<span class="stat-label">Agents</span>
					</div>
					<div class="stat">
						<span class="stat-num">{graphNodes.length}</span>
						<span class="stat-label">Entities</span>
					</div>
					<div class="stat">
						<span class="stat-num">5</span>
						<span class="stat-label">Actions</span>
					</div>
				</div>
			</div>

			{#if generatedAgents.length === 0}
				{#if agentsError}
					<div class="error">{agentsError}</div>
				{/if}

				{#if projectId === 0}
					<div class="empty">Build a knowledge graph in Step 1 first.</div>
				{:else}
					<p class="hint">Generate agent personas from the {graphNodes.length} entities extracted in Step 1. Each entity becomes an agent with personality, stance, and behavior.</p>
					<button class="primary" onclick={generateAgents} disabled={agentsLoading || !projectId}>
						{agentsLoading ? (agentsProgress || 'Generating...') : `Generate ${graphNodes.length} Agents`}
					</button>
				{/if}
			{:else}
				<div class="agents-grid">
					{#each generatedAgents as agent}
						<div class="agent-card">
							<div class="agent-head-row">
								<div class="agent-name">{agent.name}</div>
								<span class="entity-type">{agent.entityType}</span>
								<span class="stance-chip" class:supportive={agent.stance === 'supportive'} class:opposing={agent.stance === 'opposing'} class:observer={agent.stance === 'observer'}>{agent.stance}</span>
							</div>
							<div class="agent-bio">{agent.bio}</div>
							<div class="agent-persona">{agent.persona}</div>
							<div class="agent-meta">
								<span>Activity: {Math.round(agent.activityLevel * 100)}%</span>
							</div>
							<div class="agent-tags">
								{#each (typeof agent.interests === 'string' ? agent.interests.split(',') : agent.interests) as tag}
									<span class="tag">{tag.trim()}</span>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<div class="step-actions">
					<button class="secondary" onclick={() => (currentStep = 1)}>Back</button>
					<button class="primary" onclick={() => (currentStep = 3)}>Next: Simulate</button>
				</div>
			{/if}
		</div>

	{:else if currentStep === 3}
		<!-- STEP 3: Simulation with timeline -->
		<div class="step-panel sim-layout">
			<div class="sim-sidebar">
				<h3>Controls</h3>
				<button class="primary full-width" onclick={simulate} disabled={loading || !projectId}>
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
		<!-- STEP 4: Prediction Report -->
		<div class="step-panel report-layout">
			<div class="report-sidebar">
				<h3>Report</h3>

				{#if projectId === 0}
					<div class="empty">Run the full pipeline first (Steps 1-3).</div>
				{:else if !report}
					<p class="hint">Analyze the simulation results and generate a prediction report.</p>

					{#if reportError}
						<div class="error">{reportError}</div>
					{/if}

					<button class="primary full-width" onclick={generateReport} disabled={reportLoading}>
						{reportLoading ? 'Analyzing...' : 'Generate Prediction Report'}
					</button>
				{:else}
					<h3>Stats</h3>
					{#if reportStats}
						<div class="sim-stats">
							<div class="stat-row"><span>Agents</span><strong>{reportStats.agents}</strong></div>
							<div class="stat-row"><span>Posts</span><strong>{reportStats.posts}</strong></div>
							<div class="stat-row"><span>Comments</span><strong>{reportStats.comments}</strong></div>
							<div class="stat-row"><span>Follows</span><strong>{reportStats.follows}</strong></div>
						</div>

						{#if reportStats.stances}
							<h3>Stance distribution</h3>
							<div class="stance-bars">
								{#each Object.entries(reportStats.stances) as [stance, count]}
									<div class="stance-row">
										<span class="stance-label">{stance}</span>
										<div class="stance-bar">
											<div
												class="stance-fill"
												class:supportive={stance === 'supportive'}
												class:opposing={stance === 'opposing'}
												class:neutral={stance === 'neutral'}
												class:observer={stance === 'observer'}
												style="width: {((count as number) / reportStats.agents) * 100}%"
											></div>
										</div>
										<span class="stance-count">{count}</span>
									</div>
								{/each}
							</div>
						{/if}
					{/if}

					<div class="step-actions">
						<button class="secondary" onclick={() => { report = ''; }} >Regenerate</button>
						<button class="primary" onclick={() => (currentStep = 5)}>Next: Chat</button>
					</div>
				{/if}
			</div>

			<div class="report-content">
				{#if reportLoading}
					<div class="empty">Analyzing {reportStats?.posts || '...'} posts, {reportStats?.comments || '...'} comments, and {reportStats?.agents || '...'} agent behaviors...</div>
				{:else if report}
					<article class="markdown">
						{@html report
							.replace(/^## (.*$)/gm, '<h2>$1</h2>')
							.replace(/^### (.*$)/gm, '<h3>$1</h3>')
							.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
							.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
							.replace(/\*(.*?)\*/g, '<em>$1</em>')
							.replace(/\n\n/g, '</p><p>')
							.replace(/^/, '<p>')
							.replace(/$/, '</p>')}
					</article>
				{:else}
					<div class="empty">Generate a report to see the prediction analysis here.</div>
				{/if}
			</div>
		</div>

	{:else if currentStep === 5}
		<!-- STEP 5: Deep Interaction -->
		<div class="step-panel chat-layout">
			<div class="chat-sidebar">
				<h3>Talk to</h3>

				<button
					class="chat-target"
					class:active={chatMode === 'report'}
					onclick={() => switchChatMode('report')}
				>
					<span class="chat-target-name">ReportAgent</span>
					<span class="chat-target-desc">Ask about predictions</span>
				</button>

				<h3>Interview agents</h3>
				<div class="agent-list-chat">
					{#each generatedAgents as a}
						<button
							class="chat-target"
							class:active={chatMode === 'agent' && chatAgent === a.name}
							onclick={() => switchChatMode('agent', a.name)}
						>
							<span class="chat-target-name">{a.name}</span>
							<span class="chat-target-stance" class:supportive={a.stance === 'supportive'} class:opposing={a.stance === 'opposing'}>{a.stance}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="chat-main">
				<div class="chat-header">
					{#if chatMode === 'report'}
						Chatting with <strong>ReportAgent</strong>
					{:else}
						Interviewing <strong>{chatAgent}</strong>
					{/if}
				</div>

				<div class="chat-messages" bind:this={chatMessagesEl}>
					{#if chatHistory.length === 0}
						<div class="empty">
							{#if chatMode === 'report'}
								Ask the ReportAgent about its predictions, methodology, or specific agents.
							{:else}
								Ask {chatAgent} about their opinions, decisions, and reasoning during the simulation.
							{/if}
						</div>
					{/if}

					{#each chatHistory as msg}
						<div class="chat-msg" class:user={msg.role === 'user'} class:assistant={msg.role === 'assistant'}>
							<div class="chat-msg-label">{msg.role === 'user' ? 'You' : chatMode === 'report' ? 'ReportAgent' : chatAgent}</div>
							<div class="chat-msg-content">{msg.content}</div>
						</div>
					{/each}

					{#if chatLoading}
						<div class="chat-msg assistant">
							<div class="chat-msg-label">{chatMode === 'report' ? 'ReportAgent' : chatAgent}</div>
							<div class="chat-msg-content typing">Thinking...</div>
						</div>
					{/if}
				</div>

				<div class="chat-input-row">
					<input
						type="text"
						bind:value={chatInput}
						placeholder={chatMode === 'report' ? 'Ask about the prediction...' : `Ask ${chatAgent} a question...`}
						onkeydown={(e) => e.key === 'Enter' && sendChat()}
						disabled={chatLoading}
					/>
					<button class="primary" onclick={sendChat} disabled={chatLoading || !chatInput.trim()}>Send</button>
				</div>
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

	.new-project-btn {
		background: none;
		border: 1px solid #2f3336;
		color: #e7e9ea;
		padding: 6px 14px;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
		font-weight: 600;
	}

	.new-project-btn:hover {
		border-color: #f91880;
		color: #f91880;
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

	/* --- Step 1: Graph layout --- */
	.graph-layout {
		display: flex;
		gap: 0;
		padding: 0;
	}

	.seed-side {
		width: 380px;
		flex-shrink: 0;
		padding: 24px;
		border-right: 1px solid #2f3336;
		overflow-y: auto;
	}

	.seed-side h2 {
		margin: 0 0 8px;
		font-size: 20px;
	}

	.template-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 16px;
	}

	.template-btn {
		background: #16181c;
		border: 1px solid #2f3336;
		color: #e7e9ea;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 12px;
		cursor: pointer;
	}

	.template-btn:hover {
		border-color: #1d9bf0;
		color: #1d9bf0;
	}

	.graph-side {
		flex: 1;
		padding: 24px;
		overflow-y: auto;
	}

	.graph-side h3 {
		margin: 20px 0 10px;
		font-size: 14px;
		color: #71767b;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.graph-stats {
		display: flex;
		gap: 32px;
		padding-bottom: 16px;
		border-bottom: 1px solid #2f3336;
	}

	.type-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.type-chip {
		background: #2a1a3a;
		color: #a970ff;
		padding: 4px 12px;
		border-radius: 12px;
		font-size: 12px;
		cursor: help;
	}

	.entity-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.entity-item {
		background: #16181c;
		border: 1px solid #2f3336;
		border-radius: 8px;
		padding: 12px;
	}

	.entity-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.entity-head strong {
		font-size: 14px;
	}

	.entity-type {
		background: #1d3a5c;
		color: #1d9bf0;
		padding: 1px 8px;
		border-radius: 10px;
		font-size: 11px;
	}

	.entity-summary {
		color: #71767b;
		font-size: 13px;
		line-height: 1.3;
	}

	.edge-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.edge-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: #16181c;
		border-radius: 6px;
		font-size: 13px;
	}

	.edge-node {
		color: #e7e9ea;
		font-weight: 600;
	}

	.edge-rel {
		color: #00ba7c;
		font-size: 12px;
		background: #1a3a2a;
		padding: 2px 8px;
		border-radius: 10px;
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

	.agent-head-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
		flex-wrap: wrap;
	}

	.agent-name {
		font-weight: 700;
		font-size: 15px;
	}

	.agent-bio {
		color: #71767b;
		font-size: 13px;
		margin-bottom: 6px;
		line-height: 1.3;
	}

	.agent-persona {
		color: #a0a4a8;
		font-size: 12px;
		line-height: 1.4;
		margin-bottom: 8px;
		border-left: 2px solid #2f3336;
		padding-left: 10px;
	}

	.agent-meta {
		font-size: 11px;
		color: #71767b;
		margin-bottom: 8px;
	}

	.stance-chip {
		padding: 1px 8px;
		border-radius: 10px;
		font-size: 11px;
		background: #2f3336;
		color: #71767b;
	}

	.stance-chip.supportive {
		background: #1a3a2a;
		color: #00ba7c;
	}

	.stance-chip.opposing {
		background: #3d1f2e;
		color: #f91880;
	}

	.stance-chip.observer {
		background: #1d3a5c;
		color: #1d9bf0;
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

	/* --- Step 4: Report layout --- */
	.report-layout {
		display: flex;
		gap: 0;
		padding: 0;
	}

	.report-sidebar {
		width: 280px;
		flex-shrink: 0;
		padding: 20px;
		border-right: 1px solid #2f3336;
		overflow-y: auto;
	}

	.report-sidebar h3 {
		margin: 16px 0 10px;
		font-size: 14px;
		color: #71767b;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.report-sidebar h3:first-child {
		margin-top: 0;
	}

	.stance-bars {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.stance-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}

	.stance-label {
		width: 70px;
		color: #71767b;
	}

	.stance-bar {
		flex: 1;
		height: 8px;
		background: #2f3336;
		border-radius: 4px;
		overflow: hidden;
	}

	.stance-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.3s;
	}

	.stance-fill.supportive { background: #00ba7c; }
	.stance-fill.opposing { background: #f91880; }
	.stance-fill.neutral { background: #71767b; }
	.stance-fill.observer { background: #1d9bf0; }

	.stance-count {
		width: 20px;
		text-align: right;
		color: #e7e9ea;
		font-weight: 600;
	}

	.report-content {
		flex: 1;
		overflow-y: auto;
		padding: 32px 40px;
	}

	.markdown {
		line-height: 1.7;
		font-size: 15px;
	}

	.markdown h2 {
		font-size: 20px;
		margin: 32px 0 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid #2f3336;
	}

	.markdown h2:first-child {
		margin-top: 0;
	}

	.markdown h3 {
		font-size: 16px;
		margin: 24px 0 8px;
	}

	.markdown p {
		margin: 0 0 16px;
	}

	.markdown blockquote {
		border-left: 3px solid #1d9bf0;
		padding: 8px 16px;
		margin: 12px 0;
		background: #16181c;
		border-radius: 0 8px 8px 0;
		color: #d6d9db;
		font-style: italic;
	}

	.markdown strong {
		color: #ffffff;
	}

	/* --- Step 5: Chat layout --- */
	.chat-layout {
		display: flex;
		gap: 0;
		padding: 0;
	}

	.chat-sidebar {
		width: 240px;
		flex-shrink: 0;
		padding: 16px;
		border-right: 1px solid #2f3336;
		overflow-y: auto;
	}

	.chat-sidebar h3 {
		margin: 16px 0 8px;
		font-size: 12px;
		color: #71767b;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.chat-sidebar h3:first-child {
		margin-top: 0;
	}

	.agent-list-chat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.chat-target {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		background: none;
		border: none;
		border-radius: 6px;
		color: #e7e9ea;
		font-size: 13px;
		cursor: pointer;
		text-align: left;
	}

	.chat-target:hover {
		background: #16181c;
	}

	.chat-target.active {
		background: #1d3a5c;
	}

	.chat-target-name {
		flex: 1;
		font-weight: 600;
		font-size: 12px;
	}

	.chat-target-desc {
		font-size: 11px;
		color: #71767b;
	}

	.chat-target-stance {
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 8px;
		background: #2f3336;
		color: #71767b;
	}

	.chat-target-stance.supportive { background: #1a3a2a; color: #00ba7c; }
	.chat-target-stance.opposing { background: #3d1f2e; color: #f91880; }

	.chat-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.chat-header {
		padding: 12px 20px;
		border-bottom: 1px solid #2f3336;
		font-size: 14px;
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.chat-msg {
		max-width: 80%;
	}

	.chat-msg.user {
		align-self: flex-end;
	}

	.chat-msg.assistant {
		align-self: flex-start;
	}

	.chat-msg-label {
		font-size: 11px;
		color: #71767b;
		margin-bottom: 4px;
		font-weight: 600;
	}

	.chat-msg.user .chat-msg-label {
		text-align: right;
	}

	.chat-msg-content {
		padding: 10px 14px;
		border-radius: 12px;
		font-size: 14px;
		line-height: 1.4;
	}

	.chat-msg.user .chat-msg-content {
		background: #1d9bf0;
		color: white;
		border-bottom-right-radius: 4px;
	}

	.chat-msg.assistant .chat-msg-content {
		background: #16181c;
		border: 1px solid #2f3336;
		border-bottom-left-radius: 4px;
	}

	.typing {
		color: #71767b;
		font-style: italic;
	}

	.chat-input-row {
		display: flex;
		gap: 8px;
		padding: 12px 20px;
		border-top: 1px solid #2f3336;
	}

	.chat-input-row input {
		flex: 1;
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
