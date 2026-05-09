import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFromCookies, isOk } from '@/lib/api';

interface Diagnostics {
	db: { ok: boolean; detail?: string };
	cache: { ok: boolean; detail?: string };
	email: { ok: boolean; detail?: string; provider: string };
	oidc: { ok: boolean; configured: boolean };
	anthropic: { ok: boolean; configured: boolean };
}

function StatusDot({ ok }: { ok: boolean }) {
	return (
		<span
			className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-destructive'}`}
		/>
	);
}

export default async function AdminHealthPage() {
	const api = await apiFromCookies();
	const result = await api.get<Diagnostics>('/v1/admin/diagnostics');
	const data = isOk(result) ? result.data : null;
	if (!data) return <p>Failed to load diagnostics.</p>;

	const items: Array<{ label: string; ok: boolean; detail?: string }> = [
		{ label: 'Database', ok: data.db.ok, detail: data.db.detail },
		{ label: 'Cache (Redis)', ok: data.cache.ok, detail: data.cache.detail },
		{ label: `Email (${data.email.provider})`, ok: data.email.ok, detail: data.email.detail },
		{
			label: 'OIDC SSO',
			ok: data.oidc.ok,
			detail: data.oidc.configured ? 'configured' : 'not configured (optional)',
		},
		{
			label: 'Anthropic (blueprint drafts)',
			ok: data.anthropic.ok,
			detail: data.anthropic.configured ? 'configured' : 'not configured (optional)',
		},
	];

	return (
		<div className="mx-auto max-w-2xl space-y-4">
			<h1 className="text-2xl font-semibold">Health</h1>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Server diagnostics</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{items.map((item) => (
						<div key={item.label} className="flex items-center gap-3 text-sm">
							<StatusDot ok={item.ok} />
							<span className="font-medium">{item.label}</span>
							{item.detail ? <span className="text-muted-foreground">— {item.detail}</span> : null}
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
