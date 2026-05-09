import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFromCookies, isOk } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

interface Suggestion {
	id: string;
	tableId: string;
	fieldName: string;
	fieldSlug: string;
	fieldType: string;
	rationale?: string;
	agentHint?: string;
	suggestedBy?: string;
	createdAt: string;
}

async function approve(id: string) {
	'use server';
	const api = await apiFromCookies();
	await api.post(`/v1/suggestions/${id}/approve`);
	revalidatePath('/app/suggestions');
}

async function reject(id: string) {
	'use server';
	const api = await apiFromCookies();
	await api.post(`/v1/suggestions/${id}/reject`);
	revalidatePath('/app/suggestions');
}

export default async function SuggestionsPage() {
	const api = await apiFromCookies();
	if (!api.isAuthenticated) redirect('/sign-in');

	const result = await api.get<Suggestion[]>('/v1/suggestions');
	const items = isOk(result) ? result.data : [];

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Suggestions</h1>
				<p className="text-sm text-muted-foreground">
					Schema changes proposed by agents. Review and approve to apply, or reject to keep the
					current schema.
				</p>
			</div>
			{items.length === 0 ? (
				<p className="text-sm text-muted-foreground">No pending suggestions.</p>
			) : (
				<div className="space-y-3">
					{items.map((s) => (
						<Card key={s.id}>
							<CardHeader>
								<CardTitle className="text-base">
									Add field “{s.fieldName}” ({s.fieldType})
								</CardTitle>
								<CardDescription>{s.rationale ?? 'No rationale provided'}</CardDescription>
							</CardHeader>
							<CardContent className="flex justify-between">
								<div className="text-xs text-muted-foreground">
									slug <code>{s.fieldSlug}</code> · suggested{' '}
									{new Date(s.createdAt).toLocaleString()}
								</div>
								<div className="flex gap-2">
									<form action={reject.bind(null, s.id)}>
										<Button size="sm" variant="ghost" type="submit">
											Reject
										</Button>
									</form>
									<form action={approve.bind(null, s.id)}>
										<Button size="sm" type="submit">
											Approve
										</Button>
									</form>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
