import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFromCookies } from '@/lib/api';
import { redirect } from 'next/navigation';
import { redeemSetupToken } from './actions';

export default async function SetupPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; ok?: string }>;
}) {
	const { error, ok } = await searchParams;
	const api = await apiFromCookies();
	if (!api.isAuthenticated) redirect('/sign-in?return_to=/setup');

	const status = await api.get<{ hasSuperAdmin: boolean; bootstrapEmailConfigured: boolean }>(
		'/v1/auth/setup/status',
	);
	const data = 'success' in status ? status.data : null;

	return (
		<main className="container mx-auto max-w-xl py-12">
			<Card>
				<CardHeader>
					<CardTitle>First-run setup</CardTitle>
					<CardDescription>
						Promote yourself to super-admin to finish provisioning the server.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{data?.hasSuperAdmin ? (
						<p className="text-sm text-muted-foreground">
							A super-admin already exists. Setup is complete.
						</p>
					) : data?.bootstrapEmailConfigured ? (
						<p className="text-sm text-muted-foreground">
							This server is configured to promote a specific email address. Sign in with that
							account and you'll be elevated automatically after email verification.
						</p>
					) : (
						<>
							<p className="text-sm text-muted-foreground">
								Paste the one-time setup token printed in the server logs at first startup.
							</p>
							<form
								className="space-y-3"
								action={async (formData) => {
									'use server';
									const token = String(formData.get('token') ?? '').trim();
									const result = await redeemSetupToken(token);
									if ('success' in result) redirect('/setup?ok=1');
									redirect(`/setup?error=${encodeURIComponent(result.error.message)}`);
								}}
							>
								<input
									name="token"
									required
									className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
									placeholder="setup token"
								/>
								<Button type="submit" className="w-full">
									Redeem
								</Button>
							</form>
						</>
					)}
					{error ? (
						<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					) : null}
					{ok ? (
						<div className="rounded-md border border-emerald-400/40 bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
							You are now a super-admin.{' '}
							<a href="/app" className="underline">
								Go to the app →
							</a>
						</div>
					) : null}
				</CardContent>
			</Card>
		</main>
	);
}
