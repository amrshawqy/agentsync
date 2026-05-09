import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { startEmailFlow } from './actions';
import { EmailForm } from './email-form';

async function fetchOidcAvailability(): Promise<boolean> {
	try {
		const res = await fetch(
			`${process.env.AGENTSYNC_API_URL ?? 'http://localhost:3000'}/v1/auth/sso/start`,
			{ method: 'GET', redirect: 'manual', cache: 'no-store' },
		);
		// 302 → SSO is configured. 404 → not configured.
		return res.status === 302 || res.status === 303 || res.status === 307;
	} catch {
		return false;
	}
}

export default async function SignInPage({
	searchParams,
}: {
	searchParams: Promise<{ return_to?: string; error?: string }>;
}) {
	const { return_to, error } = await searchParams;
	const ssoAvailable = await fetchOidcAvailability();

	return (
		<main className="container flex min-h-screen items-center justify-center py-12">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-xl">Sign in to AgentSync</CardTitle>
					<CardDescription>Access your team and connect AI agents.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{error ? (
						<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					) : null}
					{ssoAvailable ? (
						<Button asChild className="w-full" size="lg">
							<Link
								href={`/v1/auth/sso/start${return_to ? `?return_to=${encodeURIComponent(return_to)}` : ''}`}
							>
								Continue with single sign-on
							</Link>
						</Button>
					) : (
						<p className="text-sm text-muted-foreground">
							SSO is not configured on this server. Sign in via email below.
						</p>
					)}
					<div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
						<span className="h-px flex-1 bg-border" />
						or with email
						<span className="h-px flex-1 bg-border" />
					</div>
					<EmailForm action={startEmailFlow} />
				</CardContent>
			</Card>
		</main>
	);
}
