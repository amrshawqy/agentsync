import { apiFromCookies, isOk } from '@/lib/api';
import Link from 'next/link';
import { redirect } from 'next/navigation';

interface WorkspaceOverview {
	workspace: { id: string; slug: string; name: string };
	tables: Array<{
		id: string;
		slug: string;
		name: string;
		fields: Array<{
			id: string;
			slug: string;
			name: string;
			fieldType: string;
			isRequired?: boolean;
		}>;
	}>;
}

export default async function SchemaPage() {
	const api = await apiFromCookies();
	if (!api.isAuthenticated) redirect('/sign-in');

	const overview = await api.get<WorkspaceOverview[]>('/v1/schema/overview');
	const data = isOk(overview) ? overview.data : [];

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Schema</h1>
				<p className="text-sm text-muted-foreground">
					Browse your tables and fields. Use your AI agent or the suggestion approval flow to evolve
					the schema.
				</p>
			</div>
			{data.map((ws) => (
				<section key={ws.workspace.id} className="space-y-2">
					<h2 className="text-lg font-medium">{ws.workspace.name}</h2>
					<div className="space-y-3">
						{ws.tables.map((t) => (
							<details key={t.id} className="rounded-md border">
								<summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
									{t.name} <span className="text-muted-foreground">— {t.fields.length} fields</span>
								</summary>
								<div className="border-t px-4 py-3">
									<table className="w-full text-sm">
										<thead className="text-left text-muted-foreground">
											<tr>
												<th className="py-1">Name</th>
												<th className="py-1">Slug</th>
												<th className="py-1">Type</th>
												<th className="py-1">Required</th>
											</tr>
										</thead>
										<tbody>
											{t.fields.map((f) => (
												<tr key={f.id} className="border-t">
													<td className="py-1.5">{f.name}</td>
													<td className="py-1.5 text-xs">
														<code>{f.slug}</code>
													</td>
													<td className="py-1.5 text-xs">{f.fieldType}</td>
													<td className="py-1.5 text-xs">{f.isRequired ? 'yes' : 'no'}</td>
												</tr>
											))}
										</tbody>
									</table>
									<p className="mt-3 text-xs text-muted-foreground">
										To add or modify fields, ask your AI agent (e.g. "add a region field to {t.name}
										") or review pending{' '}
										<Link href="/app/suggestions" className="underline">
											suggestions
										</Link>
										.
									</p>
								</div>
							</details>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
