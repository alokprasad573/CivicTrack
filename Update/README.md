# CivicTrack Modernization Workspace

This directory contains the project-specific modernization plan and Antigravity operating prompts.

| File | Purpose |
|---|---|
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Phased roadmap, constraints, acceptance criteria and deliverables |
| [AGENT_WORKING.md](./AGENT_WORKING.md) | Agent responsibilities, repository ownership, execution order and collaboration rules |
| [MASTER_PROMPT.md](./MASTER_PROMPT.md) | Primary Antigravity prompt for orchestration, audit, planning and approved execution |

Agent instructions and skills live under [../.agents](../.agents):
- [AGENTS.md](../.agents/AGENTS.md) — repository-wide hard constraints.
- [AGENT_HIERARCHY.md](../.agents/AGENT_HIERARCHY.md) — required agent hierarchy and ownership matrix.
- [agents/](../.agents/agents/) — individual agent definitions.
- [skills/](../.agents/skills/) — nine specialized project skills.

## Recommended operation

1. Open the repository in Antigravity.
2. Ensure its agent/skill discovery supports the repository conventions in use.
3. Load `Update/MASTER_PROMPT.md`.
4. Run the read-only audit and architecture guardrail phases.
5. Review and approve `Update/IMPLEMENTATION_PLAN.md` before source implementation.
6. Execute approved phases and keep `docs/IMPLEMENTATION_PROGRESS.md` current.
7. Require QA and independent review before considering production readiness.

The plan does not authorize automatic merging or deployment.
