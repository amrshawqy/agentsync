# Go-To-Market: Naming, Positioning, Pricing & Launch Strategy

---

## Naming

"AgentSync" is a working name. Here are options across different naming directions:

### Option A: Descriptive / Functional
| Name | Vibe | Domain Risk |
|------|------|-------------|
| **AgentBase** | The base layer for all agents | Likely taken |
| **AgentLayer** | Infrastructure layer for agent collaboration | Available-ish |
| **AgentCore** | Core data platform for AI agents | Common pattern |

### Option B: Metaphorical / Evocative
| Name | Vibe | Why |
|------|------|-----|
| **Hive** | Collective intelligence, shared workspace | Bees share context, roles, and work toward a goal |
| **Nexus** | Central connection point | Where all agents meet |
| **Fabric** | The underlying connective tissue | Holds everything together |
| **Cortex** | Shared brain of the organization | Intelligence + memory |

### Option C: Short & Brandable
| Name | Vibe |
|------|------|
| **Kova** | Short, memorable, no existing meaning |
| **Synq** | "Sync" with a twist |
| **Orra** | Sounds like "aura" -- presence, context |
| **Tela** | Latin for "web" -- connective tissue |

### Recommendation
**Hive** is the strongest metaphor. "Connect your agents to the Hive" is immediately understandable. The hive is where agents share knowledge, follow rules, and work together. "HiveBase" or just "Hive" positions it clearly.

Note: If we go with "Hive", the top-level container could naturally be called a "Hive" instead of "Team" -- "Create a Hive for your company." Worth considering during naming finalization.

Fallback: **Nexus** or **Cortex** if Hive has trademark issues.

---

## Positioning

### One-Liner
> "The AI-native backend for your team. One platform, one MCP connection, all your business data."

### Elevator Pitch
> Everyone on your team is getting an AI agent. But those agents work in silos -- each connecting to JIRA, HubSpot, Workday separately. [Product] replaces those fragmented tools with a single, AI-native platform. Your admin says "set up a CRM" and it's done. Every agent connects to one place, shares the same data, follows the same rules. Think of it as the shared brain for your team's AI agents.

### Category
**AI-Native Business Platform** or **Agent Data Platform**

This is a new category. Avoid positioning as:
- "AI agent framework" (we're not CrewAI/LangGraph)
- "Integration platform" (we're not Zapier/Pipedream)
- "No-code database" (we're not Airtable/NocoDB)
- "Agent orchestrator" (we're not OpenAI Frontier)

We are the **data and rules layer** that sits between AI agents and business operations.

---

## Pricing Model

### Principles
- Must be cheaper than the sum of tools it replaces
- Simple to understand (no surprise bills)
- Aligned with value delivered (scales with usage)

### Proposed Structure

| Plan | Price | Includes |
|------|-------|---------|
| **Starter** | Free | 1 team, 3 members, 2 workspaces, 1,000 records, built-in Blueprints |
| **Team** | $12/member/month | Unlimited workspaces, 50,000 records, all Blueprints, custom roles, audit log, event subscriptions |
| **Business** | $30/member/month | Unlimited records, custom Blueprints, automations, file storage, priority support, SSO |
| **Enterprise** | Custom | Dedicated instance, data residency, SLA, custom compliance, onboarding, marketplace publishing |

### Why This Works
A team using HubSpot ($50/user/mo) + Jira ($8/user/mo) + Monday.com ($12/user/mo) + BambooHR ($8/user/mo) pays **~$78/user/month** for fragmented tools.

Our Business plan at $30/member/month replaces all of them **at 38% of the cost**, with better agent integration and unified data.

### Usage-Based Add-On (Optional)
- API calls beyond plan limit: $0.001 per call
- Storage beyond plan limit: $0.10 per GB/month
- This prevents abuse while keeping base pricing simple

---

## Launch Strategy

### Phase 0: Validate (Weeks 1-4)
- Build minimal MCP server + REST API with CRM Blueprint (Contacts + Deals)
- Core features: provenance tracking, event subscriptions, state machine constraints
- MCP Resources (schema/overview, instructions) for zero-onboarding agent connection
- MCP Prompts (build_blueprint, data_quality_check) for guided workflows
- Agent Kit for Claude Desktop + Claude Code (manual templates, validate concept)
- Audit log with agent reason tracking
- Test with 3-5 friendly companies (startup founders who use AI agents daily)
- Validate: Do agents connect? Is provenance useful? Do events work? Are Resources helpful? Does Agent Kit reduce setup friction?
- Deliverable: Working demo, user feedback, refined product spec

### Phase 1: Private Beta (Months 2-3)
- CRM + Project Management Blueprints (with seed data)
- Custom Blueprint creation (agent-designed schemas for any domain)
- Field suggestion system (agents propose, admins approve)
- Full permission system (6-layer hierarchy)
- Instruction engine + agent_hints on all fields
- Event subscription system
- All MCP Prompts (build_blueprint, investigate_record, onboard_member, data_quality_check, migrate_data)
- Agent Kit: all 5 formats (Claude Desktop, Claude Code, Cursor, ChatGPT, Raw), dashboard download, `get_agent_kit` MCP tool, REST endpoint
- 10-20 companies, by invitation
- Pricing: Free during beta
- Focus: reliability, schema flexibility, provenance utility, custom Blueprint quality

### Phase 2: Public Beta (Months 4-6)
- Add HR, Support, and Inventory Blueprints (with seed data)
- Three-layer schema inheritance (core → blueprint → workspace)
- Custom automation rules
- Graph traversal API
- File storage
- Dashboard generation (table + kanban views for human oversight)
- Agent Kit: staleness detection, team-level customization of behavioral rules and skills
- Self-service onboarding
- Pricing: Starter (free) + Team plan
- Focus: growth, onboarding friction, Blueprint quality, human oversight

### Phase 3: General Availability (Months 7-9)
- Full Blueprint library (Finance, ERP, etc.)
- Blueprint Marketplace (publish, discover, install, rate, review)
- Dashboard generation (chart + overview views, provenance drill-down)
- Enterprise features (SSO, data residency, dedicated instances)
- Python SDK + TypeScript SDK + framework integrations (LangChain, CrewAI)
- Business + Enterprise plans
- Focus: enterprise sales, marketplace growth, compliance certifications

---

## Target Customers

### Primary: AI-Native Startups (10-100 people)
- Already using AI agents extensively
- Willing to adopt new tools quickly
- Feel the pain of fragmented SaaS tools
- Cost-sensitive (every SaaS subscription hurts)
- Decision-maker is often the founder (fast sales cycle)

### Secondary: Innovation Teams at Mid-Market Companies (100-1000 people)
- Teams piloting AI agents within larger companies
- Need governed, secure agent collaboration
- Budget holders looking to consolidate tools
- Longer sales cycle but higher contract value

### Later: Enterprise (1000+ people)
- Requires SOC 2, ISO 27001, data residency
- Long sales cycle (6-18 months)
- High contract value
- Champion: CTO/CIO or VP of AI/Digital Transformation

---

## Differentiation Messaging

### vs. Salesforce / HubSpot / Jira
> "Those tools were built for humans clicking buttons. Your AI agent doesn't need a UI -- it needs data, rules, and permissions. That's what we provide, at a fraction of the cost."

### vs. OpenAI Frontier / Salesforce Agentforce
> "They manage your agents. We give your agents a shared brain. They sit on top of your existing tools. We replace them."

### vs. Airtable / Notion
> "They're databases with AI features added. We're an AI-native platform with a database inside. The difference: our MCP server gives every AI agent instant, governed access to your business data."

### vs. Building In-House
> "You could wire up a database, build an MCP server, implement permissions, create Blueprints, and maintain it all. Or you could be up and running in 5 minutes."

### vs. Manual MCP Configuration
> "Other MCP servers give you tools and hope the agent figures it out. We give you an Agent Kit -- a pre-configured package with identity, behavioral rules, skills, and connection config. Your agent knows how to connect, how to think about data, and what shortcuts exist before it ever touches the server."

---

## Key Metrics to Track

| Metric | What It Measures |
|--------|-----------------|
| **Teams created** | Top-of-funnel interest |
| **Agents connected per team** | Depth of adoption |
| **MCP + REST calls per day** | Active usage / stickiness |
| **Records created per team** | Data committed (switching cost) |
| **Blueprints deployed** | Time-to-value |
| **Custom Blueprints created** | Platform extensibility being realized |
| **Marketplace Blueprints published** | Ecosystem health / network effects |
| **Marketplace installs** | Community value being realized |
| **Event subscriptions active** | Autonomous agent behavior adoption |
| **Field suggestions (proposed / approved)** | Organic schema growth health |
| **Cross-workspace queries** | Unified data value being realized |
| **Avg confidence score** | Data quality (higher = agents producing reliable data) |
| **Dashboard views per week** | Human oversight engagement |
| **MCP Resource loads per session** | Zero-onboarding adoption signal |
| **Agent Kits downloaded** | Bootstrap adoption (how many agents are pre-configured) |
| **Agent Kit staleness rate** | % of active kits that are out of date (schema changed since last generation) |
| **Retention (30/60/90 day)** | Product-market fit signal |
