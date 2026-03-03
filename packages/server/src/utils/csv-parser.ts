import { parse } from 'csv-parse/sync';

export interface CsvParseOptions {
	/** Use first row as headers (default: true) */
	headers?: boolean;
	/** Column delimiter (default: ',') */
	delimiter?: string;
	/** Map CSV column names to record field names */
	fieldMapping?: Record<string, string>;
}

/**
 * Parse a CSV string into an array of record objects.
 */
export function parseCsv(
	csvContent: string,
	options?: CsvParseOptions,
): Record<string, unknown>[] {
	const useHeaders = options?.headers !== false;
	const delimiter = options?.delimiter ?? ',';

	const raw = parse(csvContent, {
		columns: useHeaders,
		delimiter,
		skip_empty_lines: true,
		trim: true,
		cast: true,
		cast_date: false,
	}) as Record<string, unknown>[];

	if (!options?.fieldMapping) return raw;

	// Apply field mapping
	return raw.map((row) => {
		const mapped: Record<string, unknown> = {};
		for (const [csvCol, value] of Object.entries(row)) {
			const fieldName = options.fieldMapping![csvCol] ?? csvCol;
			mapped[fieldName] = value;
		}
		return mapped;
	});
}

/**
 * Parse a base64-encoded CSV string into records.
 * Useful for MCP tool input where binary data is base64-encoded.
 */
export function parseCsvBase64(
	base64Content: string,
	options?: CsvParseOptions,
): Record<string, unknown>[] {
	const csvContent = Buffer.from(base64Content, 'base64').toString('utf-8');
	return parseCsv(csvContent, options);
}
