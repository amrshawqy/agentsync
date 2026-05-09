import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyMcpUrl } from './copy-button';

function getPublicBase() {
	return process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
}

export default function ConnectPage() {
	const mcpUrl = `${getPublicBase()}/mcp`;
	return (
		<main className="container mx-auto max-w-2xl py-12">
			<Card>
				<CardHeader>
					<CardTitle>Connect your AI agent</CardTitle>
					<CardDescription>
						Paste this URL into your agent's MCP / tools settings. Your agent will ask you to sign
						in the first time it connects — there's nothing else to configure.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<CopyMcpUrl url={mcpUrl} />
					<div className="space-y-2 text-sm text-muted-foreground">
						<p>
							<strong>Step 1.</strong> Open your AI agent (Claude Desktop, Cursor, Cline, Continue,
							OpenClaw, etc.).
						</p>
						<p>
							<strong>Step 2.</strong> Go to its MCP server settings and add a new server with the
							URL above.
						</p>
						<p>
							<strong>Step 3.</strong> The first time you ask the agent to do anything, it will open
							a browser tab to sign in. Approve, and you're done.
						</p>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
