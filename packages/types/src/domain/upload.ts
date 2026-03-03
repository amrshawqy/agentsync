import { z } from 'zod';

export const PresignedUploadResultSchema = z.object({
	uploadUrl: z.string().url(),
	downloadUrl: z.string().url(),
	key: z.string(),
	expiresAt: z.string().datetime(),
});

export type PresignedUploadResult = z.infer<typeof PresignedUploadResultSchema>;
