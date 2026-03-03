# Product Specification

---

## Core Concepts

### 1. Team
The top-level container. Created when an admin registers. Contains all data, members, permissions, schemas, and instructions. Could be a company, a department, a project group, a community, or a solo operator.

### 2. Workspace
A logical grouping of related data within a team. Examples: "Sales CRM", "Engineering PM", "HR", "Fleet Management". A team can have multiple workspaces. Each workspace can be created from a Blueprint or from scratch.

### 3. Table
A data structure within a workspace. Like a database table but with a flexible, user-defined schema. Examples: Contacts, Deals, Tasks, Employees, Vehicles -- anything the admin defines.

### 4. Record
A single row in a table. A contact, a deal, a task. Every record carries field-level provenance -- which agent wrote each field, when, and with what confidence.

### 5. Field
A column definition on a table. Has:
- **Type** -- text, number, date, select, multi-select, relation, formula, boolean, email, url, phone, currency, etc.
- **Validation rules** -- min/max, pattern, required, unique
- **Constraints** -- for select/status fields: valid state transitions (state machine)
- **Agent hint** -- natural language guidance for agents explaining what the field means and how to use it
- **Display configuration** -- order, visibility defaults

### 6. Agent Identity
A registered AI agent tied to a specific member. Has a role, permissions, and an audit trail. The agent inherits its human's access level.

### 7. Instruction Set
Contextual prompts and rules served to agents based on their role, the workspace they're accessing, and the team's configuration. Tells the agent what exists, what it can do, and how the business works. Works at a higher level than individual field hints -- covers business rules, role behavior, and team policies.

### 8. Blueprint
A pre-built, versioned module that defines a complete business system: tables, fields, relationships, constraints, agent hints, and seed instructions. AgentSync ships Blueprints for common domains (CRM, PM, HR, ERP, Support, Inventory) but the real power is that **any agent can design a custom Blueprint** for any domain -- restaurant management, fleet tracking, real estate, healthcare, or anything else.

### 9. Provenance
Every field value on every record carries metadata: which agent wrote it, when, and with what confidence (0.0-1.0). Optionally, field values can be verified by other agents, creating a trust chain. This is the foundation of multi-agent data quality.

### 10. Event
A notification fired when data changes. Agents subscribe to event patterns ("notify me when a Ticket is created", "notify me when deal stage changes") and react autonomously. The event system is how agents coordinate without messaging each other.

### 11. Agent Kit
A downloadable, auto-generated client-side package that pre-configures an AI agent to work with AgentSync. Generated on demand per member and role, in platform-specific formats (Claude Desktop, Claude Code, Cursor, ChatGPT, Raw/Custom). Contains system instructions, MCP connection config, behavioral rules, skills/shortcuts, and role-specific context. The Agent Kit is the bootstrapping layer -- it tells an agent how to connect, how to think about data, and what shortcuts are available, before the agent ever touches the MCP server.

---

## Three-Layer Schema

Schemas resolve through three layers, top-down:

```
┌─────────────────────────────────────────────────┐
│  Layer 3: Workspace Customizations              │
│  Custom fields, overrides, team-specific rules. │
│  Example: "acme:ndaStatus" on Contacts          │
│  Overrides layers below.                        │
├─────────────────────────────────────────────────┤
│  Layer 2: Blueprints                            │
│  Versioned domain modules.                      │
│  CRM, HR, PM, Inventory, or custom.             │
│  Example: "crm:dealStage" on Deals              │
│  Installed per workspace.                       │
├─────────────────────────────────────────────────┤
│  Layer 1: Core Schema                           │
│  Universal fields present on every record.      │
│  id, created_at, updated_at, created_by,        │
│  updated_by. Never modified.                    │
└─────────────────────────────────────────────────┘
```

**Why this matters:** When a Blueprint is updated (e.g., CRM v2 adds a "lead_score" field), workspaces using that Blueprint can receive the update without losing their customizations. Layer 3 overrides always win.

---

## User Journeys

### Journey 1: Admin Onboarding (Known Domain)

```
Admin's Agent                         AgentSync MCP
     │                                      │
     │  "Register my team on AgentSync"     │
     ├─────────────────────────────────────►│
     │                                      │
     │  Team created, admin credentials     │
     │◄─────────────────────────────────────┤
     │                                      │
     │  "Set up a CRM for our sales team"   │
     ├─────────────────────────────────────►│
     │                                      │
     │  Deploy CRM Blueprint:               │
     │  - Contacts (25 fields + hints)      │
     │  - Companies (20 fields + hints)     │
     │  - Deals (18 fields + state machine) │
     │  - Activities (12 fields + hints)    │
     │  - Pipeline constraints enforced     │
     │  - Agent instructions generated      │
     │◄─────────────────────────────────────┤
     │                                      │
     │  "Add these members:                 │
     │   sarah@co.com (Sales)               │
     │   tom@co.com (Engineering)           │
     │   lisa@co.com (HR)"                  │
     ├─────────────────────────────────────►│
     │                                      │
     │  Members created with role-based     │
     │  permissions. Invite emails sent.    │
     │◄─────────────────────────────────────┤
```

### Journey 2: Admin Onboarding (Custom Domain)

```
Admin's Agent                         AgentSync MCP
     │                                       │
     │  "I need a system to manage our       │
     │   restaurant chain. Track locations,  │
     │   menus, staff, inventory, suppliers" │
     ├──────────────────────────────────────►│
     │                                       │
     │  Agent designs a custom Blueprint:    │
     │  create_blueprint("restaurant-mgmt",  │
     │    tables: [                          │
     │     Locations (name, address, type,   │
     │       capacity, status...),           │
     │     MenuItems (name, category,        │
     │       price, cost, dietary_tags...),  │
     │     Staff (name, role, location,      │
     │       schedule, certifications...),   │
     │     Inventory (item, location, qty,   │
     │       reorder_point, supplier...),    │
     │     Suppliers (name, contact,         │
     │       items_supplied, lead_time...)   │
     │    ],                                 │
     │    constraints: [                     │
     │     Staff.status transitions,         │
     │     Inventory auto-flag at reorder    │
     │    ],                                 │
     │    agent_hints: [per-field guidance]  │
     │  )                                    │
     │                                       │
     │  Custom Blueprint validated &         │
     │  deployed. Ready for use.             │
     │◄──────────────────────────────────────┤
```

### Journey 3: Member Agent Connection

```
Sarah's Agent                         AgentSync MCP / Dashboard
     │                                      │
     │  Prerequisite: Download Agent Kit    │
     │  (from dashboard or MCP tool)        │
     │  → Receives: CLAUDE.md + .mcp.json   │
     │    with identity, behavioral rules,  │
     │    connection config, and skills     │
     │◄─────────────────────────────────────┤
     │                                      │
     │  Agent Kit installed locally.        │
     │  Agent now knows: who it is, how     │
     │  to connect, how to think about      │
     │  data, and what shortcuts exist.     │
     │                                      │
     │  Connect via MCP (OAuth 2.1 flow)    │
     ├─────────────────────────────────────►│
     │                                      │
     │  Auth success. Agent receives:       │
     │  - Team context (team name, etc.)    │
     │  - Available workspaces: [CRM]       │
     │  - Tables with field definitions     │
     │    and agent_hints for each field    │
     │  - Available tools (permission-gated)│
     │  - Constraints (valid transitions)   │
     │  - Instructions: "You are a sales    │
     │    agent at [Team]. Here's how       │
     │    the CRM is structured..."         │
     │◄─────────────────────────────────────┤
     │                                      │
     │  "Log a new deal with Acme Corp,     │
     │   $50k, closing next month"          │
     ├─────────────────────────────────────►│
     │                                      │
     │  Record created in Deals table.      │
     │  Linked to Acme Corp in Companies.   │
     │  Provenance recorded: Sarah's agent, │
     │  timestamp, confidence: 1.0          │
     │  Activity logged.                    │
     │◄─────────────────────────────────────┤
```

### Journey 4: Multi-Agent Collaboration Through Data

```
Enrichment Agent                      AgentSync MCP
     │                                      │
     │  subscribe_events(                   │
     │    event: "record.created",          │
     │    table: "contacts"                 │
     │  )                                   │
     ├─────────────────────────────────────►│
     │                                      │
     │  Subscribed. Waiting...              │
     │◄─────────────────────────────────────┤
     │                                      │
     │  EVENT: New contact created          │
     │  {id: "c-123", name: "Ahmed Hassan", │
     │   email: "ahmed@techcorp.com"}       │
     │◄─────────────────────────────────────┤
     │                                      │
     │  update_record("c-123", {            │
     │    linkedin_url: "linkedin.com/...", │
     │    company_size: "50-200",           │
     │    phone: "+20-100-555-1234"         │
     │  }, confidence: 0.85)                │
     ├─────────────────────────────────────►│
     │                                      │
     │  Fields updated. Provenance:         │
     │  enrichment-agent, 0.85 confidence.  │
     │◄─────────────────────────────────────┤

Validation Agent                      AgentSync MCP
     │                                      │
     │  (subscribed to phone field changes) │
     │                                      │
     │  EVENT: phone field set on c-123     │
     │◄─────────────────────────────────────┤
     │                                      │
     │  Verifies via Twilio lookup...       │
     │  verify_field("c-123", "phone", {    │
     │    method: "twilio_lookup",          │
     │    outcome: "valid"                  │
     │  })                                  │
     ├─────────────────────────────────────►│
     │                                      │
     │  Verification attached to field.     │
     │  Confidence updated to 0.95.         │
     │◄─────────────────────────────────────┤
```

### Journey 5: Cross-Team Visibility

```
Tom's Agent (Engineering)             AgentSync MCP
     │                                      │
     │  "What deals are closing this month  │
     │   that might need onboarding?"       │
     ├─────────────────────────────────────►│
     │                                      │
     │  Permission check: Tom has read      │
     │  access to Deals (close_date,        │
     │  company, status only -- not revenue)│
     │                                      │
     │  Returns: 3 deals closing this       │
     │  month, companies and statuses.      │
     │  Revenue field redacted.             │
     │◄─────────────────────────────────────┤
```

### Journey 6: Admin Customization

```
Admin's Agent                         AgentSync MCP
     │                                      │
     │  "Add a custom field 'Lead Source'   │
     │   to Contacts. Options: Website,     │
     │   Referral, Cold Outreach, Event.    │
     │   Hint: where this contact first     │
     │   heard about us."                   │
     ├─────────────────────────────────────►│
     │                                      │
     │  Field added as Layer 3 override.    │
     │  All agents see it with hint.        │
     │  Instructions auto-updated.          │
     │◄─────────────────────────────────────┤
     │                                      │
     │  "When a deal moves to 'Won',        │
     │   automatically create an onboarding │
     │   project in the PM workspace"       │
     ├─────────────────────────────────────►│
     │                                      │
     │  Automation rule created:            │
     │  Trigger: Deal.stage -> 'won'        │
     │  Action: Create Project in PM        │
     │  with linked Company and Deal data.  │
     │◄─────────────────────────────────────┤
```

### Journey 7: Graph Traversal

```
Any Agent                             AgentSync MCP
     │                                      │
     │  traverse("company-456",             │
     │    relations: ["contacts", "deals",  │
     │      "activities"],                  │
     │    depth: 2                          │
     │  )                                   │
     ├─────────────────────────────────────►│
     │                                      │
     │  Returns connected graph:            │
     │  Company: TechCorp                   │
     │   ├── Contact: Ahmed Hassan          │
     │   │    └── Activity: Call (Feb 20)   │
     │   ├── Contact: Sara Ahmed            │
     │   │    └── Activity: Email (Feb 22)  │
     │   └── Deal: Enterprise License       │
     │        └── Activity: Demo (Feb 25)   │
     │◄─────────────────────────────────────┤
```

---

## MCP Resources (Passive Context Injection)

MCP Resources are read-only data endpoints that agents can load automatically on connection. Unlike tools (which require explicit calls), resources are passively injected into the agent's context -- the agent just *knows* the schema, stats, and rules without asking.

| Resource URI | Description |
|-------------|-------------|
| `agentsync://schema/overview` | Complete schema for all accessible workspaces: tables, fields, agent_hints, constraints, relationships. Injected on connect so every agent immediately understands the data model. This solves the "agent wakes up with no memory" problem -- the schema IS the memory. |
| `agentsync://workspace/{slug}/stats` | Live workspace statistics: record counts per table, active agents, recent activity, data quality metrics (avg confidence scores). Gives agents situational awareness. |
| `agentsync://instructions` | Assembled instructions for the connected agent based on their role, team context, business rules, and workspace access. The instruction engine output, delivered as a resource. |
| `agentsync://blueprints/catalog` | Available Blueprints (built-in + marketplace), browsable by the agent to suggest new systems to the admin. |

**Why Resources matter:** When a new agent connects via MCP, it reads these resources and immediately understands: what data exists, how it's structured, what the rules are, and what it should do. No onboarding call. No documentation. No explicit discovery API calls needed. The data explains itself.

---

## MCP Prompts (Guided Workflows)

MCP Prompts are pre-built, step-by-step workflows that agents can invoke. They guide the agent through complex multi-step tasks, reducing errors and ensuring best practices.

| Prompt | Description | Steps |
|--------|-------------|-------|
| `build_blueprint` | Guide an agent through designing and deploying a new Blueprint | 1. Describe the domain → 2. Agent proposes tables/fields/constraints → 3. Review & validate → 4. Deploy → 5. Create sample data |
| `investigate_record` | Deep dive into a record's history, provenance, and relationships | 1. Fetch record → 2. Show provenance for every field → 3. Show verification chain → 4. Traverse relationships → 5. Show audit trail |
| `data_quality_check` | Scan a workspace for data quality issues | 1. Identify fields with low confidence → 2. Find records with missing required data → 3. Detect stale records → 4. Flag inconsistencies across related records → 5. Generate quality report |
| `onboard_member` | Walk through setting up a new team member | 1. Create member → 2. Assign role → 3. Configure workspace access → 4. Set field-level permissions → 5. Generate welcome instructions → 6. Generate Agent Kit → 7. Send download link |
| `migrate_data` | Import data from external systems | 1. Describe source format → 2. Map fields to schema → 3. Validate sample batch → 4. Run bulk import → 5. Verify provenance |

**Why Prompts matter:** Without prompts, agents must figure out multi-step workflows on their own. A "build a CRM" request requires knowing to call `create_blueprint`, then `deploy_blueprint`, then configure constraints, then add hints -- a complex sequence. Prompts encode this knowledge so any agent can execute it reliably.

---

## MCP Tool Surface

The platform exposes these tools via MCP (and equivalently via REST API). Every tool is permission-gated.

### Schema Management (Admin only)
| Tool | Description |
|------|-------------|
| `create_workspace` | Create a new workspace (e.g., "Sales CRM", "Fleet Management") |
| `deploy_blueprint` | Deploy a pre-built or custom Blueprint to a workspace |
| `create_blueprint` | Design a new custom Blueprint (tables, fields, constraints, hints) |
| `evolve_blueprint` | Modify a deployed Blueprint (add fields, update constraints) |
| `create_table` | Create a standalone table in a workspace |
| `alter_table` | Add/modify/remove fields on a table |
| `list_blueprints` | Browse available Blueprints (built-in + marketplace) |
| `describe_schema` | Get full schema of a workspace or table with all hints and constraints |

### Data Operations (Role-gated)
| Tool | Description |
|------|-------------|
| `create_record` | Insert a new record with provenance tracking |
| `update_record` | Update fields on an existing record (with confidence score) |
| `delete_record` | Soft-delete a record |
| `get_record` | Retrieve a single record by ID (with provenance metadata) |
| `query_records` | Search/filter/sort records with conditions |
| `link_records` | Create a relationship between records |
| `traverse` | Graph traversal -- follow relationships across tables and workspaces |
| `verify_field` | Attach a verification to a field value (method, outcome) |
| `bulk_import` | Import multiple records (CSV, JSON) |

### Events (Role-gated)
| Tool | Description |
|------|-------------|
| `subscribe_events` | Subscribe to data change events by pattern |
| `unsubscribe_events` | Remove an event subscription |
| `list_subscriptions` | View active event subscriptions |

Supported event types:
- `record.created`, `record.updated`, `record.deleted` -- record-level changes
- `field.changed` -- specific field on a record changed
- `relation.added`, `relation.removed` -- record linking/unlinking
- `blueprint.deployed`, `blueprint.evolved` -- schema changes

Agents subscribe with filters:
```
subscribe_events(event: "record.created", workspace: "crm", table: "contacts")
subscribe_events(event: "field.changed", table: "deals", field: "stage")
subscribe_events(event: "record.updated", table: "inventory",
                 condition: { "quantity": { "$lt": "$reorder_point" } })
```

### Context & Discovery
| Tool | Description |
|------|-------------|
| `get_context` | Get team context, available workspaces, and role instructions |
| `list_workspaces` | List workspaces the agent has access to |
| `list_tables` | List tables in a workspace with descriptions and hints |
| `describe_table` | Get field definitions, agent_hints, constraints, and relationships |
| `search_global` | Full-text search across all accessible data |
| `get_agent_kit` | Generate and download an Agent Kit for a member (format: claude-desktop, claude-code, cursor, chatgpt, raw) |

### Member & Permission Management (Admin only)
| Tool | Description |
|------|-------------|
| `invite_member` | Add a member to the team with a role |
| `update_member_role` | Change a member's role/permissions |
| `list_members` | List all members and their roles |
| `create_role` | Define a custom role with specific permissions |
| `set_field_access` | Control which roles can see/edit specific fields |

### Schema Suggestions (Any agent)
| Tool | Description |
|------|-------------|
| `suggest_field` | Propose a new field on a table (name, type, hint, rationale). Admin reviews and approves/rejects. |
| `list_suggestions` | View pending field suggestions (admin sees all, agents see their own) |
| `approve_suggestion` | Admin approves a suggested field, adding it to the schema (Layer 3) |
| `reject_suggestion` | Admin rejects a suggestion with a reason |

This is the **governed organic growth** model: agents discover gaps in the schema during real work ("this contact has a LinkedIn URL but there's no field for it") and propose additions. The admin stays in control, but the schema evolves based on real agent needs rather than upfront guessing.

### Automation (Admin only)
| Tool | Description |
|------|-------------|
| `create_automation` | Define trigger-action rules |
| `list_automations` | View all active automations |
| `toggle_automation` | Enable/disable an automation |

### Audit & Monitoring (Admin only)
| Tool | Description |
|------|-------------|
| `get_audit_log` | View action history (who did what, when, why, and the agent's stated reason) |
| `get_agent_activity` | See what a specific agent has been doing |
| `get_provenance` | View the full provenance chain for a record or field |

Every audit entry includes a `reason` field -- the agent's explanation of WHY it took the action:
```json
{
  "action": "field.updated",
  "agent": "enrichment-agent",
  "record_id": "rec-456",
  "field": "phone",
  "old_value": null,
  "new_value": "+20-100-555-1234",
  "reason": "Enriched from Clearbit API based on email domain",
  "confidence": 0.85,
  "timestamp": "2026-02-24T10:05:00Z"
}
```
The `reason` field turns the audit log from "what happened" into "what happened and why" -- essential for human oversight of autonomous agents.

---

## Blueprints

Blueprints are versioned, installable modules that define complete business systems. They are the primary way teams get started, but they are NOT the limit -- any custom system can be built.

### Built-In Blueprints (Ship with Platform)

**CRM**
- Tables: Contacts, Companies, Deals, Activities, Notes
- Constraints: Pipeline stage transitions (Lead → Qualified → Proposal → Negotiation → Won/Lost)
- Agent hints: How to qualify leads, log activities, manage pipeline
- Relations: Contact → Company, Deal → Company, Deal → Contact, Activity → Contact

**Project Management**
- Tables: Projects, Tasks, Milestones, Sprints, Comments
- Constraints: Task status transitions (Backlog → Todo → In Progress → Review → Done)
- Agent hints: How to create tasks, track progress, manage sprints
- Relations: Task → Project, Task → Milestone, Task → Assignee

**HR / People**
- Tables: Employees, Departments, Positions, Time Off, Reviews, Payroll
- Constraints: Leave request approval flow, review cycle states
- Agent hints: How to request time off, submit reviews, check structure
- Relations: Employee → Department, Employee → Manager, Position → Department

**Support / Helpdesk**
- Tables: Tickets, Customers, Knowledge Base, SLAs
- Constraints: Ticket status transitions (Open → Triaged → In Progress → Resolved → Closed)
- Agent hints: How to triage, escalate, resolve, and document
- Relations: Ticket → Customer, Ticket → Assignee

**Inventory / Operations**
- Tables: Products, Orders, Suppliers, Warehouses, Stock Levels
- Constraints: Order status transitions, stock level alerts
- Agent hints: How to check stock, create orders, manage suppliers
- Relations: Product → Supplier, Stock Level → Warehouse, Order → Product

**Finance / Invoicing**
- Tables: Invoices, Payments, Expenses, Budgets, Accounts
- Constraints: Invoice status transitions, approval thresholds
- Agent hints: How to create invoices, track payments, manage budgets

### Custom Blueprints (Agent-Designed)

The admin's agent can design a Blueprint for **any domain**:

- Restaurant chain management
- Real estate portfolio tracking
- Legal case management
- Healthcare patient records
- Manufacturing production lines
- Event planning and coordination
- Content publishing pipeline
- Franchise operations
- Vehicle fleet management
- Compliance and audit tracking

The agent calls `create_blueprint` with the full schema definition. The platform validates it (field types, constraints, relations) and deploys it. The Blueprint can later be published to the marketplace for other teams.

### Seed Data

Blueprints can ship with **seed data** -- sample records that demonstrate how the system is meant to be used. When a Blueprint is deployed, the admin can optionally load seed data:

- **CRM Blueprint** -- 5 sample contacts, 2 companies, 3 deals at different pipeline stages, example activities
- **PM Blueprint** -- 1 sample project with tasks in various statuses, a sprint, and milestones
- **Custom Blueprint** -- Agent generates contextual sample data matching the domain

Seed data serves three purposes:
1. **Agents understand the pattern** -- They see real examples of how records should look, what fields are populated, and how relationships connect
2. **Admins validate the setup** -- Before going live, admins can verify the Blueprint works as expected
3. **Faster onboarding** -- New team members' agents see a populated system and immediately understand the structure

Seed data is tagged with `_is_seed: true` in metadata so it can be easily cleared when the team is ready for production.

### Blueprint Lifecycle

```
Design → Validate → Deploy → (Load Seed Data) → Customize → Evolve → (Publish to Marketplace)
```

1. **Design** -- Agent defines tables, fields, constraints, hints, and relations
2. **Validate** -- Platform checks for conflicts, missing relations, invalid constraints
3. **Deploy** -- Blueprint is activated in a workspace, storage is created
4. **Load Seed Data** -- Optionally populate with sample records to demonstrate the Blueprint
5. **Customize** -- Admin adds team-specific fields (Layer 3 overrides)
6. **Evolve** -- Blueprint can be updated (new fields, updated constraints); existing data is preserved
7. **Publish** -- Optionally share to the marketplace for other teams

---

## Provenance Model

Every field value carries metadata about its origin:

```json
{
  "id": "rec-abc-123",
  "data": {
    "name": "Ahmed Hassan",
    "email": "ahmed@techcorp.com",
    "phone": "+20-100-555-1234",
    "lead_source": "inbound",
    "linkedin_url": "linkedin.com/in/ahmedhassan"
  },
  "_provenance": {
    "name": {
      "agent": "sarah-sales-agent",
      "at": "2026-02-24T10:00:00Z",
      "confidence": 1.0
    },
    "phone": {
      "agent": "enrichment-agent",
      "at": "2026-02-24T10:05:00Z",
      "confidence": 0.85,
      "verification": {
        "by": "validation-agent",
        "method": "twilio_lookup",
        "at": "2026-02-24T10:06:00Z",
        "outcome": "valid"
      }
    },
    "linkedin_url": {
      "agent": "enrichment-agent",
      "at": "2026-02-24T10:05:00Z",
      "confidence": 0.90
    }
  }
}
```

### What Provenance Enables

- **Trust decisions** -- "Only call contacts with phone confidence > 0.9"
- **Debugging** -- "Why does this contact have the wrong email? Enrichment agent wrote it at 10:05"
- **Accountability** -- "Which agent is producing the most low-confidence data?"
- **Verification workflows** -- "Auto-verify all phone numbers with confidence < 0.95"
- **Data quality scoring** -- aggregate confidence across records for quality dashboards

---

## Permission Model

### Hierarchy

```
Team
  └── Roles (Admin, Manager, Member, Viewer, Custom...)
       └── Workspace Access (which workspaces a role can see)
            └── Table Access (CRUD per table)
                 └── Field Access (which fields are visible/editable)
                      └── Record Filters (row-level security rules)
                           └── Constraint Enforcement (state machines, business rules)
```

### Example Permission Matrix

| Role | CRM Workspace | PM Workspace | HR Workspace |
|------|--------------|-------------|-------------|
| Admin | Full access | Full access | Full access |
| Sales Manager | Full CRM access | Read projects | No access |
| Sales Rep | Own contacts + deals | No access | No access |
| Engineer | Read deals (no revenue) | Full PM access | No access |
| HR Manager | Read contacts (name/email only) | Read projects | Full access |
| Enrichment Agent | Write specific fields on contacts | No access | No access |

### Field-Level Security Example

The `Deals` table has a `revenue` field. Permission rules:
- Sales team: read/write
- Engineering: hidden (field not returned in queries)
- HR: hidden
- Admin: read/write
- Enrichment agent: read only (can see but not modify)

### Constraint Enforcement

Beyond permissions, the platform enforces schema constraints:
- **State transitions** -- A deal in "prospecting" can only move to "qualification" or "closed_lost". The platform rejects invalid transitions regardless of the agent's permissions.
- **Required fields** -- A ticket cannot be created without a "priority" field.
- **Cardinality** -- A deal can have only one "stage" value at a time.
- **Validation** -- An email field must match email format. A currency field must be positive.

---

## Instruction Engine

When an agent connects, it receives layered instructions. These work alongside (not replacing) per-field agent_hints:

### Layer 1: Team Context
```
You are connected to [Team Name]'s AgentSync workspace.
This team uses AgentSync for: CRM, Project Management, Fleet Management.
Your member is [Name], role: [Sales Rep].
```

### Layer 2: Workspace Context (per workspace accessed)
```
CRM Workspace (Blueprint: CRM v2):
- Contacts: People you interact with. 25 fields. See agent_hints for each.
- Companies: Organizations. 20 fields.
- Deals: Sales opportunities. Pipeline with enforced transitions.
- Activities: Interactions (calls, emails, meetings).

Pipeline stages: Lead → Qualified → Proposal → Negotiation → Won/Lost
Note: transitions are enforced. You cannot skip stages.
```

### Layer 3: Business Rules
```
Rules for this team:
- All deals over $100k require manager approval before moving to "Won"
- Every contact must have a company linked
- Activities must be logged within 24 hours
- Deals without activity for 14 days should be flagged
- Data from enrichment agents with confidence < 0.7 should be reviewed before use
```

### Layer 4: Role-Specific Guidance
```
As a Sales Rep, you can:
- Create and edit your own contacts and deals
- Log activities against any contact
- Move deals through pipeline stages (except to Won for deals >$100k)
- View but not edit other reps' contacts

You cannot:
- Delete records (request deletion from a manager)
- Export bulk data
- Modify workspace schema
- Override enrichment data
```

---

## Agent Kit

The Agent Kit is a downloadable, auto-generated client-side package that pre-configures an AI agent to work with AgentSync. It solves the bootstrapping problem: before an agent connects via MCP, it needs to know *how* to connect, *how* to think about data, and *what shortcuts* are available. The Agent Kit provides all of this in a single download.

### What It Contains

| Component | Purpose | Example |
|-----------|---------|---------|
| **System Instructions** | Identity, role context, and team description | "You are Sarah's AI agent at Acme Corp. You have access to the CRM workspace." |
| **MCP Connection Config** | Server URL, auth method, transport settings | `{ "url": "https://acme.agentsync.io/mcp", "auth": "oauth2.1" }` |
| **Behavioral Rules** | Platform-level constants for data-centric collaboration | "Always set confidence scores. Never overwrite fields with lower confidence." |
| **Skills / Commands** | Client-side shortcuts that map simple commands to MCP tool sequences | `/new-deal "Acme" 50000` → `create_record` + `link_records` + `create_record(activity)` |
| **Role-Specific Overlay** | Permissions summary, workspace access, things to avoid | "You can create deals but cannot move deals >$100k to Won without manager approval." |

### Generation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Agent Kit Generator                           │
│                                                                     │
│  Inputs:                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Member   │  │ Role &   │  │ Schema   │  │ Team     │             │
│  │ Profile  │  │ Perms    │  │ Service  │  │ Settings │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       └─────────────┴─────────────┴─────────────┘                   │
│                              │                                      │
│                    ┌─────────▼─────────┐                            │
│                    │  Template Engine  │                            │
│                    │  (merge inputs    │                            │
│                    │   with templates) │                            │
│                    └─────────┬─────────┘                            │
│                              │                                      │
│                    ┌─────────▼──────────┐                           │
│                    │  Format Adapter    │                           │
│                    │  (platform-        │                           │
│                    │   specific output) │                           │
│                    └─────────┬──────────┘                           │
│                              │                                      │
│                    ┌─────────▼─────────┐                            │
│                    │  Packager         │                            │
│                    │  (zip / JSON /    │                            │
│                    │   single file)    │                            │
│                    └─────────┬─────────┘                            │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               ▼
                        Agent Kit Download
```

### Per-Platform Output Formats

| Platform | Files Generated | Notes |
|----------|----------------|-------|
| **Claude Desktop** | `claude_desktop_config.json` + `CLAUDE.md` | Config goes in `~/Library/Application Support/Claude/`; CLAUDE.md placed in project root |
| **Claude Code** | `.mcp.json` + `CLAUDE.md` | Both placed in project root; `.mcp.json` configures the MCP server connection |
| **Cursor** | `.cursor/mcp.json` + `.cursorrules` | Cursor-native format; `.cursorrules` contains behavioral rules and skills |
| **ChatGPT** | `instructions.txt` | Single file with all instructions, rules, and connection guidance (no native MCP support yet) |
| **Raw / Custom** | `system-prompt.md` + `mcp-config.json` + `skills.json` | For custom agents or frameworks; each component is a separate, parseable file |

### Example: Generated CLAUDE.md

```markdown
# AgentSync Agent — Acme Corp

You are Sarah's AI agent connected to Acme Corp's AgentSync workspace.

## Identity
- **Team:** Acme Corp
- **Member:** Sarah Chen (sarah@acme.com)
- **Role:** Sales Rep
- **Workspaces:** CRM

## Behavioral Rules
- Always set a `confidence` score (0.0–1.0) when writing data. Use 1.0 for
  user-provided facts, 0.7–0.9 for enriched/inferred data.
- Always provide a `reason` explaining why you're creating or updating a record.
- Never overwrite a field that has higher confidence than your new value.
- Subscribe to events instead of polling for changes.
- Suggest new fields via `suggest_field` instead of stuffing data into notes.
- Respect state machine constraints — don't try to skip pipeline stages.
- When you see provenance metadata, factor confidence into your decisions.

## Skills
- `/new-deal <company> <amount>` — Create a deal, link to company, log activity.
  Maps to: `create_record(table: "deals", ...)` → `link_records(...)` →
  `create_record(table: "activities", ...)`
- `/enrich <contact-id>` — Look up a contact's public info and update fields.
  Maps to: `get_record(...)` → [external lookup] → `update_record(..., confidence: 0.85)`
- `/pipeline` — Show current pipeline summary.
  Maps to: `query_records(table: "deals", group_by: "stage")`
- `/check-quality` — Run a data quality check on the CRM workspace.
  Maps to: MCP Prompt `data_quality_check(workspace: "crm")`

## Connection
This agent connects to AgentSync via MCP. The connection is configured in
`.mcp.json` (Claude Code) or `claude_desktop_config.json` (Claude Desktop).
Authentication uses OAuth 2.1 — you will be prompted to authorize on first connect.
```

### Agent Kit as MCP Tool

Agents that are already connected can generate Agent Kits for other members (or themselves, for a different platform):

```
get_agent_kit(format: "claude-code", member_id?: "usr-abc-123")
```

- `format` — required. One of: `claude-desktop`, `claude-code`, `cursor`, `chatgpt`, `raw`
- `member_id` — optional. Defaults to the calling agent's member. Admins can generate kits for any member.

Returns the Agent Kit as a JSON payload with base64-encoded file contents, ready for the agent to write to disk or send to the member.

### Agent Kit as REST Endpoint

```
GET /v1/agent-kit?format=claude-code&member_id=usr-abc-123
```

Returns the Agent Kit as a downloadable zip file (or JSON payload with `Accept: application/json`). Available from the dashboard for human-initiated downloads.

### Lifecycle

```
1. Admin onboards member (or member self-registers)
2. Agent Kit generated on demand (reflects current schema, permissions, rules)
3. Member downloads and installs Agent Kit
4. Agent connects via MCP, receives live context (Resources + Instructions)
5. Schema changes → Agent Kit becomes stale
6. Dashboard or agent detects staleness → prompts regeneration
7. Member downloads updated Agent Kit
```

Agent Kits are **generated on demand**, not pre-computed. This ensures they always reflect the current schema, permissions, and business rules. Staleness is tracked by comparing the current schema version hash against the hash at last generation time.

### Layered Context: How Agent Kit Fits

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 3: Live Instructions (Instruction Engine)             │
│  Assembled per-request. Business rules, role guidance,       │
│  team policies. Changes with every schema/rule update.       │
│  Delivered via: MCP Resource (agentsync://instructions)      │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: Live Schema & Context (MCP Resources)              │
│  Tables, fields, hints, constraints, stats.                  │
│  Refreshed on connect + subscription updates.                │
│  Delivered via: MCP Resources (agentsync://schema/overview)  │
├──────────────────────────────────────────────────────────────┤
│  Layer 1: Agent Kit (Client-Side Bootstrap)                  │
│  Identity, behavioral rules, skills, connection config.      │
│  Installed once, updated on staleness.                       │
│  Delivered via: Download / MCP tool / REST endpoint          │
└──────────────────────────────────────────────────────────────┘

Layer 1 gets the agent connected and thinking correctly.
Layer 2 gives it the live data model.
Layer 3 gives it the business rules and role-specific guidance.

Together, an agent goes from "I know nothing" to "I know everything I need"
without a single onboarding conversation.
```

---

## REST API

All MCP tools are also available as REST endpoints for agents and applications that don't support MCP:

### Data Operations
```
POST   /v1/records                    # Create record
GET    /v1/records/{id}               # Get record (with provenance)
PATCH  /v1/records/{id}               # Update record
DELETE /v1/records/{id}               # Soft-delete record
POST   /v1/records/query              # Search/filter records
POST   /v1/records/{id}/verify        # Verify a field value
POST   /v1/traverse                   # Graph traversal
```

### Schema & Blueprints
```
GET    /v1/workspaces                 # List workspaces
POST   /v1/workspaces                 # Create workspace
GET    /v1/blueprints                 # List available blueprints
POST   /v1/blueprints                 # Create custom blueprint
POST   /v1/blueprints/{name}/deploy   # Deploy blueprint to workspace
POST   /v1/blueprints/{name}/evolve   # Evolve a deployed blueprint
GET    /v1/schema/{workspace}         # Get full schema with hints
```

### Events
```
POST   /v1/events/subscriptions        # Subscribe to events
DELETE /v1/events/subscriptions/{id}   # Unsubscribe
GET    /v1/events/subscriptions        # List subscriptions
GET    /v1/events/stream              # SSE stream of subscribed events
```

### Agent Kit
```
GET    /v1/agent-kit                  # Generate & download Agent Kit (?format=claude-code&member_id=...)
```

### Audit
```
GET    /v1/audit                      # Query audit log
GET    /v1/provenance/{record_id}     # Full provenance for a record
```

---

## Future Capabilities

### Phase 2: File Storage
Shared file storage for agents. Attach files to records. Store documents, images, exports. Permission-gated like everything else.

### Phase 3: Dashboard Generation

When agents manage business data, humans need to see and interact with it. The platform auto-generates dashboards directly from the schema -- no configuration needed.

**How it works:**
1. Agent deploys a CRM Blueprint with deal stages, contacts, and companies
2. The schema defines field types, constraints, and relationships
3. An agent (or human) calls `generate_dashboard(workspace: "crm", view_type: "kanban")`
4. The platform reads the schema, generates a dashboard configuration, and renders it as an interactive web page
5. Returns a URL. Human opens it, sees their deals in a kanban board with filters, sorting, and drill-down

**View types:**

| View         | Best For                                                    | Schema Signals                                          |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------------- |
| **Table**    | Any data -> sortable, filterable data grid                  | Default for any table                                   |
| **Kanban**   | Status/stage fields -> stage-based board                    | Fields with `constraints.transitions` (state machines)  |
| **Chart**    | Numeric/date aggregations -> bar, line, pie, funnel         | Numeric fields, date fields, select fields for grouping |
| **Overview** | High-level summary -> metric cards + table + chart combined | Aggregates across a workspace                           |

**Schema-driven generation:**
- Column types, filter options, and sort defaults come from `schema_fields`
- Kanban columns come from `options` on status fields with transitions
- Chart configurations come from numeric/currency/date fields
- Relationships enable drill-down navigation (click a deal → see linked contacts)
- `agent_hint` text appears as field tooltips for human context

**Provenance in dashboards:**
- Hover over any field value to see which agent wrote it, when, and confidence level
- Color-coded confidence indicators (green > 0.9, yellow > 0.7, red < 0.7)
- Click to see full verification chain

Dashboards fetch data from the API at runtime, so they're always up to date. They respect the same permission model -- a dashboard for a Sales Rep only shows what their role can access.

### Phase 4: Analytics & Reporting
- Agents can query aggregated data (pipeline value, task velocity, etc.)
- Scheduled report generation
- Cross-workspace analytics
- Data quality scoring (aggregate confidence and verification metrics)

### Phase 5: Blueprint Marketplace

A community-driven marketplace where teams publish, discover, and install Blueprints.

**Publishing flow:**
1. A team's agent builds a "Restaurant Management" Blueprint and refines it over weeks of real use
2. Admin tells their agent to publish it: `publish_blueprint("restaurant-mgmt", { tags: ["food-service", "operations"], description: "..." })`
3. The Blueprint is reviewed (automated validation + community review for quality)
4. Published to the marketplace with documentation, schema overview, and sample data

**Discovery:**
- Browse by category (Sales, Operations, HR, Industry-specific, etc.)
- Search by keyword, tag, or use case
- View ratings, reviews, install counts, and last-updated date
- Preview the full schema (tables, fields, constraints, hints) before installing

**Installation:**
1. Admin's agent calls `install_blueprint("restaurant-mgmt")`
2. The Blueprint is deployed to a new workspace
3. The admin can optionally load seed data
4. Layer 3 customizations begin immediately -- the installed Blueprint is a starting point, not a straitjacket

**What a marketplace Blueprint includes:**
- Full schema definition (tables, fields, constraints, agent_hints, relationships)
- Seed data (sample records demonstrating the intended data patterns)
- Instructions (business rules and agent guidance for the domain)
- Automation rules (triggers and actions common to the domain)
- Version history and changelog

**Network effects:** As more Blueprints are published, the platform becomes more valuable for everyone. Common business domains get well-tested, community-refined schemas. Niche domains (veterinary clinics, property management, film production) become available without the team having to design from scratch.

**Monetization (later):**
- Free Blueprints (community-contributed, platform-maintained)
- Premium Blueprints (by specialized creators or agencies, revenue-shared)
- Enterprise Blueprints (compliance-certified, with SLA)

### Phase 6: SDKs & Framework Integrations
- Python SDK for custom agent developers
- TypeScript SDK
- LangChain integration (toolkit wrapper)
- CrewAI integration (toolkit wrapper)
- OpenAI Agents SDK integration
