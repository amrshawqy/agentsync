import { apiFromCookies, isOk } from '@/lib/api';

interface AdminTeam {
	id: string;
	slug: string;
	name: string;
	createdAt: string;
}

export default async function AdminTeamsPage() {
	const api = await apiFromCookies();
	const result = await api.get<AdminTeam[]>('/v1/admin/teams');
	const data = isOk(result) ? result.data : [];

	return (
		<div className="mx-auto max-w-4xl space-y-4">
			<h1 className="text-2xl font-semibold">All teams</h1>
			<div className="rounded-md border">
				<table className="w-full text-sm">
					<thead className="bg-muted/50 text-left">
						<tr>
							<th className="px-3 py-2">Name</th>
							<th className="px-3 py-2">Slug</th>
							<th className="px-3 py-2">Created</th>
						</tr>
					</thead>
					<tbody>
						{data.map((t) => (
							<tr key={t.id} className="border-t">
								<td className="px-3 py-2">{t.name}</td>
								<td className="px-3 py-2 text-muted-foreground">
									<code>{t.slug}</code>
								</td>
								<td className="px-3 py-2 text-muted-foreground">
									{new Date(t.createdAt).toLocaleString()}
								</td>
							</tr>
						))}
						{data.length === 0 ? (
							<tr>
								<td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
									No teams yet.
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			</div>
		</div>
	);
}
