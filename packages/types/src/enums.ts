import { z } from 'zod';

// Field types
export const FieldType = z.enum([
  'text', 'number', 'date', 'datetime', 'boolean',
  'email', 'url', 'phone', 'currency',
  'select', 'multi_select',
  'relation', 'formula',
  'user', 'json', 'rollup', 'attachment',
]);
export type FieldType = z.infer<typeof FieldType>;

// Event types
export const EventType = z.enum([
  'record.created', 'record.updated', 'record.deleted',
  'field.changed',
  'relation.added', 'relation.removed',
  'schema.evolved',
  'blueprint.deployed', 'blueprint.evolved',
  'member.joined', 'member.removed',
]);
export type EventType = z.infer<typeof EventType>;

// User status
export const UserStatus = z.enum(['invited', 'active', 'suspended', 'deactivated']);
export type UserStatus = z.infer<typeof UserStatus>;

// Team plan
export const TeamPlan = z.enum(['free', 'team', 'business', 'enterprise']);
export type TeamPlan = z.infer<typeof TeamPlan>;

// Schema source layer
export const SourceLayer = z.enum(['core', 'blueprint', 'workspace']);
export type SourceLayer = z.infer<typeof SourceLayer>;

// Permission actions
export const PermissionAction = z.enum(['create', 'read', 'update', 'delete']);
export type PermissionAction = z.infer<typeof PermissionAction>;

// Callback type for subscriptions
export const CallbackType = z.enum(['sse', 'webhook']);
export type CallbackType = z.infer<typeof CallbackType>;

// Suggestion status
export const SuggestionStatus = z.enum(['pending', 'approved', 'rejected']);
export type SuggestionStatus = z.infer<typeof SuggestionStatus>;

// Audit action
export const AuditAction = z.enum([
  'create', 'read', 'update', 'delete', 'query',
  'schema_change', 'login', 'logout', 'permission_change',
  'blueprint_deploy', 'agent_kit_generate',
]);
export type AuditAction = z.infer<typeof AuditAction>;

// Resource types for audit
export const ResourceType = z.enum([
  'record', 'table', 'field', 'user', 'role',
  'workspace', 'blueprint', 'team', 'subscription', 'instruction',
]);
export type ResourceType = z.infer<typeof ResourceType>;

// Agent Kit format
export const AgentKitFormat = z.enum([
  'claude-desktop', 'claude-code', 'cursor', 'chatgpt', 'raw',
]);
export type AgentKitFormat = z.infer<typeof AgentKitFormat>;

// Agent Kit component
export const AgentKitComponent = z.enum([
  'system_instructions', 'behavioral_rules', 'skills', 'connection_config',
]);
export type AgentKitComponent = z.infer<typeof AgentKitComponent>;

// Instruction scope
export const InstructionScope = z.enum(['team', 'workspace', 'table', 'role']);
export type InstructionScope = z.infer<typeof InstructionScope>;

// Instruction type
export const InstructionType = z.enum(['context', 'rules', 'guidance', 'guardrail']);
export type InstructionType = z.infer<typeof InstructionType>;

// Sort direction
export const SortDirection = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof SortDirection>;
