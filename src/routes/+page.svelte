<script lang="ts">
	import Button from '$lib/components/ui/button.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Textarea from '$lib/components/ui/textarea.svelte';
	import Badge from '$lib/components/ui/badge.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

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
	let seedLoading = $state(false);
	let seeded = $state(false);
	let seedPosts: Post[] = $state([]);

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

	async function generateSeedPosts() {
		if (!projectId) return;
		seedLoading = true;
		error = '';
		try {
			const res = await fetch('/api/seed-posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId })
			});
			const data = await res.json();
			if (data.error) {
				error = data.error;
			} else {
				seedPosts = data.posts;
				seeded = true;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to seed posts';
		} finally {
			seedLoading = false;
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

			// Restore report from DB if it was previously generated
			if (data.report) {
				report = data.report.content;
				reportStats = data.report.stats;
				if (generatedAgents.length > 0) {
					currentStep = 4; // report exists — jump to report step
				}
			}
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
		seeded = false;
		seedPosts = [];
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
<header class="flex items-center px-4 md:px-5 h-12 border-b border-border bg-background flex-shrink-0">
	<div class="font-black text-sm tracking-widest mr-4 md:mr-8 text-foreground">SHANKS</div>
	<nav class="hidden md:flex gap-1">
		{#each steps as step}
			<button
				class="inline-flex items-center gap-1.5 border border-border text-muted-foreground px-3.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors hover:border-muted-foreground hover:text-foreground"
				class:bg-primary={currentStep === step.num}
				class:border-primary={currentStep === step.num}
				class:text-white={currentStep === step.num}
				class:border-success={stepHasData[step.num] && currentStep !== step.num}
				class:text-success={stepHasData[step.num] && currentStep !== step.num}
				onclick={() => (currentStep = step.num)}
			>
				<span class="font-bold text-[10px]">{step.num}</span>
				{step.label}
			</button>
		{/each}
	</nav>
	<div class="flex-1"></div>
	<ThemeToggle />
	{#if projectId}
		<Button variant="secondary" size="sm" class="ml-2" onclick={resetState}>New</Button>
	{/if}
</header>

<!-- Main content -->
<main class="flex-1 overflow-hidden">
	{#if initialLoading}
		<div class="h-full overflow-y-auto p-6 flex items-center justify-center">
			<div class="text-muted-foreground text-sm text-center py-8">Loading project...</div>
		</div>
	{:else if initialError}
		<div class="h-full overflow-y-auto p-6 flex flex-col items-center justify-center gap-4">
			<div class="text-destructive text-sm">{initialError}</div>
			<Button onclick={resetState}>Start Fresh</Button>
		</div>
	{:else if currentStep === 1}
		<!-- STEP 1: Seed material + Knowledge Graph -->
		<div class="h-full overflow-y-auto md:overflow-hidden flex flex-col md:flex-row gap-4 md:gap-6 p-4 md:p-6">
			<!-- seed side -->
			<div class="flex flex-col gap-3 md:w-96 md:flex-shrink-0 md:overflow-y-auto">
				<h2 class="text-base font-semibold mb-2">Seed Material</h2>
				<p class="text-sm text-muted-foreground">Pick a template or paste your own.</p>
				<div class="flex flex-wrap gap-2">
					{#each templates as tpl, i}
						<Button variant="outline" size="sm" onclick={() => loadTemplate(i)}>{tpl.name}</Button>
					{/each}
				</div>

				<label class="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
					Source text
					<Textarea
						bind:value={seedText}
						placeholder="Paste the article, document, or data..."
						rows={6}
					/>
				</label>

				<label class="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
					Prediction question
					<Input
						bind:value={requirement}
						placeholder="e.g. How will the public react to this policy change?"
					/>
				</label>

				{#if graphError}
					<div class="text-destructive text-sm">{graphError}</div>
				{/if}

				<Button class="w-full" onclick={buildGraph} disabled={graphLoading || !seedText || !requirement}>
					{graphLoading ? 'Extracting...' : 'Build Knowledge Graph'}
				</Button>

				{#if graphNodes.length > 0}
					<div class="flex gap-2 mt-2">
						<Button onclick={() => (currentStep = 2)}>
							Next: Generate Agents
						</Button>
					</div>
				{/if}
			</div>

			<!-- graph side -->
			<div class="flex-1 md:overflow-y-auto">
				{#if graphNodes.length === 0 && !graphLoading}
					<div class="text-muted-foreground text-sm text-center py-8">Knowledge graph will appear here after extraction.</div>
				{:else if graphLoading}
					<div class="text-muted-foreground text-sm text-center py-8">Extracting entities and relationships...</div>
				{:else}
					<div class="flex gap-6 mb-4">
						<div class="flex flex-col">
							<span class="text-2xl font-bold">{graphNodes.length}</span>
							<span class="text-xs text-muted-foreground">Entities</span>
						</div>
						<div class="flex flex-col">
							<span class="text-2xl font-bold">{graphEdges.length}</span>
							<span class="text-xs text-muted-foreground">Relationships</span>
						</div>
						<div class="flex flex-col">
							<span class="text-2xl font-bold">{ontology?.entities?.length || 0}</span>
							<span class="text-xs text-muted-foreground">Entity types</span>
						</div>
					</div>

					{#if ontology}
						<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Entity Types</h3>
						<div class="flex flex-wrap gap-2 mb-4">
							{#each ontology.entities as etype}
								<span title={etype.description}><Badge variant="secondary">{etype.type}</Badge></span>
							{/each}
						</div>
					{/if}

					<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Entities</h3>
					<div class="flex flex-col gap-2">
						{#each graphNodes as node}
							<div class="rounded-lg border border-border p-3">
								<div class="flex items-center gap-2 mb-1">
									<strong>{node.name}</strong>
									<Badge variant="outline">{node.entityType}</Badge>
								</div>
								<div class="text-xs text-muted-foreground">{node.summary}</div>
							</div>
						{/each}
					</div>

					{#if graphEdges.length > 0}
						<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Relationships</h3>
						<div class="flex flex-col gap-1.5">
							{#each graphEdges as edge}
								{@const source = graphNodes.find((n) => n.id === edge.sourceNodeId)}
								{@const target = graphNodes.find((n) => n.id === edge.targetNodeId)}
								<div class="flex items-center gap-2 text-sm">
									<span class="text-foreground font-medium text-xs">{source?.name ?? '?'}</span>
									<span class="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{edge.edgeType}</span>
									<span class="text-foreground font-medium text-xs">{target?.name ?? '?'}</span>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</div>

	{:else if currentStep === 2}
		<!-- STEP 2: Agents (generated from graph, like MiroFish environment setup) -->
		<div class="h-full overflow-y-auto p-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-base font-semibold mb-2">Agents</h2>
				<div class="flex gap-4">
					<div class="flex flex-col">
						<span class="text-2xl font-bold">{generatedAgents.length}</span>
						<span class="text-xs text-muted-foreground">Agents</span>
					</div>
					<div class="flex flex-col">
						<span class="text-2xl font-bold">{graphNodes.length}</span>
						<span class="text-xs text-muted-foreground">Entities</span>
					</div>
					<div class="flex flex-col">
						<span class="text-2xl font-bold">5</span>
						<span class="text-xs text-muted-foreground">Actions</span>
					</div>
				</div>
			</div>

			{#if generatedAgents.length === 0}
				{#if agentsError}
					<div class="text-destructive text-sm">{agentsError}</div>
				{/if}

				{#if projectId === 0}
					<div class="text-muted-foreground text-sm text-center py-8">Build a knowledge graph in Step 1 first.</div>
				{:else}
					<p class="text-sm text-muted-foreground">Generate agent personas from the {graphNodes.length} entities extracted in Step 1. Each entity becomes an agent with personality, stance, and behavior.</p>
					<Button class="mt-3" onclick={generateAgents} disabled={agentsLoading || !projectId}>
						{agentsLoading ? (agentsProgress || 'Generating...') : `Generate ${graphNodes.length} Agents`}
					</Button>
				{/if}
			{:else}
				<div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))">
					{#each generatedAgents as agent}
						<Card class="p-4 flex flex-col gap-2">
							<div class="flex items-center gap-2 flex-wrap">
								<div class="font-semibold text-sm flex-1">{agent.name}</div>
								<Badge variant="outline">{agent.entityType}</Badge>
								{#if agent.stance === 'supportive'}
									<Badge variant="success">{agent.stance}</Badge>
								{:else if agent.stance === 'opposing'}
									<Badge variant="destructive">{agent.stance}</Badge>
								{:else}
									<Badge variant="secondary">{agent.stance}</Badge>
								{/if}
							</div>
							<div class="text-xs text-muted-foreground">{agent.bio}</div>
							<div class="text-xs">{agent.persona}</div>
							<div class="text-xs text-muted-foreground">
								<span>Activity: {Math.round(agent.activityLevel * 100)}%</span>
							</div>
							<div class="flex flex-wrap gap-1">
								{#each (typeof agent.interests === 'string' ? agent.interests.split(',') : agent.interests) as tag}
									<Badge variant="secondary" class="text-[10px]">{tag.trim()}</Badge>
								{/each}
							</div>
						</Card>
					{/each}
				</div>

				<div class="flex gap-2 mt-4">
					<Button variant="secondary" onclick={() => (currentStep = 1)}>Back</Button>
					<Button onclick={() => (currentStep = 3)}>Next: Simulate</Button>
				</div>
			{/if}
		</div>

	{:else if currentStep === 3}
		<!-- STEP 3: Simulation with timeline -->
		<div class="flex h-full overflow-hidden">
			<div class="w-60 border-r border-border p-4 overflow-y-auto flex-shrink-0 flex flex-col gap-3">
				<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Controls</h3>
				{#if !seeded && totalRounds === 0}
					<Button
						variant="secondary"
						class="w-full"
						onclick={generateSeedPosts}
						disabled={seedLoading || !projectId}
					>
						{seedLoading ? 'Seeding...' : 'Seed posts'}
					</Button>
				{/if}

				<Button class="w-full" onclick={simulate} disabled={loading || !projectId}>
					{loading ? 'Running...' : `Run round ${totalRounds + 1}`}
				</Button>

				<div class="flex flex-col gap-1.5 rounded-lg border border-border p-3">
					<div class="flex justify-between items-center text-xs">
						<span>Rounds</span>
						<strong>{totalRounds}</strong>
					</div>
					<div class="flex justify-between items-center text-xs">
						<span>Posts</span>
						<strong>{displayPosts.length}</strong>
					</div>
					<div class="flex justify-between items-center text-xs">
						<span>Agents</span>
						<strong>{agents.length}</strong>
					</div>
				</div>

				{#if totalRounds > 0}
					<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timeline</h3>
					<div class="flex flex-col gap-1">
						<input
							type="range"
							min="1"
							max={totalRounds}
							value={viewingRound === 0 ? totalRounds : viewingRound}
							oninput={onSliderChange}
							class="slider"
						/>
						<div class="flex justify-between text-[10px] text-muted-foreground">
							<span>Round 1</span>
							<span class="font-medium text-foreground">
								{#if isLive}
									Round {totalRounds} (live)
								{:else}
									Round {viewingRound}
								{/if}
							</span>
							<span>Round {totalRounds}</span>
						</div>
						{#if !isLive}
							<Button variant="ghost" size="sm" class="w-full" onclick={() => (viewingRound = 0)}>
								Jump to live
							</Button>
						{/if}
					</div>
				{/if}

				{#if displayActions.length > 0}
					<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Round {displayRound} log</h3>
					<div class="flex flex-col gap-1">
						{#each displayActions as a}
							<div
								class="action-item"
								class:like={a.action === 'like_post'}
								class:post={a.action === 'create_post'}
								class:comment={a.action === 'create_comment'}
								class:follow={a.action === 'follow'}
								class:nothing={a.action === 'do_nothing'}
							>
								{actionLabel(a)}
							</div>
						{/each}
					</div>
				{/if}

				{#if totalRounds > 1}
					<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">All rounds</h3>
					<div class="flex flex-wrap gap-1">
						{#each snapshots as snap}
							<button
								class={`inline-flex items-center gap-1.5 border rounded px-2 py-1 text-[10px] cursor-pointer transition-colors ${displayRound === snap.round ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'}`}
								onclick={() => (viewingRound = snap.round)}
							>
								<span class="font-bold">R{snap.round}</span>
								<span>
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

			<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
				{#if error}
					<div class="text-destructive text-sm">{error}</div>
				{/if}

				{#if !isLive && totalRounds > 0}
					<div class="text-xs text-muted-foreground text-center">
						Viewing round {viewingRound} of {totalRounds}
					</div>
				{/if}

				{#if displayPosts.length === 0 && seedPosts.length === 0}
					<div class="text-muted-foreground text-sm text-center py-8">No posts yet. Seed posts to prime the feed, then run the first round.</div>
				{/if}

				{#if seeded && totalRounds === 0 && seedPosts.length > 0}
					<div class="rounded-lg bg-success/10 text-success text-sm px-4 py-2">Seed posts ready — {seedPosts.length} initial posts. Run round 1 to start.</div>
					{#each seedPosts as post}
						<Card class="p-4 opacity-75">
							<div class="flex items-center gap-2 mb-2">
								<strong>{post.userName}</strong>
								<Badge variant="outline" class="text-[10px]">seed</Badge>
							</div>
							<p class="text-sm">{post.content}</p>
						</Card>
					{/each}
				{/if}

				{#each displayPosts as post}
					<Card class="p-4">
						<div class="flex items-center gap-2 mb-2">
							<strong>{post.userName}</strong>
							<span class="text-xs text-muted-foreground truncate flex-1">{post.userBio}</span>
						</div>
						<p class="text-sm">{post.content}</p>
						<div class="flex items-center gap-4 text-xs text-muted-foreground mt-2">
							{#if post.numLikes > 0}
								<span class="text-pink-500">&hearts; {post.numLikes}</span>
							{/if}
							<time>{new Date(post.createdAt).toLocaleString()}</time>
						</div>

						{#if post.comments && post.comments.length > 0}
							<div class="mt-3 border-t border-border pt-3 flex flex-col gap-2">
								{#each post.comments as comment}
									<div class="flex items-start gap-2 text-xs">
										<strong>{comment.userName}</strong>
										<span>{comment.content}</span>
									</div>
								{/each}
							</div>
						{/if}
					</Card>
				{/each}
			</div>
		</div>

	{:else if currentStep === 4}
		<!-- STEP 4: Prediction Report -->
		<div class="flex h-full overflow-hidden">
			<div class="w-80 border-r border-border p-4 overflow-y-auto flex-shrink-0 flex flex-col gap-3">
				<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Report</h3>

				{#if projectId === 0}
					<div class="text-muted-foreground text-sm text-center py-8">Run the full pipeline first (Steps 1-3).</div>
				{:else if !report}
					<p class="text-sm text-muted-foreground">Analyze the simulation results and generate a prediction report.</p>

					{#if reportError}
						<div class="text-destructive text-sm">{reportError}</div>
					{/if}

					<Button class="w-full" onclick={generateReport} disabled={reportLoading}>
						{reportLoading ? 'Analyzing...' : 'Generate Prediction Report'}
					</Button>
				{:else}
					<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stats</h3>
					{#if reportStats}
						<div class="flex flex-col gap-1.5 rounded-lg border border-border p-3">
							<div class="flex justify-between items-center text-xs"><span>Agents</span><strong>{reportStats.agents}</strong></div>
							<div class="flex justify-between items-center text-xs"><span>Posts</span><strong>{reportStats.posts}</strong></div>
							<div class="flex justify-between items-center text-xs"><span>Comments</span><strong>{reportStats.comments}</strong></div>
							<div class="flex justify-between items-center text-xs"><span>Follows</span><strong>{reportStats.follows}</strong></div>
						</div>

						{#if reportStats.stances}
							<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stance distribution</h3>
							<div class="flex flex-col gap-2">
								{#each Object.entries(reportStats.stances) as [stance, count]}
									<div class="flex items-center gap-2">
										<span class="text-xs w-20 text-muted-foreground">{stance}</span>
										<div class="flex-1 h-2 bg-muted rounded-full overflow-hidden">
											<div
												class="stance-fill"
												class:supportive={stance === 'supportive'}
												class:opposing={stance === 'opposing'}
												class:neutral={stance === 'neutral'}
												class:observer={stance === 'observer'}
												style="width: {((count as number) / reportStats.agents) * 100}%"
											></div>
										</div>
										<span class="text-xs text-muted-foreground w-6 text-right">{count}</span>
									</div>
								{/each}
							</div>
						{/if}
					{/if}

					<div class="flex gap-2 mt-4">
						<Button variant="secondary" onclick={() => { report = ''; }}>Regenerate</Button>
						<Button onclick={() => (currentStep = 5)}>Next: Chat</Button>
					</div>
				{/if}
			</div>

			<div class="flex-1 overflow-y-auto p-6">
				{#if reportLoading}
					<div class="text-muted-foreground text-sm text-center py-8">Analyzing {reportStats?.posts || '...'} posts, {reportStats?.comments || '...'} comments, and {reportStats?.agents || '...'} agent behaviors...</div>
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
					<div class="text-muted-foreground text-sm text-center py-8">Generate a report to see the prediction analysis here.</div>
				{/if}
			</div>
		</div>

	{:else if currentStep === 5}
		<!-- STEP 5: Deep Interaction -->
		<div class="flex h-full overflow-hidden">
			<div class="w-60 border-r border-border p-4 overflow-y-auto flex-shrink-0 flex flex-col gap-2">
				<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Talk to</h3>

				<button
					class="w-full text-left px-3 py-2 rounded-md border border-border text-sm cursor-pointer transition-colors hover:bg-accent"
					class:bg-primary={chatMode === 'report'}
					class:bg-opacity-10={chatMode === 'report'}
					class:border-primary={chatMode === 'report'}
					class:text-primary={chatMode === 'report'}
					onclick={() => switchChatMode('report')}
				>
					<span class="block font-medium text-xs">ReportAgent</span>
					<span class="block text-[10px] text-muted-foreground">Ask about predictions</span>
				</button>

				<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Interview agents</h3>
				<div class="flex flex-col gap-1">
					{#each generatedAgents as a}
						<button
							class="w-full text-left px-3 py-2 rounded-md border border-border text-sm cursor-pointer transition-colors hover:bg-accent"
							class:bg-primary={chatMode === 'agent' && chatAgent === a.name}
							class:bg-opacity-10={chatMode === 'agent' && chatAgent === a.name}
							class:border-primary={chatMode === 'agent' && chatAgent === a.name}
							class:text-primary={chatMode === 'agent' && chatAgent === a.name}
							onclick={() => switchChatMode('agent', a.name)}
						>
							<span class="block font-medium text-xs">{a.name}</span>
							<span
								class="block text-[10px]"
								class:text-success={a.stance === 'supportive'}
								class:text-destructive={a.stance === 'opposing'}
								class:text-muted-foreground={a.stance !== 'supportive' && a.stance !== 'opposing'}
							>{a.stance}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="flex-1 flex flex-col overflow-hidden">
				<div class="px-4 py-3 border-b border-border text-sm flex-shrink-0">
					{#if chatMode === 'report'}
						Chatting with <strong>ReportAgent</strong>
					{:else}
						Interviewing <strong>{chatAgent}</strong>
					{/if}
				</div>

				<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3" bind:this={chatMessagesEl}>
					{#if chatHistory.length === 0}
						<div class="text-muted-foreground text-sm text-center py-8">
							{#if chatMode === 'report'}
								Ask the ReportAgent about its predictions, methodology, or specific agents.
							{:else}
								Ask {chatAgent} about their opinions, decisions, and reasoning during the simulation.
							{/if}
						</div>
					{/if}

					{#each chatHistory as msg}
						<div
							class="flex flex-col gap-1"
							class:items-end={msg.role === 'user'}
							class:items-start={msg.role === 'assistant'}
						>
							<div
								class="text-[10px] text-muted-foreground px-1"
								class:text-right={msg.role === 'user'}
							>{msg.role === 'user' ? 'You' : chatMode === 'report' ? 'ReportAgent' : chatAgent}</div>
							<div
								class="rounded-lg px-3 py-2 text-sm max-w-xl"
								class:bg-primary={msg.role === 'user'}
								class:text-primary-foreground={msg.role === 'user'}
								class:bg-card={msg.role === 'assistant'}
								class:border={msg.role === 'assistant'}
								class:border-border={msg.role === 'assistant'}
							>{msg.content}</div>
						</div>
					{/each}

					{#if chatLoading}
						<div class="flex flex-col gap-1 items-start">
							<div class="text-[10px] text-muted-foreground px-1">{chatMode === 'report' ? 'ReportAgent' : chatAgent}</div>
							<div class="rounded-lg px-3 py-2 text-sm max-w-xl bg-card border border-border typing">Thinking...</div>
						</div>
					{/if}
				</div>

				<div class="flex gap-2 p-4 border-t border-border flex-shrink-0">
					<Input
						bind:value={chatInput}
						placeholder={chatMode === 'report' ? 'Ask about the prediction...' : `Ask ${chatAgent} a question...`}
						onkeydown={(e) => e.key === 'Enter' && sendChat()}
						disabled={chatLoading}
						class="flex-1"
					/>
					<Button onclick={sendChat} disabled={chatLoading || !chatInput.trim()}>Send</Button>
				</div>
			</div>
		</div>
	{/if}
</main>

<!-- Bottom tab nav (mobile only) -->
<nav class="flex md:hidden border-t border-border bg-background flex-shrink-0">
	{#each steps as step}
		<button
			class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 cursor-pointer transition-colors"
			class:text-primary={currentStep === step.num}
			class:text-success={stepHasData[step.num] && currentStep !== step.num}
			class:text-muted-foreground={!stepHasData[step.num] && currentStep !== step.num}
			onclick={() => (currentStep = step.num)}
		>
			<span class="text-sm font-bold leading-none">{step.num}</span>
			<span class="text-[10px] font-medium">{step.label}</span>
		</button>
	{/each}
</nav>

<style>
	/* Action items */
	.action-item {
		font-size: 11px;
		padding: 3px 8px 3px 10px;
		border-left: 2px solid transparent;
		color: var(--tw-color-muted-foreground, #71767b);
	}
	.action-item.post { border-color: hsl(var(--primary)); color: hsl(var(--foreground)); }
	.action-item.like { border-color: hsl(var(--success)); }
	.action-item.comment { border-color: #a970ff; }
	.action-item.follow { border-color: hsl(var(--border)); }
	.action-item.nothing { opacity: 0.4; }

	/* Stance bars */
	.stance-fill { height: 100%; border-radius: 9999px; background: hsl(var(--muted-foreground)); }
	.stance-fill.supportive { background: hsl(var(--success)); }
	.stance-fill.opposing { background: hsl(var(--destructive)); }
	.stance-fill.neutral { background: hsl(var(--primary)); }
	.stance-fill.observer { background: hsl(var(--muted-foreground)); }

	/* Markdown — :global needed because content is injected via {@html} */
	.markdown { font-size: 13px; line-height: 1.7; }
	:global(.markdown h2) { font-size: 16px; font-weight: 700; margin: 1.5em 0 0.5em; color: hsl(var(--foreground)); }
	:global(.markdown h3) { font-size: 13px; font-weight: 700; margin: 1.2em 0 0.4em; color: hsl(var(--foreground)); }
	:global(.markdown p) { margin: 0.7em 0; color: hsl(var(--foreground)); }
	:global(.markdown blockquote) { border-left: 3px solid hsl(var(--border)); margin: 1em 0; padding: 0.5em 1em; color: hsl(var(--muted-foreground)); }
	:global(.markdown strong) { font-weight: 700; }
	:global(.markdown em) { font-style: italic; }

	/* Slider */
	input[type='range'].slider {
		width: 100%;
		accent-color: hsl(var(--primary));
		cursor: pointer;
	}

	/* Typing animation */
	.typing { opacity: 0.7; }
</style>
