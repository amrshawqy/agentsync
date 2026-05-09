import type { Database } from '@agentsync/db';
import { blueprintReviews, blueprints } from '@agentsync/db';
import type { CreateBlueprintReview } from '@agentsync/types';
import { and, eq, ilike, sql } from 'drizzle-orm';

export class MarketplaceService {
	constructor(private db: Database) {}

	async submitReview(teamId: string, userId: string, input: CreateBlueprintReview) {
		const [review] = await this.db
			.insert(blueprintReviews)
			.values({
				blueprintId: input.blueprintId,
				teamId,
				userId,
				rating: input.rating,
				title: input.title,
				body: input.body,
			})
			.returning();

		// Update blueprint average rating
		const [avg] = await this.db
			.select({ avgRating: sql<number>`avg(rating)::numeric(3,2)` })
			.from(blueprintReviews)
			.where(eq(blueprintReviews.blueprintId, input.blueprintId));

		if (avg) {
			await this.db
				.update(blueprints)
				.set({ avgRating: String(avg.avgRating) })
				.where(eq(blueprints.id, input.blueprintId));
		}

		return review;
	}

	async listReviews(blueprintId: string, limit = 20, offset = 0) {
		const results = await this.db
			.select()
			.from(blueprintReviews)
			.where(eq(blueprintReviews.blueprintId, blueprintId))
			.orderBy(blueprintReviews.createdAt)
			.limit(limit)
			.offset(offset);

		const [countResult] = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(blueprintReviews)
			.where(eq(blueprintReviews.blueprintId, blueprintId));

		return {
			data: results,
			total: Number(countResult?.count ?? 0),
			limit,
			offset,
		};
	}

	async searchBlueprints(
		query?: string,
		category?: string,
		tags?: string[],
		limit = 20,
		offset = 0,
	) {
		const conditions = [eq(blueprints.isPublished, true)];

		if (query) {
			conditions.push(
				sql`(${ilike(blueprints.name, `%${query}%`)} OR ${ilike(blueprints.description, `%${query}%`)})`,
			);
		}

		if (category) {
			conditions.push(eq(blueprints.category, category));
		}

		if (tags?.length) {
			conditions.push(sql`${blueprints.marketplaceTags} && ${tags}`);
		}

		const whereClause = and(...conditions);

		const results = await this.db
			.select()
			.from(blueprints)
			.where(whereClause)
			.orderBy(blueprints.installCount)
			.limit(limit)
			.offset(offset);

		const [countResult] = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(blueprints)
			.where(whereClause);

		return {
			data: results.map((b) => ({
				id: b.id,
				slug: b.slug,
				name: b.name,
				description: b.description,
				category: b.category,
				version: b.version,
				marketplaceTags: b.marketplaceTags,
				installCount: b.installCount,
				avgRating: b.avgRating,
			})),
			total: Number(countResult?.count ?? 0),
			limit,
			offset,
		};
	}
}
