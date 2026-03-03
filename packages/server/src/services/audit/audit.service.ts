import { eq, and, sql, desc } from 'drizzle-orm';
import type { Database } from '@agentsync/db';
import { auditLog } from '@agentsync/db';
import type { CreateAuditLog, RequestContext } from '@agentsync/types';

export class AuditService {
	constructor(private db: Database) {}

	async log(ctx: RequestContext, input: CreateAuditLog) {
		const [entry] = await this.db
			.insert(auditLog)
			.values({
				teamId: ctx.teamId,
				userId: ctx.userId,
				agentId: ctx.agentId,
				action: input.action,
				resourceType: input.resourceType,
				resourceId: input.resourceId,
				tableId: input.tableId,
				reason: input.reason,
				changes: input.changes,
				provenance: input.provenance,
				metadata: input.metadata,
			})
			.returning();

		return entry;
	}

	async query(params: {
		teamId: string;
		resourceType?: string;
		resourceId?: string;
		action?: string;
		userId?: string;
		limit?: number;
		offset?: number;
	}) {
		const conditions = [eq(auditLog.teamId, params.teamId)];

		if (params.resourceType) {
			conditions.push(eq(auditLog.resourceType, params.resourceType));
		}
		if (params.resourceId) {
			conditions.push(eq(auditLog.resourceId, params.resourceId));
		}
		if (params.action) {
			conditions.push(eq(auditLog.action, params.action));
		}
		if (params.userId) {
			conditions.push(eq(auditLog.userId, params.userId));
		}

		const results = await this.db
			.select()
			.from(auditLog)
			.where(and(...conditions))
			.orderBy(desc(auditLog.createdAt))
			.limit(params.limit ?? 50)
			.offset(params.offset ?? 0);

		const [countResult] = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(auditLog)
			.where(and(...conditions));

		return {
			data: results,
			total: Number(countResult?.count ?? 0),
		};
	}
}
