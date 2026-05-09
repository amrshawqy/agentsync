import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFromCookies } from '@/lib/api';
import Link from 'next/link';

interface WorkspaceOverview {
	workspace: { id: string; slug: string; name: string };
	tables: Array<{ id: string; slug: string; name: string }>;
}

export default async function AppHomePage() {
	const api = await apiFromCookies();
	const overview = await api.get<WorkspaceOverview[]>('/v1/schema/overview');
	const data = 'success' in overview ? overview.data : [];

	if (data.length === 0) {
		return (
			<div className="mx-auto max-w-2xl">
				<Card>
					<CardHeader>
						<CardTitle>Get started</CardTitle>
						<CardDescription>You don't have any workspaces yet.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-sm">
							Deploy a blueprint to create your first workspace. The CRM blueprint is a good
							starting point for sales teams; the support, HR, PM, finance, and inventory blueprints
							cover other common cases.
						</p>
						<Link href="/app/blueprints" className="text-sm font-medium underline">
							Browse blueprints →
						</Link>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{data.map((ws) => (
				<section key={ws.workspace.id}>
					<h2 className="mb-3 text-lg font-semibold">{ws.workspace.name}</h2>
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
						{ws.tables.map((t) => (
							<Card key={t.id}>
								<CardHeader>
									<CardTitle className="text-base">{t.name}</CardTitle>
								</CardHeader>
								<CardContent>
									<Link
										className="text-sm font-medium text-primary underline-offset-4 hover:underline"
										href={`/app/${ws.workspace.slug}/${t.slug}`}
									>
										Open table →
									</Link>
								</CardContent>
							</Card>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
