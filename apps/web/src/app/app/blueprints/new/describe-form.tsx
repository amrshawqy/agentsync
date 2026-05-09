'use client';

import { Button } from '@/components/ui/button';
import { useState, useTransition } from 'react';

interface Draft {
	slug: string;
	name: string;
	description: string;
	schemaDefinition: {
		tables: Array<{
			slug: string;
			name: string;
			description?: string;
			fields: Array<{ slug: string; name: string; fieldType: string; isRequired?: boolean }>;
		}>;
	};
}

export function DescribeForm({
	draft,
	deploy,
}: {
	draft: (description: string) => Promise<{ ok: true; data: Draft } | { ok: false; error: string }>;
	deploy: (data: Draft) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
	const [pending, start] = useTransition();
	const [description, setDescription] = useState('');
	const [drafted, setDrafted] = useState<Draft | null>(null);
	const [error, setError] = useState<string | null>(null);

	return (
		<div className="space-y-4">
			{!drafted ? (
				<>
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="e.g. We run a small clinic. We see patients, schedule appointments, and bill insurance providers."
						className="min-h-[140px] w-full rounded-md border bg-background p-3 text-sm"
					/>
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
					<Button
						disabled={pending || description.trim().length < 10}
						onClick={() => {
							setError(null);
							start(async () => {
								const r = await draft(description);
								if (r.ok) setDrafted(r.data);
								else setError(r.error);
							});
						}}
					>
						{pending ? 'Drafting…' : 'Draft my blueprint'}
					</Button>
				</>
			) : (
				<div className="space-y-4">
					<div>
						<h3 className="text-lg font-semibold">{drafted.name}</h3>
						<p className="text-sm text-muted-foreground">{drafted.description}</p>
					</div>
					<div className="space-y-3">
						{drafted.schemaDefinition.tables.map((t) => (
							<details key={t.slug} className="rounded-md border" open>
								<summary className="cursor-pointer px-3 py-2 text-sm font-medium">
									{t.name} <span className="text-muted-foreground">— {t.fields.length} fields</span>
								</summary>
								<table className="w-full text-sm">
									<tbody>
										{t.fields.map((f) => (
											<tr key={f.slug} className="border-t">
												<td className="px-3 py-1.5">{f.name}</td>
												<td className="px-3 py-1.5 text-xs text-muted-foreground">{f.fieldType}</td>
												<td className="px-3 py-1.5 text-xs">{f.isRequired ? 'required' : ''}</td>
											</tr>
										))}
									</tbody>
								</table>
							</details>
						))}
					</div>
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
					<div className="flex gap-2">
						<Button
							variant="ghost"
							onClick={() => {
								setDrafted(null);
								setError(null);
							}}
						>
							Start over
						</Button>
						<Button
							disabled={pending}
							onClick={() => {
								setError(null);
								start(async () => {
									const r = await deploy(drafted);
									if (!r.ok) setError(r.error);
								});
							}}
						>
							{pending ? 'Deploying…' : 'Deploy this blueprint'}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
