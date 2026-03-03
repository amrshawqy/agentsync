# Technical Architecture

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Clients                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Claude   │  │ ChatGPT  │  │ Gemini   │  │ Custom   │                 │
│  │ Agent    │  │ Agent    │  │ Agent    │  │ Agent    │                 │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│       └─────────────┴─────────────┴─────────────┘                       │
│                    MCP Protocol + REST API                              │
│                  (Streamable HTTP + OAuth 2.1)                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                          API Gateway                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ OAuth 2.1  │  │ Rate       │  │ Request    │  │ Logging &  │         │
│  │ Validation │  │ Limiting   │  │ Routing    │  │ Metrics    │         │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                      Application Layer                                  │
│                                                                         │
│  ┌──────────────────────────┐  ┌──────────────────────────┐             │
│  │      MCP Server          │  │      REST API Server     │             │
│  │  (Streamable HTTP)       │  │  (Same handlers, HTTP)   │             │
│  │  + Resources (context)   │  │                          │             │
│  │  + Prompts (workflows)   │  │                          │             │
│  └────────────┬─────────────┘  └────────────┬─────────────┘             │
│               └──────────────┬──────────────┘                           │
│                              │                                          │
│  ┌───────────────────────────▼──────────────────────────────────────┐   │
│  │                    Tool Router                                   │   │
│  │  Resolves team/member context, enforces permissions,             │   │
│  │  resolves schema layers, dispatches to service layer             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌─────────────┐        │
│  │ Schema      │  │ Data        │  │ Auth &   │  │ Event       │        │
│  │ Service     │  │ Service     │  │ Perm.    │  │ Service.    │        │
│  │             │  │             │  │ Service  │  │             │        │
│  │- Blueprint  │  │- CRUD       │  │- RBAC    │  │- Subscribe  │        │
│  │  mgmt       │  │- Query      │  │- Record  │  │- Dispatch   │        │
│  │             │  │             │  │  filter  │  │             │        │
│  │- Layer      │  │- Traverse   │  │- User    │  │- Pattern    │        │
│  │  resolve    │  │- Provenance │  │  mgmt    │  │  matching   │        │
│  │- Constraint │  │  track      │  │- Audit   │  │             │        │
│  │  check.     │  │- Verify     │  │  log     │  │             │        │
│  └────┬────────┘  └────┬────────┘  └────┬─────┘  └────┬────────┘        │
│       │                │                │             │                 │
│  ┌────┴────────────────┴────────────────┴─────────────┴──────┐          │
│  │              Instruction Engine                           │          │
│  │  Assembles contextual instructions per request:           │          │
│  │  team context + schema (with agent_hints)                 │          │
│  │  + business rules + role guidance + constraints           │          │
│  └───────────────┬───────────────────────────────────────────┘          │
│                  │                                                      │
│  ┌───────────────▼──────────────────────────────────────┐               │
│  │              Agent Kit Generator                     │               │
│  │  Generates downloadable client-side packages:        │               │
│  │  Template Engine + Format Adapter + Packager         │               │
│  │  Outputs: CLAUDE.md, .mcp.json, .cursorrules, etc.   │               │
│  └──────────────────────┬───────────────────────────────┘               │
└─────────────────────────┼───────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────────┐
│                        Data Layer                                       │
│                                                                         │
│  ┌───────────────────────────┐  ┌───────────────────────┐               │
│  │   PostgreSQL              │  │   Redis               │               │
│  │                           │  │                       │               │
│  │   System tables:          │  │   - Session cache     │               │
│  │   - teams                 │  │   - Schema cache      │               │
│  │   - users / roles         │  │   - Permission cache  │               │
│  │   - schema_registry       │  │   - Rate limit state  │               │
│  │   - blueprints            │  │   - Event dispatch    │               │
│  │   - field_suggestions     │  │     (Redis Streams)   │               │
│  │   - instructions          │  │   - Resource cache    │               │
│  │   - agent_kit_templates   │  │                       │               │
│  │   - agent_kit_generations │  │                       │               │
│  │   - audit_log             │  │                       │               │
│  │                           │  └───────────────────────┘               │
│  │   Team data:              │                                          │
│  │   - records (JSONB        │  ┌────────────────────────┐              │
│  │     + provenance)         │  │   Object Storage       │              │
│  │   - record_indexes        │  │   (S3 / R2)            │              │
│  │   - record_relations      │  │                        │              │
│  │                           │  │   - File attachments   │              │
│  │   Full-text search:       │  │   - Exports            │              │
│  │   - pg_trgm + GIN         │  │   - Backups            │              │
│  │   - ts_vector indexes     │  │   - Blueprint packages │              │
│  └───────────────────────────┘  └────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Design

### Approach: JSONB Hybrid with Provenance

We use a hybrid approach that combines the flexibility of JSONB with typed indexes and field-level provenance:

1. **System tables** -- Fixed schema, traditional relational design
2. **Team data** -- JSONB-based with metadata registry, dynamic indexes, and provenance tracking
3. **No runtime DDL** for data operations -- schema changes are metadata operations + index management

### System Tables

```sql
-- Multi-team foundation
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role_id UUID REFERENCES roles(id),
    agent_id VARCHAR(255),  -- external agent identifier
    status VARCHAR(20) DEFAULT 'invited',  -- invited, active, suspended
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, email)
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    name VARCHAR(100) NOT NULL,
    is_system BOOLEAN DEFAULT false,  -- true for admin, member, viewer
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, name)
);

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    blueprint_id UUID REFERENCES blueprints(id),  -- which blueprint was deployed
    blueprint_version INT,                         -- which version is active
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, slug)
);
```

### Blueprint Registry

```sql
-- Blueprint definitions (the installable modules)
CREATE TABLE blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL,           -- 'crm', 'pm', 'hr', 'restaurant-mgmt'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),                -- 'sales', 'operations', 'hr', 'custom'
    version INT NOT NULL DEFAULT 1,
    is_builtin BOOLEAN DEFAULT false,     -- true for platform-provided blueprints
    created_by_team UUID REFERENCES teams(id),  -- null for builtin
    schema_definition JSONB NOT NULL,     -- full table/field/constraint/hint definitions
    seed_data JSONB,                      -- optional sample records per table for onboarding
    instructions JSONB,                   -- domain-specific business rules and agent guidance
    -- Marketplace fields
    is_published BOOLEAN DEFAULT false,
    marketplace_tags TEXT[],              -- ['food-service', 'operations', 'multi-location']
    install_count INT DEFAULT 0,
    avg_rating NUMERIC(2,1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(slug, version)
);
```

### Schema Registry (Three-Layer Resolution)

```sql
-- Layer 2: Blueprint-defined tables and fields
CREATE TABLE schema_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    agent_hint TEXT,                        -- how agents should think about this table
    source_layer VARCHAR(20) NOT NULL,     -- 'core', 'blueprint', 'workspace'
    blueprint_id UUID REFERENCES blueprints(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, workspace_id, slug)
);

-- Field definitions with agent hints and constraints
CREATE TABLE schema_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    table_id UUID NOT NULL REFERENCES schema_tables(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,       -- text, number, date, select, relation, formula, etc.
    is_required BOOLEAN DEFAULT false,
    is_indexed BOOLEAN DEFAULT false,
    default_value JSONB,
    validation JSONB,                      -- { min, max, pattern, unique, ... }
    options JSONB,                         -- for select: [{ value, label, order, terminal? }]
    constraints JSONB,                     -- for state machines: { transitions: { state: [valid_next] } }
                                           -- for cardinality: { cardinality: "single" | "multiple" }
    relation_config JSONB,                 -- { target_table_id, display_field, reverse_name }
    agent_hint TEXT,                       -- natural language: what this field means, when/how to use it
    source_layer VARCHAR(20) NOT NULL,     -- 'core', 'blueprint', 'workspace'
    field_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(table_id, slug)
);
```

### Team Data Storage with Provenance

```sql
-- Universal record table with field-level provenance
CREATE TABLE records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL,
    table_id UUID NOT NULL REFERENCES schema_tables(id),
    data JSONB NOT NULL DEFAULT '{}',           -- field values: { "field_slug": value, ... }
    provenance JSONB NOT NULL DEFAULT '{}',     -- per-field: { "field_slug": { agent, at, confidence, verification? } }
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                      -- soft delete
);

-- Indexes for performance
CREATE INDEX idx_records_org_table ON records(team_id, table_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_records_data ON records USING GIN(data);
CREATE INDEX idx_records_provenance ON records USING GIN(provenance);  -- query by confidence, agent
CREATE INDEX idx_records_created ON records(team_id, table_id, created_at DESC);

-- Typed index table for filterable/sortable fields
CREATE TABLE record_indexes (
    record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    team_id UUID NOT NULL,
    table_id UUID NOT NULL,
    field_id UUID NOT NULL REFERENCES schema_fields(id),
    text_value TEXT,
    number_value NUMERIC,
    date_value TIMESTAMPTZ,
    bool_value BOOLEAN,
    PRIMARY KEY (record_id, field_id)
);

CREATE INDEX idx_ri_text ON record_indexes(team_id, table_id, field_id, text_value)
    WHERE text_value IS NOT NULL;
CREATE INDEX idx_ri_number ON record_indexes(team_id, table_id, field_id, number_value)
    WHERE number_value IS NOT NULL;
CREATE INDEX idx_ri_date ON record_indexes(team_id, table_id, field_id, date_value)
    WHERE date_value IS NOT NULL;

-- Relations between records (first-class, with provenance)
CREATE TABLE record_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL,
    source_record_id UUID NOT NULL REFERENCES records(id),
    target_record_id UUID NOT NULL REFERENCES records(id),
    relation_type VARCHAR(100) NOT NULL,         -- 'works_at', 'belongs_to', 'assigned_to', or field slug
    field_id UUID REFERENCES schema_fields(id),  -- the relation field that defines this
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_record_id, target_record_id, relation_type)
);

CREATE INDEX idx_rr_source ON record_relations(source_record_id);
CREATE INDEX idx_rr_target ON record_relations(target_record_id);
CREATE INDEX idx_rr_type ON record_relations(team_id, relation_type);
```

### Row-Level Security

```sql
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_indexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON records
    USING (team_id = current_setting('app.current_team_id')::UUID);

CREATE POLICY org_isolation ON record_indexes
    USING (team_id = current_setting('app.current_team_id')::UUID);

CREATE POLICY org_isolation ON record_relations
    USING (team_id = current_setting('app.current_team_id')::UUID);
```

### Event Subscriptions

```sql
CREATE TABLE event_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    user_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL,       -- 'record.created', 'field.changed', etc.
    workspace_id UUID REFERENCES workspaces(id),
    table_id UUID REFERENCES schema_tables(id),
    field_slug VARCHAR(100),               -- for field.changed events
    condition JSONB,                       -- optional filter condition
    callback_type VARCHAR(20) NOT NULL,    -- 'sse', 'webhook'
    callback_url TEXT,                     -- for webhook type
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_es_lookup ON event_subscriptions(team_id, event_type, is_active)
    WHERE is_active = true;
```

### Field Suggestions (Governed Organic Growth)

```sql
-- Agents propose new fields; admins approve/reject
CREATE TABLE field_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    table_id UUID NOT NULL REFERENCES schema_tables(id),
    suggested_by UUID NOT NULL REFERENCES users(id),  -- the agent/member who proposed it
    field_name VARCHAR(255) NOT NULL,
    field_slug VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    agent_hint TEXT,                       -- proposed hint for the field
    rationale TEXT NOT NULL,               -- why the agent thinks this field is needed
    example_value JSONB,                   -- sample value demonstrating usage
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
    reviewed_by UUID REFERENCES users(id), -- admin who approved/rejected
    review_note TEXT,                       -- admin's reason for approval/rejection
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_fs_pending ON field_suggestions(team_id, status)
    WHERE status = 'pending';
```

### Audit Log

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    agent_id VARCHAR(255),
    action VARCHAR(50) NOT NULL,           -- create, update, delete, query, schema_change, etc.
    resource_type VARCHAR(50),             -- record, table, field, user, role, workspace, blueprint
    resource_id UUID,
    table_id UUID,
    reason TEXT,                           -- agent's explanation of WHY it took this action
    changes JSONB,                         -- { field: { old: x, new: y } }
    provenance JSONB,                      -- confidence, verification data for this action
    metadata JSONB,                        -- request context, MCP session info
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);         -- time-partitioned for efficient retention

CREATE INDEX idx_audit_org_time ON audit_log(team_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_log(team_id, user_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_log(team_id, resource_type, resource_id);
```

### Instruction Storage

```sql
CREATE TABLE instructions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    scope VARCHAR(50) NOT NULL,            -- 'team', 'workspace', 'table', 'role'
    scope_id UUID,                         -- workspace_id, table_id, or role_id
    instruction_type VARCHAR(50),          -- 'context', 'rules', 'guidance', 'guardrail'
    content TEXT NOT NULL,
    priority INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Agent Kit Storage

```sql
-- Templates for Agent Kit generation (platform-level defaults + team overrides)
CREATE TABLE agent_kit_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id),       -- NULL = platform-level default
    format VARCHAR(50) NOT NULL,             -- 'claude-desktop', 'claude-code', 'cursor', 'chatgpt', 'raw'
    component VARCHAR(50) NOT NULL,          -- 'system_instructions', 'behavioral_rules', 'skills', 'connection_config'
    template TEXT NOT NULL,                  -- Mustache/Handlebars template with placeholders
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, format, component)
);

-- Tracks when Agent Kits were last generated per member (staleness detection)
CREATE TABLE agent_kit_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    user_id UUID NOT NULL REFERENCES users(id),
    format VARCHAR(50) NOT NULL,
    schema_version_hash VARCHAR(64) NOT NULL,  -- SHA-256 of schema state at generation time
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id, format)
);

CREATE INDEX idx_akg_staleness ON agent_kit_generations(team_id, schema_version_hash);
```

### Marketplace Reviews

```sql
CREATE TABLE blueprint_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES blueprints(id),
    team_id UUID NOT NULL REFERENCES teams(id),
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blueprint_id, team_id)         -- one review per team per blueprint
);
```

---

## MCP Resources & Prompts

### Resources (Passive Context)

The MCP server exposes read-only resources that agents load on connection:

```typescript
// Resource registration in MCP server
server.resource("agentsync://schema/overview", async (uri, { teamId, userId }) => {
  // Resolve all accessible workspaces, tables, fields, hints, constraints
  const schema = await schemaService.getFullSchemaForUser(teamId, userId);
  return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(schema) }] };
});

server.resource("agentsync://workspace/{slug}/stats", async (uri, { teamId }) => {
  const stats = await dataService.getWorkspaceStats(teamId, uri.params.slug);
  return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(stats) }] };
});

server.resource("agentsync://instructions", async (uri, { teamId, userId, roleId }) => {
  const instructions = await instructionEngine.assemble(teamId, userId, roleId);
  return { contents: [{ uri, mimeType: "text/plain", text: instructions }] };
});
```

Resources are cached in Redis with invalidation on schema/permission changes. Agent MCP clients that support resource subscriptions will receive updates automatically.

### Prompts (Guided Workflows)

Prompts are registered as MCP prompt templates:

```typescript
server.prompt("build_blueprint", {
  description: "Step-by-step guide to design and deploy a new Blueprint",
  arguments: [
    { name: "domain", description: "The business domain (e.g., 'restaurant management')", required: true }
  ]
}, async ({ domain }) => {
  return {
    messages: [
      { role: "user", content: `Guide me through building a Blueprint for: ${domain}\n\n` +
        `Step 1: Describe the key entity types (tables) needed.\n` +
        `Step 2: Define fields, types, and constraints for each.\n` +
        `Step 3: Define relationships between tables.\n` +
        `Step 4: Add agent_hints for each field.\n` +
        `Step 5: Define state machine transitions for status fields.\n` +
        `Step 6: Validate and deploy.\n` +
        `Step 7: Optionally generate seed data.` }
    ]
  };
});

server.prompt("data_quality_check", {
  description: "Scan a workspace for data quality issues",
  arguments: [
    { name: "workspace", description: "Workspace slug to scan", required: true }
  ]
}, async ({ workspace }) => {
  const stats = await dataService.getWorkspaceStats(teamId, workspace);
  return {
    messages: [
      { role: "user", content: `Run a data quality check on workspace "${workspace}".\n\n` +
        `Current stats: ${JSON.stringify(stats)}\n\n` +
        `Check for:\n` +
        `1. Fields with avg confidence < 0.7\n` +
        `2. Records missing required fields\n` +
        `3. Records with no activity in 30+ days\n` +
        `4. Unverified fields that should be verified\n` +
        `5. Inconsistencies across related records` }
    ]
  };
});
```

---

## Agent Kit Generator

The Agent Kit Generator is a service that assembles downloadable client-side packages for AI agents. It combines member context, schema, permissions, and behavioral rules into platform-specific output formats.

### Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                     Agent Kit Generator                           │
│                                                                   │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐            │
│  │  Template    │  │  Instruction  │  │  Schema      │            │
│  │  Engine      │  │  Engine       │  │  Service     │            │
│  │              │  │               │  │              │            │
│  │  Loads base  │  │  Assembles    │  │  Resolves    │            │
│  │  templates + │  │  role-based   │  │  full schema │            │
│  │  team        │  │  instructions │  │  for member  │            │
│  │  overrides   │  │               │  │              │            │
│  └──────┬───────┘  └──────┬────────┘  └──────┬───────┘            │
│         └─────────────────┼──────────────────┘                    │
│                           │                                       │
│                  ┌────────▼────────┐                              │
│                  │  Merge & Render │                              │
│                  │  (template +    │                              │
│                  │   live context) │                              │
│                  └────────┬────────┘                              │
│                           │                                       │
│                  ┌────────▼────────┐                              │
│                  │ Format Adapter  │                              │
│                  │ claude-desktop  │                              │
│                  │ claude-code     │                              │
│                  │ cursor          │                              │
│                  │ chatgpt         │                              │
│                  │ raw             │                              │
│                  └────────┬────────┘                              │
│                           │                                       │
│                  ┌────────▼────────┐                              │
│                  │   Packager      │                              │
│                  │   (zip / JSON)  │                              │
│                  └────────┬────────┘                              │
│                           │                                       │
└───────────────────────────┼───────────────────────────────────────┘
                            ▼
                     Agent Kit payload
```

### Generation Flow

```typescript
async function generateAgentKit(
  teamId: string,
  userId: string,
  format: AgentKitFormat
): Promise<AgentKitPayload> {
  // 1. Gather inputs
  const member = await userService.getUser(teamId, userId);
  const role = await authService.getRole(member.role_id);
  const schema = await schemaService.getFullSchemaForUser(teamId, userId);
  const team = await teamService.getTeam(teamId);
  const instructions = await instructionEngine.assemble(teamId, userId, role.id);

  // 2. Load templates (team overrides → platform defaults)
  const templates = await templateService.getTemplates(teamId, format);

  // 3. Generate skills from schema
  const skills = generateSkills(schema, role);

  // 4. Render templates with context
  const rendered = renderTemplates(templates, {
    member, role, team, schema, instructions, skills
  });

  // 5. Compute schema version hash for staleness tracking
  const schemaHash = computeSchemaHash(schema, role.permissions);

  // 6. Record generation
  await db.query(`
    INSERT INTO agent_kit_generations (team_id, user_id, format, schema_version_hash)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (team_id, user_id, format)
    DO UPDATE SET schema_version_hash = $4, generated_at = NOW()
  `, [teamId, userId, format, schemaHash]);

  // 7. Format for target platform
  return formatAdapter.package(format, rendered);
}
```

### Skill Generation

Skills are client-side shortcuts generated from the schema. The generator identifies common operation patterns and maps them to MCP tool sequences:

```typescript
function generateSkills(schema: ResolvedSchema, role: Role): Skill[] {
  const skills: Skill[] = [];

  for (const table of schema.tables) {
    // "Create" skill for each writable table
    if (role.canCreate(table)) {
      skills.push({
        command: `/new-${singularize(table.slug)}`,
        description: `Create a new ${table.name} record`,
        steps: [
          { tool: 'create_record', params: { table: table.slug } },
          // Auto-link if table has a single required relation
          ...table.requiredRelations.map(rel => ({
            tool: 'link_records', params: { relation: rel.slug }
          }))
        ]
      });
    }

    // "List by status" skill for tables with state machine fields
    const statusField = table.fields.find(f => f.constraints?.transitions);
    if (statusField && role.canRead(table)) {
      skills.push({
        command: `/${table.slug}-by-stage`,
        description: `Show ${table.name} grouped by ${statusField.name}`,
        steps: [
          { tool: 'query_records', params: { table: table.slug, group_by: statusField.slug } }
        ]
      });
    }
  }

  return skills;
}
```

### Staleness Detection

Agent Kits are generated on demand and may become stale when the schema, permissions, or business rules change. Staleness is detected via hash comparison:

```typescript
async function isAgentKitStale(
  teamId: string, userId: string, format: string
): Promise<boolean> {
  const lastGen = await db.query(`
    SELECT schema_version_hash FROM agent_kit_generations
    WHERE team_id = $1 AND user_id = $2 AND format = $3
  `, [teamId, userId, format]);

  if (!lastGen) return true;  // never generated

  const currentHash = await computeCurrentSchemaHash(teamId, userId);
  return lastGen.schema_version_hash !== currentHash;  // O(1) comparison
}
```

The schema version hash includes: schema field definitions, role permissions, team-level behavioral rule overrides, and instruction content hashes. Any change to these inputs produces a different hash, marking the kit as stale.

### MCP Tool Registration

```typescript
server.tool("get_agent_kit", {
  description: "Generate an Agent Kit for a member",
  inputSchema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["claude-desktop", "claude-code", "cursor", "chatgpt", "raw"],
        description: "Target platform format"
      },
      member_id: {
        type: "string",
        description: "Member ID (defaults to calling agent's member; admins can specify any member)"
      }
    },
    required: ["format"]
  }
}, async ({ format, member_id }, { teamId, userId, role }) => {
  const targetUserId = member_id ?? userId;

  // Permission check: only admins can generate kits for other members
  if (targetUserId !== userId && !role.isAdmin) {
    throw new McpError("FORBIDDEN", "Only admins can generate Agent Kits for other members");
  }

  const kit = await generateAgentKit(teamId, targetUserId, format);
  return { content: [{ type: "text", text: JSON.stringify(kit) }] };
});
```

---

## Authentication & Authorization

### Auth Flow (MCP + OAuth 2.1)

```
Agent                    Gateway              Auth Service         App Server
  │                        │                       │                    │
  │  MCP connect request   │                       │                    │
  ├───────────────────────►│                       │                    │
  │                        │                       │                    │
  │  401 + OAuth metadata  │                       │                    │
  │◄───────────────────────┤                       │                    │
  │                        │                       │                    │
  │  OAuth authorize (PKCE)│                       │                    │
  ├────────────────────────┼──────────────────────►│                    │
  │                        │                       │                    │
  │  Auth code             │                       │                    │
  │◄───────────────────────┼───────────────────────┤                    │
  │                        │                       │                    │
  │  Token exchange        │                       │                    │
  ├────────────────────────┼──────────────────────►│                    │
  │                        │                       │                    │
  │  Access token (JWT)    │  Claims:              │                    │
  │  + Refresh token       │  sub: user_id         │                    │
  │◄───────────────────────┼──  team: team_id      │                    │
  │                        │    role: role_id      │                    │
  │                        │    scopes: [...]      │                    │
  │  MCP/REST + Bearer     │                       │                    │
  ├───────────────────────►│                       │                    │
  │                        │  Validate JWT         │                    │
  │                        ├──────────────────────►│                    │
  │                        │  Valid + claims       │                    │
  │                        │◄──────────────────────┤                    │
  │                        │                       │                    │
  │                        │ Forward + user context│                    │
  │                        ├───────────────────────┼───────────────────►│
  │                        │                       │                    │
  │  Response              │                       │                    │
  │◄───────────────────────┼───────────────────────┼────────────────────┤
```

### Permission Evaluation

Six-layer permission check on every request:

```
Layer 1: Team Access       → Is the member active in this team?
Layer 2: Workspace Access  → Can this role access this workspace?
Layer 3: Table Access      → Can this role perform this action on this table?
Layer 4: Field Access      → Which fields should be included/excluded?
Layer 5: Record Filters    → Row-level security (e.g., "own records only")
Layer 6: Constraint Check  → State machine transitions, required fields, validation
```

Permissions stored as JSONB on the role:

```json
{
  "workspaces": {
    "crm": {
      "tables": {
        "contacts": {
          "actions": ["create", "read", "update"],
          "field_access": {
            "hidden": [],
            "read_only": ["created_by", "created_at"]
          },
          "record_filters": {
            "read": {},
            "write": { "created_by": "$current_user" }
          }
        },
        "deals": {
          "actions": ["read"],
          "field_access": {
            "hidden": ["revenue", "margin"]
          }
        }
      }
    }
  }
}
```

### Implementation Note: Custom PermissionService

We evaluated Cerbos (open-source ABAC engine) but chose to keep a custom `PermissionService` for the following reasons:

1. **Tight integration** — Permission evaluation is tightly coupled with our 6-layer hierarchy (team → workspace → table → field → record filter → constraint). An external engine adds latency and complexity for marginal benefit.
2. **JSONB policies on roles** — Permissions are stored as JSONB directly on the `roles` table, making them queryable and version-controlled alongside the data model.
3. **Redis caching** — Permission results are cached with 300s TTL, providing sub-millisecond repeated evaluations.
4. **Record filters** — Support for `$current_user`, `$current_team`, and `$current_role` variables in record-level write filters, enabling row-level ownership without external policy files.

### Schema Constraint Enforcement

Runs AFTER permission checks, BEFORE data write:

```
1. Validate field types    → "revenue" must be numeric
2. Validate required       → "priority" is required on tickets
3. Validate patterns       → "email" must match email format
4. Check state transitions → deal.stage "prospecting" → "won" is REJECTED
5. Check cardinality       → deal.stage can only have one value
6. Check custom rules      → deals > $100k need manager flag
```

If any constraint fails, the operation is rejected with a clear error message that the agent can understand and act on.

---

## Event System Architecture

### How It Works

```
Agent writes data ──► Data Service ──► PostgreSQL
                                          │
                                    NOTIFY trigger
                                          │
                                          ▼
                                    Event Dispatcher
                                    (Redis Streams)
                                          │
                              ┌───────────┼───────────┐
                              │           │           │
                              ▼           ▼           ▼
                         Subscription  Subscription  Subscription
                         Match Engine  Match Engine  Match Engine
                              │           │           │
                              ▼           ▼           ▼
                         SSE to Agent  SSE to Agent  Webhook
```

### Event Payload

```json
{
  "event_id": "evt-abc-123",
  "event_type": "field.changed",
  "timestamp": "2026-02-24T10:05:00Z",
  "team_id": "team-xyz",
  "workspace": "crm",
  "table": "contacts",
  "record_id": "rec-456",
  "field": "phone",
  "data": {
    "old_value": null,
    "new_value": "+20-100-555-1234",
    "agent": "enrichment-agent",
    "confidence": 0.85
  }
}
```

### Delivery Guarantees

- Events delivered via **Server-Sent Events (SSE)** for connected agents
- Missed events (agent disconnected) are stored in Redis Streams with configurable retention
- On reconnect, agent receives missed events from their last acknowledged position
- Webhook delivery with retry (3 attempts, exponential backoff)

---

## Schema Layer Resolution

When a query or operation references a table/field, the system resolves through three layers:

```
Request: query_records(workspace: "crm", table: "contacts", field: "ndaStatus")

Resolution:
  1. Check Layer 3 (Workspace): Does "contacts" have custom field "ndaStatus"? → YES
     Use workspace definition.

  2. Check Layer 2 (Blueprint): Does CRM Blueprint define "contacts.email"? → YES
     Use blueprint definition (unless overridden by Layer 3).

  3. Check Layer 1 (Core): Does core define "id", "created_at"? → YES
     Always present, never overridden.

Assembled schema = Core fields + Blueprint fields + Workspace custom fields
                    (Layer 3 overrides Layer 2 overrides Layer 1)
```

Implementation: Schema resolution is cached in Redis per (team_id, workspace_id). Cache is invalidated when schema changes occur (alter_table, evolve_blueprint).

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **MCP Server** | TypeScript + `@modelcontextprotocol/sdk` | Official SDK, best MCP support |
| **REST API** | Hono (same process as MCP) | Lightweight, edge-ready, shares handlers with MCP |
| **Database** | PostgreSQL 16+ | JSONB, RLS, GIN indexes, partitioning, LISTEN/NOTIFY |
| **Cache + Events** | Redis (Upstash or managed) | Schema/permission cache, event dispatch (Streams), rate limiting |
| **Auth** | Custom OAuth 2.1 server (or Auth0/WorkOS) | MCP spec requires OAuth 2.1 |
| **Object Storage** | S3 / Cloudflare R2 | File attachments (Phase 2), blueprint packages |
| **Hosting** | Fly.io or Railway (early) → AWS/GCP (scale) | Start simple, scale when needed |
| **CI/CD** | GitHub Actions | Standard |
| **Observability** | OpenTelemetry + Grafana | Distributed tracing, metrics, audit dashboards |
| **Policy Engine** | Custom PermissionService | 6-layer RBAC, JSONB policy on roles, cached in Redis |

---

## Scaling Strategy

### Phase 1: Single-Region, Shared Database
- One PostgreSQL instance, all orgs share tables
- Row-level security isolates teams
- Redis for caching + event dispatch
- Handles 100s of orgs, 1000s of agents

### Phase 2: Read Replicas + Connection Pooling
- PgBouncer for connection management
- Read replicas for query-heavy workloads
- Redis cluster for distributed caching and event fanout
- Handles 1000s of orgs, 10,000s of agents

### Phase 3: Partitioning + Multi-Region
- Table partitioning by team_id on records table
- Multi-region deployment (EU, US, APAC) for data residency
- Large teams get dedicated database instances
- Handles 10,000s+ of orgs

---

## Security Considerations

- **Encryption at rest**: PostgreSQL TDE + S3 encryption
- **Encryption in transit**: TLS 1.3 everywhere
- **Secrets**: HashiCorp Vault or cloud KMS (never in env vars)
- **JWT tokens**: Short-lived (15 min), refresh rotation
- **Audit everything**: Every MCP/REST call logged with member, team, action, resource, timestamp, provenance, and the agent's stated reason
- **Rate limiting**: Per-member, per-team, and global tiers
- **Input validation**: All JSONB data validated against schema_fields definitions + constraints
- **Constraint enforcement**: State machines, required fields, validation patterns enforced at platform level
- **SQL injection prevention**: Parameterized queries only (JSONB operators, not string interpolation)
- **SSRF protection**: Webhook and automation URLs validated against private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1, fc00::/7) and metadata endpoints. HTTPS enforced in production. Configurable blocklist via environment variables.
- **Event security**: Events only delivered to agents with read access to the affected data
