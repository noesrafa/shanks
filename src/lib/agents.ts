/**
 * Agent class adapted from OASIS's SocialAgent + UserInfo.
 *
 * OASIS pattern (oasis/social_agent/agent.py):
 *   1. Agent observes environment via to_text_prompt() (posts as JSON)
 *   2. LLM receives system message (persona) + user message (environment)
 *   3. LLM decides action via OpenAI tool calling
 *   4. Action is executed (create_post, like_post, etc.)
 *
 * We adapt this with MiniMax M2.5 and a simplified action space.
 */

export interface AgentProfile {
	name: string;
	bio: string;
	interests: string;
}

export interface FeedPost {
	post_id: number;
	user_name: string;
	content: string;
	num_likes: number;
}

export type AgentAction =
	| { type: 'create_post'; content: string }
	| { type: 'like_post'; post_id: number }
	| { type: 'do_nothing' };

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

// Tool definitions following OpenAI function calling format
// Adapted from OASIS get_openai_function_list()
const ACTION_TOOLS = [
	{
		type: 'function' as const,
		function: {
			name: 'create_post',
			description: 'Create a new post on the social media feed.',
			parameters: {
				type: 'object',
				properties: {
					content: {
						type: 'string',
						description: 'The text content of the post (1-3 sentences)'
					}
				},
				required: ['content']
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'like_post',
			description: 'Like an existing post by its ID.',
			parameters: {
				type: 'object',
				properties: {
					post_id: {
						type: 'number',
						description: 'The ID of the post to like'
					}
				},
				required: ['post_id']
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'do_nothing',
			description: 'Choose not to take any action this round.',
			parameters: {
				type: 'object',
				properties: {}
			}
		}
	}
];

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
	 * OBJECTIVE + SELF-DESCRIPTION + RESPONSE METHOD
	 * (from UserInfo.to_twitter_system_message)
	 */
	private buildSystemMessage(): string {
		return [
			'# OBJECTIVE',
			"You're a social media user. After observing the feed, choose an action.",
			'',
			'# SELF-DESCRIPTION',
			`Your name is ${this.name}.`,
			`Bio: ${this.bio}`,
			`Your interests include: ${this.interests}.`,
			'',
			'# RESPONSE METHOD',
			'Please perform actions by calling one of the available functions.',
			'Your actions should be consistent with your personality and interests.',
			'Do not limit yourself to just liking posts — also create original posts.'
		].join('\n');
	}

	/**
	 * Builds environment prompt following OASIS SocialEnvironment.to_text_prompt().
	 * Shows the current feed as JSON (same format OASIS uses).
	 */
	private buildEnvironmentPrompt(feed: FeedPost[]): string {
		if (feed.length === 0) {
			return 'After refreshing, there are no existing posts. Create a new post!';
		}

		const postsJson = JSON.stringify(feed, null, 4);
		return [
			'Here are the latest posts on the platform:',
			postsJson,
			'',
			'Pick one action that best reflects your current inclination',
			'based on your profile and the posts content.',
			'Do not limit your action to just liking posts.'
		].join('\n');
	}

	/**
	 * Observe environment and decide action via LLM tool calling.
	 * Adapted from OASIS perform_action_by_llm().
	 */
	async decideAction(apiKey: string, feed: FeedPost[]): Promise<AgentAction> {
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
					{
						role: 'user',
						content:
							'Please perform social media actions after observing the platform environment. ' +
							this.buildEnvironmentPrompt(feed)
					}
				],
				tools: ACTION_TOOLS,
				tool_choice: 'auto',
				temperature: 0.9,
				max_tokens: 1024
			})
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`MiniMax error: ${response.status} ${body}`);
		}

		const data = await response.json();
		const message = data.choices[0].message;

		// Extract tool call (like OASIS response.info['tool_calls'])
		if (message.tool_calls && message.tool_calls.length > 0) {
			const toolCall = message.tool_calls[0];
			const args =
				typeof toolCall.function.arguments === 'string'
					? JSON.parse(toolCall.function.arguments)
					: toolCall.function.arguments;

			switch (toolCall.function.name) {
				case 'create_post':
					return { type: 'create_post', content: args.content };
				case 'like_post':
					return { type: 'like_post', post_id: args.post_id };
				case 'do_nothing':
					return { type: 'do_nothing' };
			}
		}

		// Fallback: if LLM responded with text instead of tool call, treat as post
		const content = (message.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
		if (content) {
			return { type: 'create_post', content };
		}

		return { type: 'do_nothing' };
	}
}
