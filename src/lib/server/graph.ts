/**
 * Knowledge Graph extraction service.
 * Adapted from MiroFish Stage 1: ontology generation + entity/relationship extraction.
 *
 * MiroFish pattern:
 *   1. LLM generates ontology (10 entity types + 6-10 edge types) from seed text
 *   2. Text is chunked (500 chars, 50 overlap)
 *   3. LLM extracts entities + relationships per chunk using the ontology
 *   4. Results are deduped and stored in graph tables
 *
 * We simplify: no chunking for now (seed text < 50k chars fits in context).
 * One LLM call for ontology, one for extraction.
 */

import { MINIMAX_API_KEY } from '$env/static/private';

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

export interface Ontology {
	entities: { type: string; description: string }[];
	relationships: { type: string; source: string; target: string; description: string }[];
}

export interface ExtractedEntity {
	name: string;
	type: string;
	summary: string;
	attributes: Record<string, string>;
}

export interface ExtractedEdge {
	source: string;
	target: string;
	relation: string;
	fact: string;
}

async function callLLM(system: string, user: string): Promise<string> {
	const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${MINIMAX_API_KEY}`
		},
		body: JSON.stringify({
			model: 'MiniMax-M2.5',
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user }
			],
			temperature: 0.3,
			max_tokens: 8192
		})
	});

	if (!response.ok) {
		throw new Error(`LLM error: ${response.status}`);
	}

	const data = await response.json();
	const raw = data.choices[0].message.content || '';
	return raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function parseJSON<T>(text: string): T {
	// Extract JSON from possible markdown fences
	const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	let jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();

	// If not from fence, extract outermost JSON object
	if (!fenceMatch) {
		const objStart = jsonStr.indexOf('{');
		const objEnd = jsonStr.lastIndexOf('}');
		if (objStart !== -1 && objEnd > objStart) {
			jsonStr = jsonStr.slice(objStart, objEnd + 1);
		}
	}

	try {
		return JSON.parse(jsonStr);
	} catch {
		// Clean up common LLM JSON issues: control chars, trailing commas
		const cleaned = jsonStr
			.replace(/[\x00-\x1f\x7f]/g, (ch) => ch === '\n' || ch === '\t' ? ch : ' ')
			.replace(/,\s*([}\]])/g, '$1');
		return JSON.parse(cleaned);
	}
}

/**
 * Generate ontology from seed text + requirement.
 * Adapted from MiroFish ONTOLOGY_SYSTEM_PROMPT.
 */
export async function generateOntology(
	seedText: string,
	requirement: string
): Promise<Ontology> {
	const system = `You are an ontology architect for social simulation knowledge graphs.

Given a text and a prediction question, design an ontology of entity types and relationship types.

RULES:
- Generate exactly 10 entity types: 8 domain-specific + "Person" + "Organization" as fallbacks
- Generate 6-10 relationship types
- Entity types must be REAL-WORLD ACTORS capable of social media behavior (not abstract concepts)
- Entity types must be PascalCase singular nouns
- Relationship types must be snake_case verbs or prepositions
- Each entity type needs a brief description
- Each relationship needs source type, target type, and description

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "entities": [
    {"type": "EntityType", "description": "What this represents"}
  ],
  "relationships": [
    {"type": "relation_name", "source": "SourceType", "target": "TargetType", "description": "What this means"}
  ]
}`;

	const user = `Text (first 10000 chars):
${seedText.slice(0, 10000)}

Prediction question: ${requirement}

Generate the ontology for this domain.`;

	const result = await callLLM(system, user);
	return parseJSON<Ontology>(result);
}

/**
 * Extract entities and relationships from seed text using ontology.
 * Adapted from MiroFish per-chunk extraction (simplified: one call, no chunking).
 */
export async function extractGraph(
	seedText: string,
	ontology: Ontology
): Promise<{ entities: ExtractedEntity[]; edges: ExtractedEdge[] }> {
	const entityTypes = ontology.entities.map((e) => e.type).join(', ');
	const relTypes = ontology.relationships.map((r) => r.type).join(', ');

	const system = `You are an entity and relationship extractor for knowledge graphs.

Given text and an ontology, extract all entities and relationships.

ENTITY RULES:
- Only use these types: ${entityTypes}
- Entity names must be real names from the text (not abstract concepts)
- Each entity needs: name, type, summary (1-2 sentences), attributes (key-value pairs)
- Deduplicate: same entity mentioned multiple ways should be one entry

RELATIONSHIP RULES:
- Only use these types: ${relTypes}
- source and target must match entity names exactly
- fact must be the actual sentence/context from the text

Return ONLY valid JSON:
{
  "entities": [
    {"name": "Entity Name", "type": "EntityType", "summary": "Brief description", "attributes": {"key": "value"}}
  ],
  "edges": [
    {"source": "Source Name", "target": "Target Name", "relation": "relation_type", "fact": "The actual context from text"}
  ]
}`;

	const user = `Ontology:
${JSON.stringify(ontology, null, 2)}

Text to extract from:
${seedText.slice(0, 30000)}

Extract all entities and relationships.`;

	const result = await callLLM(system, user);
	return parseJSON<{ entities: ExtractedEntity[]; edges: ExtractedEdge[] }>(result);
}
