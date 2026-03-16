import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { projects, graphNodes, graphEdges } from '$lib/server/schema';
import { generateOntology, extractGraph } from '$lib/server/graph';
import { eq } from 'drizzle-orm';

/**
 * Knowledge Graph API.
 * Adapted from MiroFish Stage 1: /api/graph/ontology/generate + /api/graph/build
 *
 * POST: Create project → generate ontology → extract entities/edges → store
 * GET: Fetch project graph data
 */

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name, seedText, requirement } = await request.json();

		if (!seedText || !requirement) {
			return json({ error: 'seedText and requirement are required' }, { status: 400 });
		}

		// Create project
		const [project] = await db
			.insert(projects)
			.values({
				name: name || 'Untitled',
				seedText,
				requirement,
				status: 'generating_ontology'
			})
			.returning();

		// Step 1: Generate ontology (like MiroFish /api/graph/ontology/generate)
		const ontology = await generateOntology(seedText, requirement);

		await db
			.update(projects)
			.set({ ontology, status: 'extracting_graph' })
			.where(eq(projects.id, project.id));

		// Step 2: Extract entities + relationships (like MiroFish /api/graph/build)
		const { entities, edges } = await extractGraph(seedText, ontology);

		// Store entities
		const nodeMap = new Map<string, number>();
		for (const entity of entities) {
			const [node] = await db
				.insert(graphNodes)
				.values({
					projectId: project.id,
					name: entity.name,
					entityType: entity.type,
					summary: entity.summary,
					attributes: entity.attributes
				})
				.returning();
			nodeMap.set(entity.name, node.id);
		}

		// Store edges (only if both source and target exist)
		let edgeCount = 0;
		for (const edge of edges) {
			const sourceId = nodeMap.get(edge.source);
			const targetId = nodeMap.get(edge.target);
			if (sourceId && targetId) {
				await db.insert(graphEdges).values({
					projectId: project.id,
					sourceNodeId: sourceId,
					targetNodeId: targetId,
					edgeType: edge.relation,
					fact: edge.fact
				});
				edgeCount++;
			}
		}

		await db
			.update(projects)
			.set({ status: 'ready' })
			.where(eq(projects.id, project.id));

		return json({
			projectId: project.id,
			ontology,
			entities: entities.length,
			edges: edgeCount
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const projectId = parseInt(url.searchParams.get('projectId') || '0');
	if (!projectId) {
		return json({ error: 'projectId is required' }, { status: 400 });
	}

	const project = await db.query.projects.findFirst({
		where: (p, { eq }) => eq(p.id, projectId)
	});

	if (!project) {
		return json({ error: 'Project not found' }, { status: 404 });
	}

	const nodes = await db
		.select()
		.from(graphNodes)
		.where(eq(graphNodes.projectId, projectId));

	const edges = await db
		.select()
		.from(graphEdges)
		.where(eq(graphEdges.projectId, projectId));

	return json({
		project: {
			id: project.id,
			name: project.name,
			requirement: project.requirement,
			ontology: project.ontology,
			status: project.status
		},
		nodes,
		edges
	});
};
