import { z } from 'zod';

export const AccountSchema = z.object({
	id: z.string().uuid(),
	primaryEmail: z.string().email().max(255).nullable(),
	emailVerifiedAt: z.coerce.date().nullable(),
	status: z.enum(['active', 'suspended']),
	limitsTier: z.enum(['unverified', 'verified']),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Account = z.infer<typeof AccountSchema>;

export const AgentIdentitySchema = z.object({
	id: z.string().uuid(),
	accountId: z.string().uuid(),
	thumbprint: z.string().max(255),
	publicKeyJwk: z.record(z.unknown()),
	label: z.string().max(255).nullable(),
	status: z.enum(['active', 'revoked']),
	lastSeenAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
});

export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;

export const TeamInviteSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	roleId: z.string().uuid(),
	invitedByUserId: z.string().uuid(),
	email: z.string().email().nullable(),
	expiresAt: z.coerce.date(),
	acceptedAt: z.coerce.date().nullable(),
	revokedAt: z.coerce.date().nullable(),
	status: z.enum(['pending', 'accepted', 'expired', 'revoked']),
	createdAt: z.coerce.date(),
});

export type TeamInvite = z.infer<typeof TeamInviteSchema>;
