import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFromCookies, isOk } from '@/lib/api';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { deployBlueprint } from './actions';

interface Blueprint {
	id: string;
	slug: string;
	name: string;
	description: string;
	category: string;
	version: number;
}

export default async function BlueprintsPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const { error } = await searchParams;
	const api = await apiFromCookies();
	if (!api.isAuthenticated) redirect('/sign-in');

	const result = await api.get<Blueprint[]>('/v1/blueprints');
	const blueprints = isOk(result) ? result.data : [];

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Blueprints</h1>
				<p className="text-sm text-muted-foreground">
					Deploy a ready-made data model — or describe what you want to track and have AgentSync
					draft one for you.
				</p>
			</div>
			{error ? (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
					{error}
				</div>
			) : null}
			<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Describe what you track</CardTitle>
						<CardDescription>
							Describe your business in a sentence; AgentSync drafts a blueprint for you.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild variant="secondary" size="sm">
							<Link href="/app/blueprints/new">Open wizard →</Link>
						</Button>
					</CardContent>
				</Card>
				{blueprints.map((bp) => (
					<Card key={bp.id}>
						<CardHeader>
							<CardTitle className="text-base">{bp.name}</CardTitle>
							<CardDescription>{bp.description}</CardDescription>
						</CardHeader>
						<CardContent>
							<form
								action={async (formData) => {
									'use server';
									const r = await deployBlueprint(String(formData.get('slug')));
									if (isOk(r)) redirect('/app');
									redirect(`/app/blueprints?error=${encodeURIComponent(r.error.message)}`);
								}}
							>
								<input type="hidden" name="slug" value={bp.slug} />
								<Button type="submit" size="sm">
									Deploy
								</Button>
							</form>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
