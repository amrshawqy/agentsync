import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';

const SYSTEM_PROMPT = `You design data schemas for small businesses using AgentSync.

Output STRICT JSON matching this TypeScript type:

interface Blueprint {
  slug: string;            // kebab-case, 3-32 chars
  name: string;            // human-readable
  description: string;
  category?: string;
  schemaDefinition: { tables: Table[] };
}
interface Table {
  slug: string;
  name: string;
  description?: string;
  agentHint?: string;
  fields: Field[];
}
interface Field {
  slug: string;
  name: string;
  fieldType: 'text'|'number'|'date'|'datetime'|'boolean'|'email'|'url'|'phone'|'currency'|'select'|'multi_select'|'relation';
  isRequired?: boolean;
  options?: { value: string; label: string }[]; // required for select/multi_select
  agentHint?: string;
}

Constraints:
- Maximum 10 tables, 30 fields per table.
- Use snake_case slugs.
- Each table must have at least one required text field (e.g. name).
- For status fields, use 'select' with sensible options.
- Do not include sample data or instructions. Just the blueprint JSON.

Reply with ONLY the JSON object, no commentary, no markdown fences.`;

export interface DraftedBlueprint {
	slug: string;
	name: string;
	description: string;
	category?: string;
	schemaDefinition: {
		tables: Array<{
			slug: string;
			name: string;
			description?: string;
			agentHint?: string;
			fields: Array<Record<string, unknown>>;
		}>;
	};
}

export class BlueprintDraftService {
	get isConfigured(): boolean {
		return Boolean(getConfig().ANTHROPIC_API_KEY);
	}

	async draftFromDescription(description: string): Promise<DraftedBlueprint> {
		const config = getConfig();
		if (!config.ANTHROPIC_API_KEY) {
			throw new Error('Blueprint drafting is disabled (ANTHROPIC_API_KEY not set)');
		}
		if (!description || description.trim().length < 10) {
			throw new Error('Description must be at least 10 characters');
		}
		if (description.length > 4000) {
			throw new Error('Description is too long');
		}

		const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
		const response = await client.messages.create({
			model: 'claude-sonnet-4-6',
			max_tokens: 4000,
			system: [
				{
					type: 'text',
					text: SYSTEM_PROMPT,
					cache_control: { type: 'ephemeral' },
				},
			],
			messages: [{ role: 'user', content: description }],
		});

		const textBlock = response.content.find((c) => c.type === 'text');
		if (!textBlock || textBlock.type !== 'text') {
			throw new Error('Anthropic response had no text content');
		}
		const raw = textBlock.text.trim();
		const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
		try {
			const draft = JSON.parse(json) as DraftedBlueprint;
			validateDraft(draft);
			return draft;
		} catch (err) {
			logger.error('Failed to parse blueprint draft', { error: String(err), raw });
			throw new Error('Could not parse the drafted blueprint. Please try a different description.');
		}
	}
}

function validateDraft(draft: DraftedBlueprint) {
	if (!draft || typeof draft !== 'object') throw new Error('Draft is not an object');
	if (!draft.slug || !draft.name) throw new Error('Draft is missing slug/name');
	if (!draft.schemaDefinition?.tables?.length) throw new Error('Draft has no tables');
	if (draft.schemaDefinition.tables.length > 10) throw new Error('Draft has too many tables');
	for (const t of draft.schemaDefinition.tables) {
		if (!t.slug || !t.name) throw new Error('Table is missing slug/name');
		if (!t.fields?.length) throw new Error(`Table ${t.slug} has no fields`);
		if (t.fields.length > 30) throw new Error(`Table ${t.slug} has too many fields`);
	}
}
