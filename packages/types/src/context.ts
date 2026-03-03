import { z } from 'zod';
import { PermissionAction } from './enums.js';

export const RequestContextSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  agentId: z.string().optional(),
  limitsTier: z.enum(['unverified', 'verified']).optional(),
  permissions: z.record(z.record(z.record(z.object({
    actions: z.array(PermissionAction),
    field_access: z.object({
      hidden: z.array(z.string()).default([]),
      read_only: z.array(z.string()).default([]),
    }).optional(),
    record_filters: z.record(z.record(z.string())).optional(),
  })))),
});

export type RequestContext = z.infer<typeof RequestContextSchema>;
