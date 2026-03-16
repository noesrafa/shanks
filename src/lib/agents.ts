/**
 * Agent class adapted from OASIS's SocialAgent + UserInfo.
 *
 * In OASIS (oasis/social_platform/config/user.py), an agent has:
 *   - name, description, profile (with user_profile personality text)
 *   - A system message built via to_twitter_system_message() with
 *     OBJECTIVE + SELF-DESCRIPTION sections
 *
 * In OASIS (oasis/social_agent/agent.py), perform_action_by_llm() sends:
 *   - system message (persona) + user message (environment context)
 *   - Uses OpenAI function calling format
 *
 * We simplify: no tool calling, just ask for post content directly.
 * Action: CREATE_POST only (OASIS ActionType.CREATE_POST)
 * LLM: MiniMax M2.5 via OpenAI-compatible API
 */

export interface AgentProfile {
	name: string;
	bio: string;
	interests: string;
}

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

export class Agent {
	name: string;
	bio: string;
	interests: string;

	constructor(profile: AgentProfile) {
		this.name = profile.name;
		this.bio = profile.bio;
		this.interests = profile.interests;
	}

	/**
	 * Builds system message following OASIS pattern:
	 * OBJECTIVE + SELF-DESCRIPTION (from UserInfo.to_twitter_system_message)
	 */
	private buildSystemMessage(): string {
		return [
			'# OBJECTIVE',
			'You are a social media user. Write a short post (1-3 sentences) that feels natural and authentic.',
			'',
			'# SELF-DESCRIPTION',
			`Your name is ${this.name}.`,
			`Bio: ${this.bio}`,
			`Your interests include: ${this.interests}.`,
			'',
			'Your post should reflect your personality and interests.',
			'Reply ONLY with the post content, nothing else.'
		].join('\n');
	}

	/**
	 * Generates a post via MiniMax OpenAI-compatible API.
	 * Adapted from OASIS perform_action_by_llm() → CREATE_POST action.
	 */
	async generatePost(apiKey: string): Promise<string> {
		const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: 'MiniMax-M2.5',
				messages: [
					{ role: 'system', content: this.buildSystemMessage() },
					{ role: 'user', content: 'Write a new post for the social media feed.' }
				],
				temperature: 0.9,
				max_tokens: 1024
			})
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`MiniMax error: ${response.status} ${body}`);
		}

		const data = await response.json();
		const raw = data.choices[0].message.content;
		// Strip <think>...</think> tags that MiniMax M2.5 includes
		return raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
	}
}
