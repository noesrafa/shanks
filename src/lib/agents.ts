/**
 * Agent class adapted from OASIS's SocialAgent + UserInfo.
 *
 * OASIS pattern (oasis/social_agent/agent.py):
 *   1. Agent observes environment via to_text_prompt() (posts + comments as JSON)
 *   2. LLM receives system message (persona) + user message (environment)
 *   3. LLM decides action via OpenAI tool calling
 *   4. Action is executed (create_post, like_post, create_comment, etc.)
 *
 * We adapt this with MiniMax M2.5 and a growing action space.
 */

export interface AgentProfile {
	name: string;
	bio: string;
	interests: string;
	persona?: string;
}

// Matches OASIS post structure with comments array (platform_utils._add_comments_to_posts)
export interface FeedComment {
	comment_id: number;
	user_name: string;
	content: string;
}

export interface FeedPost {
	post_id: number;
	user_name: string;
	content: string;
	num_likes: number;
	comments: FeedComment[];
}

export type AgentAction =
	| { type: 'create_post'; content: string }
	| { type: 'like_post'; post_id: number }
	| { type: 'create_comment'; post_id: number; content: string }
	| { type: 'follow'; user_name: string }
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
			name: 'create_comment',
			description: 'Write a comment on an existing post by its ID.',
			parameters: {
				type: 'object',
				properties: {
					post_id: {
						type: 'number',
						description: 'The ID of the post to comment on'
					},
					content: {
						type: 'string',
						description: 'The text content of the comment (1-2 sentences)'
					}
				},
				required: ['post_id', 'content']
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'follow',
			description: 'Follow another user to see more of their posts in your feed.',
			parameters: {
				type: 'object',
				properties: {
					user_name: {
						type: 'string',
						description: 'The name of the user to follow'
					}
				},
				required: ['user_name']
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
	persona: string;

	constructor(profile: AgentProfile) {
		this.name = profile.name;
		this.bio = profile.bio;
		this.interests = profile.interests;
		this.persona = profile.persona || '';
	}

	/**
	 * Builds system message following OASIS pattern:
	 * OBJECTIVE + SELF-DESCRIPTION + RESPONSE METHOD
	 * (from UserInfo.to_twitter_system_message)
	 *
	 * Enhanced: stronger persona, stance enforcement, encourages conflict.
	 */
	private buildSystemMessage(): string {
		const parts = [
			'# OBJECTIVE',
			"You are a real person on social media. You have strong opinions and a distinct voice.",
			'You are NOT an AI assistant. Never be generic, polite, or agreeable just for the sake of it.',
			'If you disagree with something, say so directly. If a post annoys you, push back.',
			'',
			'# WHO YOU ARE',
			`Name: ${this.name}`,
			`Bio: ${this.bio}`,
			`Interests: ${this.interests}`,
		];

		if (this.persona) {
			parts.push('', '# YOUR PERSONALITY AND STANCE', this.persona);
		}

		parts.push(
			'',
			'# RULES',
			'- Write like a real person, not a press release. Use casual language, hot takes, strong opinions.',
			'- NEVER start with "This is exactly the kind of..." or generic praise. Be specific.',
			'- If you see a post you disagree with based on your stance, CHALLENGE IT. Argue. Push back.',
			'- If you see a post you agree with, add something new — don\'t just repeat what they said.',
			'- Keep posts short (1-3 sentences). No hashtag spam. No corporate speak.',
			'- Your personality should be obvious from how you write.',
			'',
			'# RESPONSE METHOD',
			'Call one of the available functions. Choose the action that YOUR CHARACTER would actually do.'
		);

		return parts.join('\n');
	}

	/**
	 * Builds environment prompt following OASIS SocialEnvironment.to_text_prompt().
	 * Shows the current feed as JSON with comments (like OASIS _add_comments_to_posts).
	 *
	 * Enhanced: encourages diverse actions and authentic reactions.
	 */
	private buildEnvironmentPrompt(feed: FeedPost[]): string {
		if (feed.length === 0) {
			return 'The feed is empty. Write the first post — share your real opinion on whatever is on your mind.';
		}

		const postsJson = JSON.stringify(feed, null, 4);
		return [
			'Current feed:',
			postsJson,
			'',
			'React authentically. If something resonates, engage. If something bothers you, push back.',
			'You can also ignore the feed entirely and post about what YOU care about.',
			'Do NOT just agree with everyone. Be yourself.'
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
		if (!data.choices?.length) {
			throw new Error('MiniMax returned empty choices');
		}
		const message = data.choices[0].message;

		// Extract tool call (like OASIS response.info['tool_calls'])
		if (message?.tool_calls && message.tool_calls.length > 0) {
			const toolCall = message.tool_calls[0];
			let args: Record<string, unknown>;
			try {
				args =
					typeof toolCall.function.arguments === 'string'
						? JSON.parse(toolCall.function.arguments)
						: toolCall.function.arguments;
			} catch {
				args = {};
			}

			switch (toolCall.function.name) {
				case 'create_post':
					return { type: 'create_post', content: args.content };
				case 'like_post':
					return { type: 'like_post', post_id: args.post_id };
				case 'create_comment':
					return { type: 'create_comment', post_id: args.post_id, content: args.content };
				case 'follow':
					return { type: 'follow', user_name: args.user_name };
				case 'do_nothing':
					return { type: 'do_nothing' };
			}
		}

		// Fallback: if LLM responded with text instead of tool call, treat as post
		const content = (message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
		if (content) {
			return { type: 'create_post', content };
		}

		return { type: 'do_nothing' };
	}
}
