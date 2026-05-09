import { apiFromCookies, isOk } from '@/lib/api';
import { redirect } from 'next/navigation';
import { type FieldDef, type RecordRow, TableView } from './table-view';

interface SchemaTable {
	workspace: { id: string; slug: string; name: string };
	tables: Array<{
		id: string;
		slug: string;
		name: string;
		fields: FieldDef[];
	}>;
}

export default async function TableViewPage({
	params,
}: {
	params: Promise<{ workspace: string; table: string }>;
}) {
	const { workspace, table } = await params;
	const api = await apiFromCookies();
	if (!api.isAuthenticated) redirect('/sign-in?return_to=/app');

	const overview = await api.get<SchemaTable[]>('/v1/schema/overview');
	if (!isOk(overview)) redirect('/app');
	const ws = overview.data.find((w) => w.workspace.slug === workspace);
	const tableMeta = ws?.tables.find((t) => t.slug === table);
	if (!ws || !tableMeta) redirect('/app');

	const records = await api.get<RecordRow[]>(`/v1/records?tableId=${tableMeta.id}&limit=50`);
	// The list endpoint returns { success, data, total, hasMore } — `data` is the array.
	const initial: RecordRow[] = isOk(records) ? (records.data as unknown as RecordRow[]) : [];

	return (
		<div className="space-y-4">
			<div>
				<p className="text-sm text-muted-foreground">{ws.workspace.name}</p>
				<h1 className="text-2xl font-semibold">{tableMeta.name}</h1>
			</div>
			<TableView
				tableId={tableMeta.id}
				workspaceSlug={ws.workspace.slug}
				tableSlug={tableMeta.slug}
				fields={tableMeta.fields}
				initialRecords={initial}
			/>
		</div>
	);
}
