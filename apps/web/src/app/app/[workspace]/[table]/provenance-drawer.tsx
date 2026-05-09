'use client';

import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { FieldDef, RecordRow } from './table-view';

interface Revision {
	id: string;
	revisionKind: string;
	createdAt: string;
	createdBy: string | null;
	note: string | null;
	data: Record<string, unknown>;
}

export function ProvenanceDrawer({
	record,
	fields,
	onClose,
}: {
	record: RecordRow;
	fields: FieldDef[];
	onClose: () => void;
}) {
	const [revisions, setRevisions] = useState<Revision[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		fetch(`/v1/records/${record.id}/revisions?limit=20`)
			.then((r) => r.json())
			.then((json) => setRevisions(json.data ?? []))
			.finally(() => setLoading(false));
	}, [record.id]);

	async function revertTo(revisionId: string) {
		const res = await fetch(`/v1/records/${record.id}/revert`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ revisionId }),
		});
		if (res.ok) {
			toast.success('Reverted. Refresh to see the change.');
			onClose();
		} else {
			toast.error('Revert failed');
		}
	}

	return (
		<div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
			<aside
				className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col gap-4 overflow-y-auto bg-background p-6 shadow-lg"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">Record history</h2>
					<button type="button" onClick={onClose} className="text-sm text-muted-foreground">
						Close
					</button>
				</div>
				<section>
					<h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Provenance
					</h3>
					<dl className="space-y-1 text-sm">
						{fields.map((f) => {
							const p = (
								record.provenance as Record<
									string,
									{ agent?: string; at?: string; confidence?: number }
								>
							)[f.slug];
							if (!p) return null;
							return (
								<div key={f.id} className="flex justify-between gap-2">
									<dt className="text-muted-foreground">{f.name}</dt>
									<dd className="text-right">
										{p.agent ?? '—'}
										{typeof p.confidence === 'number' ? (
											<span className="ml-1 text-xs text-muted-foreground">
												({Math.round(p.confidence * 100)}%)
											</span>
										) : null}
										<div className="text-xs text-muted-foreground">
											{p.at ? new Date(p.at).toLocaleString() : ''}
										</div>
									</dd>
								</div>
							);
						})}
					</dl>
				</section>
				<section>
					<h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Revisions
					</h3>
					{loading ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : revisions.length === 0 ? (
						<p className="text-sm text-muted-foreground">No revisions yet.</p>
					) : (
						<ul className="space-y-2 text-sm">
							{revisions.map((rev, i) => (
								<li
									key={rev.id}
									className="flex items-center justify-between rounded-md border p-2"
								>
									<div>
										<p className="font-medium capitalize">{rev.revisionKind}</p>
										<p className="text-xs text-muted-foreground">
											{new Date(rev.createdAt).toLocaleString()}
										</p>
										{rev.note ? <p className="text-xs italic">{rev.note}</p> : null}
									</div>
									{i > 0 ? (
										<Button size="sm" variant="ghost" onClick={() => revertTo(rev.id)}>
											Revert
										</Button>
									) : (
										<span className="text-xs text-muted-foreground">current</span>
									)}
								</li>
							))}
						</ul>
					)}
				</section>
			</aside>
		</div>
	);
}
