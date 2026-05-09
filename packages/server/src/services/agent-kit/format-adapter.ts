import type { AgentKitFormat } from '@agentsync/types';

interface KitContent {
	identity: string;
	instructions: string;
	behavioralRules: string;
	skills: Array<{
		command: string;
		description: string;
		steps: Array<{ tool: string; params: Record<string, unknown> }>;
	}>;
	connectionConfig: {
		serverUrl: string;
		authType: string;
		clientId?: string;
		scopes?: string[];
	};
}

export class FormatAdapter {
	adapt(format: AgentKitFormat, content: KitContent): Record<string, string> {
		switch (format) {
			case 'claude-desktop':
				return this.formatClaudeDesktop(content);
			case 'claude-code':
				return this.formatClaudeCode(content);
			case 'cursor':
				return this.formatCursor(content);
			case 'chatgpt':
				return this.formatChatGpt(content);
			case 'raw':
				return this.formatRaw(content);
		}
	}

	private formatClaudeDesktop(content: KitContent): Record<string, string> {
		const config = {
			mcpServers: {
				agentsync: {
					command: 'http',
					url: `${content.connectionConfig.serverUrl}/mcp`,
					auth: {
						type: 'oauth2',
						clientId: content.connectionConfig.clientId,
						scopes: content.connectionConfig.scopes,
					},
				},
			},
			systemPrompt: [content.identity, content.instructions, content.behavioralRules].join('\n\n'),
			skills: content.skills,
		};

		return {
			'claude_desktop_config.json': JSON.stringify(config, null, 2),
		};
	}

	private formatClaudeCode(content: KitContent): Record<string, string> {
		const mcpConfig = {
			mcpServers: {
				agentsync: {
					type: 'streamable-http' as const,
					url: `${content.connectionConfig.serverUrl}/mcp`,
				},
			},
		};

		const claudeMd = [
			'# AgentSync Configuration',
			'',
			'## Identity',
			content.identity,
			'',
			'## Instructions',
			content.instructions,
			'',
			'## Behavioral Rules',
			content.behavioralRules,
			'',
			'## Skills',
			...content.skills.map((s) => `- \`${s.command}\`: ${s.description}`),
		].join('\n');

		return {
			'.mcp.json': JSON.stringify(mcpConfig, null, 2),
			'CLAUDE.md': claudeMd,
		};
	}

	private formatCursor(content: KitContent): Record<string, string> {
		const rules = [
			content.identity,
			'',
			content.instructions,
			'',
			content.behavioralRules,
			'',
			'## Available Skills',
			...content.skills.map((s) => `- ${s.command}: ${s.description}`),
			'',
			`## MCP Server: ${content.connectionConfig.serverUrl}/mcp`,
		].join('\n');

		return {
			'.cursorrules': rules,
		};
	}

	private formatChatGpt(content: KitContent): Record<string, string> {
		const config = {
			name: 'AgentSync Assistant',
			instructions: [content.identity, content.instructions, content.behavioralRules].join('\n\n'),
			actions: content.skills.map((s) => ({
				name: s.command.replace('/', ''),
				description: s.description,
				steps: s.steps,
			})),
			api: {
				url: content.connectionConfig.serverUrl,
				auth: content.connectionConfig.authType,
			},
		};

		return {
			'chatgpt_config.json': JSON.stringify(config, null, 2),
		};
	}

	private formatRaw(content: KitContent): Record<string, string> {
		return {
			'agent-kit.json': JSON.stringify(content, null, 2),
		};
	}
}
