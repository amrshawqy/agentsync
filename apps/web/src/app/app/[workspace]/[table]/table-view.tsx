'use client';

import { Button } from '@/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ProvenanceDrawer } from './provenance-drawer';

export interface FieldDef {
	id: string;
	slug: string;
	name: string;
	fieldType: string;
	isRequired?: boolean;
	options?: Array<{ value: string; label: string }> | null;
	constraints?: { transitions?: Record<string, string[]> } | null;
}

export interface RecordRow {
	id: string;
	data: Record<string, unknown>;
	provenance: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export function TableView({
	tableId,
	workspaceSlug,
	tableSlug,
	fields,
	initialRecords,
}: {
	tableId: string;
	workspaceSlug: string;
	tableSlug: string;
	fields: FieldDef[];
	initialRecords: RecordRow[];
}) {
	const [records, setRecords] = useState(initialRecords);
	const [openRecord, setOpenRecord] = useState<RecordRow | null>(null);
	const [pending, start] = useTransition();
	void workspaceSlug;
	void tableSlug;

	function patch(recordId: string, patchData: Record<string, unknown>) {
		start(async () => {
			const res = await fetch(`/v1/records/${recordId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ data: patchData }),
			});
			if (!res.ok) {
				toast.error('Failed to update');
				return;
			}
			const json = await res.json();
			setRecords((rs) =>
				rs.map((r) => (r.id === recordId ? { ...r, data: { ...r.data, ...json.data.data } } : r)),
			);
			toast.success('Saved', {
				action: {
					label: 'Undo',
					onClick: async () => {
						const list = await fetch(`/v1/records/${recordId}/revisions?limit=2`).then((r) =>
							r.json(),
						);
						const prev = list.data?.[1];
						if (!prev) {
							toast.error('No previous revision to undo to.');
							return;
						}
						const r = await fetch(`/v1/records/${recordId}/revert`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ revisionId: prev.id }),
						});
						if (r.ok) {
							const reverted = await r.json();
							setRecords((rs) =>
								rs.map((x) => (x.id === recordId ? { ...x, data: reverted.data.data } : x)),
							);
							toast.success('Reverted');
						} else {
							toast.error('Undo failed');
						}
					},
				},
			});
		});
	}

	async function createBlank() {
		const data: Record<string, unknown> = {};
		for (const f of fields) {
			if (f.isRequired) {
				if (f.fieldType === 'select' && f.options?.[0]) data[f.slug] = f.options[0].value;
				else if (f.fieldType === 'text' || f.fieldType === 'email') data[f.slug] = 'New';
				else data[f.slug] = null;
			}
		}
		const res = await fetch('/v1/records', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tableId, data }),
		});
		if (!res.ok) {
			toast.error('Failed to create record');
			return;
		}
		const json = await res.json();
		setRecords((rs) => [json.data, ...rs]);
	}

	return (
		<div className="space-y-3">
			<div className="flex justify-between">
				<p className="text-sm text-muted-foreground">
					{records.length} record{records.length === 1 ? '' : 's'}
				</p>
				<Button size="sm" onClick={createBlank}>
					New record
				</Button>
			</div>
			<div className="overflow-x-auto rounded-md border">
				<table className="w-full text-sm">
					<thead className="bg-muted/50 text-left">
						<tr>
							{fields.map((f) => (
								<th key={f.id} className="px-3 py-2 font-medium">
									{f.name}
								</th>
							))}
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody>
						{records.map((r) => (
							<tr key={r.id} className="border-t">
								{fields.map((f) => (
									<td key={f.id} className="px-3 py-2">
										<CellEditor
											field={f}
											value={r.data[f.slug]}
											onCommit={(next) => {
												if (next === r.data[f.slug]) return;
												patch(r.id, { [f.slug]: next });
											}}
										/>
									</td>
								))}
								<td className="px-3 py-2 text-right">
									<button
										type="button"
										className="text-xs text-muted-foreground underline-offset-4 hover:underline"
										onClick={() => setOpenRecord(r)}
									>
										History
									</button>
								</td>
							</tr>
						))}
						{records.length === 0 ? (
							<tr>
								<td
									colSpan={fields.length + 1}
									className="px-3 py-6 text-center text-sm text-muted-foreground"
								>
									No records yet. Create one with the button above.
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			</div>
			{pending ? <p className="text-xs text-muted-foreground">Saving…</p> : null}
			{openRecord ? (
				<ProvenanceDrawer record={openRecord} onClose={() => setOpenRecord(null)} fields={fields} />
			) : null}
		</div>
	);
}

function CellEditor({
	field,
	value,
	onCommit,
}: {
	field: FieldDef;
	value: unknown;
	onCommit: (v: unknown) => void;
}) {
	const [draft, setDraft] = useState<string>(value == null ? '' : String(value));

	if (field.fieldType === 'select' && field.options) {
		const transitions = field.constraints?.transitions;
		const currentVal = String(value ?? '');
		const allowed = new Set(transitions?.[currentVal] ?? field.options.map((o) => o.value));
		if (currentVal) allowed.add(currentVal);
		return (
			<select
				className="h-8 rounded-md border bg-background px-2 text-sm"
				value={currentVal}
				onChange={(e) => onCommit(e.target.value)}
			>
				{field.options.map((o) => (
					<option key={o.value} value={o.value} disabled={!allowed.has(o.value)}>
						{o.label}
					</option>
				))}
			</select>
		);
	}

	if (field.fieldType === 'boolean') {
		const checked = value === true;
		return <input type="checkbox" checked={checked} onChange={(e) => onCommit(e.target.checked)} />;
	}

	return (
		<input
			className="h-8 w-full rounded-md border bg-background px-2 text-sm"
			value={draft}
			type={
				field.fieldType === 'number' || field.fieldType === 'currency'
					? 'number'
					: field.fieldType === 'date'
						? 'date'
						: field.fieldType === 'email'
							? 'email'
							: 'text'
			}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={() => {
				const next: unknown =
					field.fieldType === 'number' || field.fieldType === 'currency'
						? draft === ''
							? null
							: Number(draft)
						: draft;
				onCommit(next);
			}}
		/>
	);
}
