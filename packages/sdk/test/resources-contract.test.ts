import { describe, expect, it, vi } from 'vitest';
import { EventResource } from '../src/resources/events.js';
import { AutomationResource } from '../src/resources/automations.js';
import { BlueprintResource } from '../src/resources/blueprints.js';
import { MarketplaceResource } from '../src/resources/marketplace.js';
import { UploadResource } from '../src/resources/uploads.js';

describe('SDK resource contracts', () => {
	it('events.subscribe uses /v1/events/subscriptions and defaults callbackType=sse', async () => {
		const request = vi.fn(async () => ({ success: true }));
		const resource = new EventResource(request);

		await resource.subscribe({ eventType: 'record.created' });

		expect(request).toHaveBeenCalledWith(
			'POST',
			'/v1/events/subscriptions',
			expect.objectContaining({
				eventType: 'record.created',
				callbackType: 'sse',
			}),
		);
	});

	it('automations.toggle uses /toggle endpoint', async () => {
		const request = vi.fn(async () => ({ success: true }));
		const resource = new AutomationResource(request);

		await resource.toggle('auto-1', true);

		expect(request).toHaveBeenCalledWith(
			'PATCH',
			'/v1/automations/auto-1/toggle',
			{ active: true },
		);
	});

	it('blueprints.evolve sends raw changes payload', async () => {
		const request = vi.fn(async () => ({ success: true }));
		const resource = new BlueprintResource(request);

		await resource.evolve('crm', { addField: { slug: 'phone' } });

		expect(request).toHaveBeenCalledWith(
			'POST',
			'/v1/blueprints/crm/evolve',
			{ addField: { slug: 'phone' } },
		);
	});

	it('marketplace routes map to server route structure', async () => {
		const request = vi.fn(async () => ({ success: true }));
		const resource = new MarketplaceResource(request);

		await resource.search({ query: 'crm', category: 'sales', tags: ['lead'], limit: 5, offset: 10 });
		await resource.submitReview({ blueprintId: 'bp-1', rating: 5, title: 'Great' });
		await resource.listReviews('bp-1');

		expect(request).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/v1/marketplace/search?q=crm&category=sales&tags=lead&limit=5&offset=10',
		);
		expect(request).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/v1/marketplace/blueprints/bp-1/reviews',
			{ rating: 5, title: 'Great', body: undefined },
		);
		expect(request).toHaveBeenNthCalledWith(
			3,
			'GET',
			'/v1/marketplace/blueprints/bp-1/reviews',
		);
	});

	it('uploads routes map to presign/download API contracts', async () => {
		const request = vi.fn(async () => ({ success: true }));
		const resource = new UploadResource(request);

		await resource.presign({ filename: 'file.pdf', contentType: 'application/pdf' });
		await resource.download('team/file.pdf');

		expect(request).toHaveBeenNthCalledWith(
			1,
			'POST',
			'/v1/uploads/presign',
			{
				fileName: 'file.pdf',
				mimeType: 'application/pdf',
				recordId: undefined,
			},
		);
		expect(request).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/v1/uploads/download?path=team%2Ffile.pdf',
		);
	});
});
