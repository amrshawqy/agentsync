import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFromCookies, isOk } from '@/lib/api';

interface Metrics {
	accounts: number;
	teams: number;
	users: number;
	agents: number;
	records: number;
	auditEvents: number;
}

const labels: Record<keyof Metrics, string> = {
	accounts: 'Accounts',
	teams: 'Teams',
	users: 'Members',
	agents: 'Agent identities',
	records: 'Records',
	auditEvents: 'Audit events',
};

export default async function AdminUsagePage() {
	const api = await apiFromCookies();
	const result = await api.get<Metrics>('/v1/admin/metrics');
	const data = isOk(result) ? result.data : null;
	if (!data) return <p>Failed to load usage.</p>;

	return (
		<div className="mx-auto max-w-3xl space-y-4">
			<h1 className="text-2xl font-semibold">Usage</h1>
			<div className="grid gap-3 md:grid-cols-3">
				{(Object.keys(labels) as Array<keyof Metrics>).map((k) => (
					<Card key={k}>
						<CardHeader>
							<CardTitle className="text-sm text-muted-foreground">{labels[k]}</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-semibold">{data[k]}</p>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
