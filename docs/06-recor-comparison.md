# Deep Comparison: Our Plan (AgentSync) vs. Recor PDF

*Analysis date: February 27, 2026*

---

## Executive Summary

Both documents describe the same core idea -- a centralized, AI-native data platform for agent collaboration -- but approach it from **fundamentally different philosophies**:

| Dimension | Our Plan (AgentSync) | Recor PDF |
|-----------|---------------------|-----------|
| **Philosophy** | Business platform that replaces SaaS tools | Semantic knowledge graph for autonomous agents |
| **Target user** | Team admin / member (via agent) | Developer / agent builder |
| **Data model** | Relational with JSONB flexibility | Knowledge graph (entity-property-relation) |
| **Auth model** | OAuth 2.1 (MCP spec compliant) | API keys (workspace-scoped) |
| **Governance** | Team → Role → Workspace hierarchy | Flat workspace + scopes |
| **Schema philosophy** | Admin-controlled, template-driven | Organic growth, any agent can extend |
| **Positioning** | Replace 5-10 SaaS tools at 38% cost | Infrastructure for agent builders |
| **Completeness** | Vision + Market Research + Product + Architecture + GTM | Product concept + Architecture only |

**Bottom line:** Recor has several technically brilliant ideas (provenance, confidence, state machines, event subscriptions, ontology with agent_hints) that we should adopt. But our plan is stronger in enterprise readiness, governance, auth, business positioning, and completeness. The ideal product combines the best of both.

---

## Part 1: What Recor Covers That We Already Cover

| Recor Concept | Our Equivalent | Notes |
|--------------|---------------|-------|
| Entities (typed, in workspaces) | Records (in tables, in workspaces) | Same concept, different naming |
| Properties (key-value on entities) | Fields (columns on tables) + JSONB data | Similar flexibility |
| Relations between entities | `record_relations` table + `link_records` tool | Both support record linking |
| Ontology (schema definitions) | `schema_tables` + `schema_fields` (metadata registry) | Both metadata-driven |
| Packs (template modules) | Templates (pre-built schema packages) | Same concept, different names |
| CRM, HR, PM, Inventory packs | CRM, HR, PM, Support, Finance, Inventory templates | Nearly identical coverage |
| MCP as primary agent interface | MCP as the only interface | Both MCP-first |
| Audit trail (every action logged) | `audit_log` table with full action history | Both comprehensive |
| Permission scopes (module:action) | 6-layer permission hierarchy | Both role-gated, ours deeper |
| Policy engine (rate limiting, rules) | Business rules layer + custom 6-layer PermissionService | Both present |
| Agent discovers what exists on connect | `get_context` + `describe_table` + instruction engine | Both solve discovery |
| Workspace isolation | Workspace concept with access control | Identical concept |
| Pack marketplace (future) | Template marketplace (Phase 5) | Both planned |
| PostgreSQL + JSONB + Redis | PostgreSQL + JSONB + Redis | Same tech choices |

**Verdict: ~60% overlap on core concepts.** The fundamental data-platform-for-agents idea is the same. The differences are in depth and philosophy.

---

## Part 2: Recor Ideas We Should Adopt (They're Better)

### 1. Property-Level Provenance -- CRITICAL

**Recor's approach:**
Every property (field value) records which agent wrote it and when:
```json
{
  "predicate": "core:phone",
  "value": "+20-100-555-1234",
  "source_agent": "enrichment-agent",
  "timestamp": "2026-02-24T10:05:00Z"
}
```

**Our current approach:**
We only track `created_by` and `updated_by` at the **record** level. If Agent A creates a contact and Agent B adds the phone number, we only know Agent B touched the record last -- not that B specifically added the phone.

**Why Recor is better:**
In multi-agent scenarios, multiple agents contribute to the same record. Sales agent creates the contact, enrichment agent adds LinkedIn data, validation agent verifies the phone. Per-field provenance is essential to know who contributed what and to debug agent behavior.

**Recommendation:** Adopt. Store provenance metadata per field write. Can be implemented as a JSONB `_provenance` field alongside `data`:
```json
{
  "data": { "name": "Ahmed", "phone": "+20-100-555-1234" },
  "_provenance": {
    "phone": { "agent": "enrichment-agent", "at": "2026-02-24T10:05:00Z" }
  }
}
```

### 2. Confidence Scores -- HIGH VALUE

**Recor's approach:**
Each property carries a `confidence` score (0.0 to 1.0). The enrichment agent is 85% sure about a phone number. Other agents can factor this into their decisions.

**Our current approach:**
Not present. All data is treated as equally reliable.

**Why Recor is better:**
When AI agents write data, not all values are equally certain. A phone number from a Clearbit API lookup vs. a phone number manually confirmed by the contact are very different. Confidence scores let agents make informed decisions (e.g., "only call contacts with phone confidence > 0.9").

**Recommendation:** Adopt. Include in the provenance metadata:
```json
"_provenance": {
  "phone": { "agent": "enrichment-agent", "at": "...", "confidence": 0.85 }
}
```

### 3. Verification Chains -- HIGH VALUE

**Recor's approach:**
A property can be verified by another agent, with the verification attached to the property itself:
```json
"verification": {
  "by": "phone-validation-agent",
  "method": "twilio_lookup",
  "date": "2026-02-24T10:06:00Z",
  "outcome": "valid"
}
```

**Our current approach:**
Not present.

**Why Recor is better:**
This creates a trust chain. Agent A enriches data → Agent B verifies it → confidence increases. This is a uniquely valuable pattern for autonomous multi-agent systems where data quality matters.

**Recommendation:** Adopt as part of provenance metadata. Not for every field, but as an optional capability for fields that benefit from verification.

### 4. State Machine Constraints in Schema -- CRITICAL

**Recor's approach:**
Valid state transitions are defined in the ontology:
```json
"constraints": {
  "transitions": {
    "prospecting": ["qualification", "closed_lost"],
    "qualification": ["proposal", "closed_lost"],
    "negotiation": ["closed_won", "closed_lost"]
  }
}
```
The platform **enforces** these. An agent can't move a deal from "prospecting" to "closed_won" directly.

**Our current approach:**
We mention "business rules" as text instructions ("All deals over $100k require manager approval before moving to Won") but don't formalize state machines in the schema or enforce them at the platform level.

**Why Recor is better:**
Text instructions are suggestions that smart agents might follow. Schema-enforced constraints are rules that cannot be broken. For business workflows, enforcement at the platform level is far more reliable than trusting agents to follow text instructions.

**Recommendation:** Adopt. Add a `constraints` field to `schema_fields` for select/status fields:
```json
{
  "field_type": "select",
  "options": ["prospecting", "qualification", "proposal", "negotiation", "won", "lost"],
  "constraints": {
    "transitions": {
      "prospecting": ["qualification", "lost"],
      "qualification": ["proposal", "lost"]
    }
  }
}
```

### 5. Event Subscription System -- CRITICAL

**Recor's approach:**
Agents can subscribe to data change events:
```
subscribe_events(event_type="entity.created", entity_type="support:Ticket")
```
Events include entity events, property events, relation events, pack events. Agents react to data changes in real time.

**Our current approach:**
No event system in the product spec. Redis pub/sub is mentioned in the tech architecture but only for internal caching. Webhooks are deferred to Phase 3.

**Why Recor is better:**
This is essential for autonomous agents. Without event subscriptions, agents must poll for changes or rely on humans to trigger them. A triage agent that auto-assigns tickets NEEDS to know when a ticket is created. A procurement agent that reorders stock NEEDS to know when inventory drops.

**Recommendation:** Adopt and make it a core feature, not Phase 3. Add `subscribe_events` and `unsubscribe_events` to the MCP tool surface. Implement via Redis Streams or PostgreSQL LISTEN/NOTIFY.

### 6. Three-Layer Schema Inheritance -- HIGH VALUE

**Recor's approach:**
```
Layer 1: Core Ontology    -- Universal primitives (Person, name, email). Never modified.
Layer 2: Domain Packs     -- CRM, HR, PM modules. Installed per workspace.
Layer 3: Workspace Custom  -- Custom overrides. Extends or overrides layers below.
```
Resolution is top-down: workspace definitions override pack definitions, which override core.

**Our current approach:**
Templates are applied to workspaces as a one-time copy. No inheritance or layered resolution. Customizations after applying a template are independent.

**Why Recor is better:**
Inheritance means template updates can propagate. If the CRM pack adds a new best-practice field, all workspaces using it can get the update without losing customizations. Our approach requires manual schema migration after template changes.

**Recommendation:** Adopt the layered model. Core fields (name, email, phone, status, created_at) should be universal. Domain templates provide a second layer. Workspace customizations override but don't lose the link to the source template.

### 7. `agent_hint` on Schema Definitions -- HIGH VALUE

**Recor's approach:**
Every predicate definition includes an `agent_hint`:
```json
"agent_hint": "Use this to track where a sales opportunity sits in the pipeline. Valid transitions are enforced."
```
When a new agent connects and reads the ontology, it immediately understands each field's purpose and usage.

**Our current approach:**
We have a separate "Instruction Engine" that assembles text documents. Schema definitions (`schema_fields`) have `name`, `description`, and `field_type` but no explicit agent guidance.

**Why Recor is better:**
Agent hints co-located with the schema definition are always in sync. Our separate instruction engine could drift from the actual schema. Plus, agent_hints are more granular (per field) vs. our instructions which describe entire workspaces.

**Recommendation:** Adopt. Add `agent_hint` to `schema_fields`. Keep our instruction engine too -- it handles higher-level guidance (business rules, role-specific behavior) that doesn't belong on individual fields. The two are complementary:
- `agent_hint` = "what is this field and how to use it" (per field)
- Instruction engine = "how the business works and what you should do" (per role/workspace)

### 8. REST API as Secondary Interface -- PRACTICAL

**Recor's approach:**
MCP is primary, but a full REST API is also available for any agent or application that can make HTTP calls.

**Our current approach:**
MCP is the "single connection point." No REST API mentioned.

**Why Recor is more practical:**
Not all agents support MCP yet. During migration from legacy tools, external systems may need to push data in. Webhooks from other services need an HTTP endpoint. A REST API is not contradictory to our vision -- it's just a pragmatic fallback.

**Recommendation:** Adopt. The MCP server already runs on HTTP (Streamable HTTP transport). Exposing the same operations as REST endpoints is minimal additional work and significantly expands reach.

### 9. "Data IS the Communication Channel" Philosophy -- STRONG POSITIONING

**Recor's articulation:**
"Agents communicate through the data itself. The Architect left structured data that the Triage Agent understood. No agent talked directly to another. The audit log shows everything that happened."

**Our current approach:**
We implicitly do this (all agents read/write to shared data) but don't articulate it as a core philosophy.

**Recommendation:** Adopt as explicit messaging. This is a powerful differentiator from messaging-based agent orchestration (A2A protocol, etc.). "Agents don't need to talk to each other. They need to talk to the data."

---

## Part 3: Recor Ideas We Should NOT Adopt

### 1. API Key Authentication
**Recor:** Every agent gets a bcrypt-hashed API key scoped to a workspace.

**Why we should not adopt:**
- The MCP specification mandates OAuth 2.1 for remote servers
- API keys are static, can't be easily rotated, and lack fine-grained scoping
- No standard way to tie API keys to identity claims (org, role, user)
- Enterprise customers require OAuth/OIDC for compliance

**Our approach is better:** OAuth 2.1 with PKCE, short-lived JWTs, refresh rotation.

### 2. Ungoverned Schema Growth ("Any Agent Can Add Properties")
**Recor:** "Any agent can attach new properties to any entity. No schema migrations. No coordination."

**Why we should not adopt:**
- In an enterprise context, uncontrolled schema growth leads to chaos
- Agent A adds `phone_number`, Agent B adds `phoneNumber`, Agent C adds `phone` -- three fields for the same thing
- No way to enforce data standards or naming conventions
- Compliance teams cannot audit or control what data is being collected
- Field-level permissions become impossible if fields appear without governance

**Our approach is better:** Admin-controlled schema with natural language customization. The admin says "add a phone field" and it's done -- but it's intentional, named correctly, typed correctly, and visible in the schema.

**Compromise:** Consider a "suggested fields" concept where agents can *propose* new fields that an admin approves. This captures the organic discovery benefit without the governance risk.

### 3. No Organization Hierarchy
**Recor:** Workspaces are the top-level concept. No organization, no employee provisioning, no org-wide roles.

**Why we should not adopt:**
- A business needs one place to manage all its workspaces, users, and billing
- Without an org concept, there's no way to invite employees, set org-wide policies, or manage billing
- Cross-workspace permissions (engineer reads CRM deals but edits PM tasks) require an org-level role system
- Recor's model forces per-workspace user management, which doesn't scale

**Our approach is significantly better** for business customers.

### 4. Self-Hosted Docker Compose Positioning
**Recor:** "Getting Started" shows `docker compose up -d` and curl commands.

**Why we should not adopt:**
- Self-hosted means the customer manages infrastructure, scaling, security, backups
- Contradicts the "replace SaaS tools" value prop (you're trading SaaS tools for self-hosted infra)
- Limits market to technical teams who can manage Docker
- Cloud-hosted is the right default for business customers

**Our approach is better.** Cloud-hosted with self-hosted option later for enterprise.

### 5. EAV (Entity-Attribute-Value) as Write Layer
**Recor's hybrid storage:**
- Tier 1: Materialized flat tables (reads)
- Tier 2: EAV property store (writes)
- Tier 3: Audit archive

**Why we should not adopt:**
- This creates sync complexity between Tier 1 and Tier 2 that must be maintained
- Our JSONB approach achieves the same flexibility in a single store
- GIN indexes on JSONB + typed index tables give us comparable query performance
- EAV is well-known to have severe performance issues at scale (the reason Salesforce had to build MT_Indexes on top)
- Two-tier write/read separation means eventual consistency, which is risky for business data

**Our JSONB hybrid approach is simpler and equally capable.** One write path, one read path, with indexes for performance-critical fields.

### 6. `ui_hints` in Schema (Color Maps, Display Types)
**Recor:** Ontology includes `ui_hints: { display: "kanban", color_map: { ... } }`.

**Why we should not adopt (for now):**
- Leaks UI concerns into the data model
- Our positioning is "the agent IS the interface" -- if we're building for agents, not humans, the data model shouldn't care about kanban colors
- When we add dashboard generation (later phase), we can derive display config from field types without polluting the schema

### 7. pgvector for Semantic Search
**Recor:** Includes pgvector for vector search on the ontology.

**Why not now:**
- Adds significant complexity (embedding generation, vector index management)
- For structured business data, standard full-text search + filters cover 95% of use cases
- Can be added later if semantic search proves necessary

---

## Part 4: Where Our Plan Is Already Stronger

### 1. Permission Depth
**Ours:** 6-layer hierarchy (Org → Workspace → Table → Field → Record → Business Rules). Field-level hiding. Record-level filters ("own records only").

**Recor:** Scope-based (module:action). Predicate-level access. No record-level filtering, no field-level hiding per role.

**Example Recor can't do:** "Engineers can see Deals but not the revenue field." Recor's scopes are module-level (crm:read), not field-level.

### 2. Authentication Security
**Ours:** OAuth 2.1, PKCE, short-lived JWTs, refresh rotation, API gateway.

**Recor:** Static API keys (bcrypt stored). No token rotation, no standard identity claims.

### 3. Instruction Engine (Higher-Level Guidance)
**Ours:** 4-layer contextual instructions that tell agents not just what fields exist, but how the business works, what the agent should prioritize, and what the role-specific behavior should be.

**Recor:** `agent_hint` per predicate is useful but doesn't provide business-level guidance like "prioritize deals closing this quarter" or "escalate tickets from enterprise customers."

**Best approach:** Combine both. Use agent_hints for field-level guidance AND our instruction engine for business-level guidance.

### 4. Complete Business Planning
**Ours:** Market research, competitive analysis, pricing model, target customers, launch phasing, GTM strategy.

**Recor:** Technical document only. No business context.

### 5. Scaling Strategy
**Ours:** 3-phase plan with specific capacity targets.

**Recor:** Not addressed.

### 6. Security Hardening
**Ours:** Encryption at rest/transit, secrets management, SQL injection prevention, SSRF protection, rate limiting tiers.

**Recor:** Minimal security discussion beyond API keys and scopes.

---

## Part 5: Interesting Philosophical Differences

### 1. Knowledge Graph vs. Relational Model

**Recor** thinks of data as a **graph**: entities connected by typed relations, with properties as key-value pairs on entities. This is closer to how the real world works (a person *works at* a company, a deal *belongs to* a company).

**We** think of data as **tables**: records in tables with foreign keys between them. This is closer to how traditional business software works.

**Analysis:** Recor's graph model is more flexible for *discovery* (an agent can traverse connections without knowing the schema). Our relational model is more efficient for *operations* (query all deals in the pipeline sorted by close date). For business operations, the relational model is better. But we should borrow graph traversal capabilities for cross-entity exploration.

### 2. Developer-First vs. Business-First

**Recor** is designed for agent builders and developers. The "Getting Started" is `docker compose up -d` + curl commands. The Python SDK is for developers building custom agents.

**We** are designed for business admins who use their existing AI agent. The onboarding journey is "tell your agent to set up a CRM."

**Analysis:** Both are valid markets. But the bigger market is business users, not developers. Developers will build their own solutions. Businesses will pay for a managed platform.

### 3. Organic Growth vs. Governed Structure

**Recor** favors letting agents organically extend the schema. This is beautiful for exploration and rapid prototyping but dangerous for production business data.

**We** favor admin-controlled structure with natural language customization. This is safer but less flexible.

**Analysis:** The right answer is likely a hybrid: governed schema for production data, with a "sandbox" or "suggested fields" mechanism that lets agents propose extensions that admins can approve.

---

## Part 6: Consolidated Recommendations

### Priority 1: Adopt in Our Plan (Before Development)

| # | Feature | From | Impact | Implementation Effort |
|---|---------|------|--------|----------------------|
| 1 | Field-level provenance (source_agent, timestamp) | Recor | Critical for multi-agent trust | Medium -- add `_provenance` JSONB column |
| 2 | State machine constraints in schema | Recor | Critical for workflow enforcement | Low -- add `constraints` to `schema_fields` |
| 3 | Event subscription system | Recor | Critical for autonomous agents | Medium -- add subscribe/unsubscribe tools + Redis Streams |
| 4 | `agent_hint` on field definitions | Recor | High -- better agent understanding | Low -- add column to `schema_fields` |
| 5 | REST API alongside MCP | Recor | High -- pragmatic reach | Low -- same handlers, different transport |
| 6 | "Data IS the communication channel" philosophy | Recor | High -- strong positioning | Zero -- just messaging |

### Priority 2: Adopt in Our Plan (Phase 1-2)

| # | Feature | From | Impact | Implementation Effort |
|---|---------|------|--------|----------------------|
| 7 | Confidence scores on field values | Recor | High for AI-written data quality | Low -- part of provenance metadata |
| 8 | Three-layer schema inheritance | Recor | High for template evolution | High -- requires schema resolution logic |
| 9 | Graph traversal API | Recor | Medium -- powerful for exploration | Medium -- add `traverse` tool |
| 10 | Verification chains | Recor | Medium -- builds trust in data | Low -- part of provenance metadata |
| 11 | Python SDK | Recor | Medium -- developer adoption | Medium -- separate package |

### Priority 3: Consider for Later Phases

| # | Feature | From | Impact | Notes |
|---|---------|------|--------|-------|
| 12 | Dashboard generation | Recor | High for human oversight | Significant effort. Phase 3-4. |
| 13 | LangChain/CrewAI integrations | Recor | Medium for developer market | After Python SDK |
| 14 | URI-based entity identification | Recor | Low -- mostly cosmetic | Nice to have alongside UUIDs |
| 15 | Semantic search (pgvector) | Recor | Low for v1 | Full-text search covers 95% |

### Do Not Adopt

| # | Feature | From | Why Not |
|---|---------|------|---------|
| 1 | API key auth | Recor | OAuth 2.1 is required by MCP spec and far more secure |
| 2 | Ungoverned schema growth | Recor | Enterprise needs governance; propose field-suggestion instead |
| 3 | No org hierarchy | Recor | Business customers need org → role → workspace |
| 4 | Self-hosted default | Recor | Cloud-hosted is our value prop |
| 5 | EAV as write layer | Recor | JSONB hybrid is simpler with equal flexibility |
| 6 | ui_hints in schema | Recor | Premature; derive from field types when dashboards are added |

---

## Part 7: Summary Scorecard

| Category | AgentSync (Ours) | Recor (PDF) | Winner |
|----------|-----------------|-------------|--------|
| **Vision / Problem Statement** | Strong | Strong | Tie -- both articulate it well |
| **Data Model Sophistication** | Good (JSONB hybrid) | Excellent (provenance, confidence, graph) | Recor |
| **Schema System** | Good (metadata registry) | Excellent (ontology + agent_hints + inheritance) | Recor |
| **Event / Reactivity** | Weak (deferred to Phase 3) | Strong (subscribe_events, pattern matching) | Recor |
| **State Machine Enforcement** | Weak (text instructions) | Strong (enforced transitions in schema) | Recor |
| **Authentication** | Excellent (OAuth 2.1) | Weak (API keys) | Ours |
| **Permission Granularity** | Excellent (6-layer) | Moderate (scope-based) | Ours |
| **Multi-Tenancy / Org Model** | Excellent | Absent | Ours |
| **Instruction / Context Engine** | Excellent (4-layer assembly) | Good (agent_hints) | Ours (but combine both) |
| **Business Readiness** | Excellent (pricing, GTM, market research) | Not addressed | Ours |
| **Security Depth** | Excellent | Basic | Ours |
| **Scalability Planning** | Good (3-phase) | Not addressed | Ours |
| **Developer Experience** | Moderate (MCP only) | Excellent (MCP + REST + SDK + framework integrations) | Recor |
| **Human Oversight** | Moderate (audit log) | Strong (audit + dashboards) | Recor |

**Overall: Our plan is stronger as a business-ready product. Recor is stronger on data model innovation. The best product takes our business foundation and adds Recor's data model innovations.**
