# CivicTrack — Monorepo Project Structure

**Architecture:** TypeScript monorepo; modular monolith; Next.js web app + Express API.  
**Package manager:** pnpm workspaces; one root lockfile.

```text
civictrack/
├── apps/
│   ├── web/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (public)/
│   │   │   │   ├── (auth)/              # Clerk sign-in / sign-up
│   │   │   │   ├── citizen/
│   │   │   │   ├── admin/
│   │   │   │   ├── officer/
│   │   │   │   ├── layout.tsx
│   │   │   │   └── globals.css
│   │   │   ├── components/{ui,layout,maps,charts,feedback}/
│   │   │   ├── features/{complaints,assignments,departments,notifications,analytics}/
│   │   │   ├── hooks/
│   │   │   ├── lib/{api-client.ts,clerk.ts,permissions.ts,env.ts}
│   │   │   └── types/
│   │   ├── .env.example
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── server/
│       ├── src/
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── config/{env.ts,database.ts,aws.ts,clerk.ts,logger.ts}
│       │   ├── common/{errors,middleware,types,utils}/
│       │   ├── modules/
│       │   │   ├── identity/            # Clerk verification + webhook sync
│       │   │   ├── users/
│       │   │   ├── departments/
│       │   │   ├── complaints/
│       │   │   ├── assignments/
│       │   │   ├── workflow/
│       │   │   ├── storage/             # Private S3 + signed URLs
│       │   │   ├── maps/                # Ola Maps adapter
│       │   │   ├── notifications/
│       │   │   ├── duplicate-detection/
│       │   │   ├── analytics/
│       │   │   ├── sla/
│       │   │   └── audit/
│       │   ├── jobs/
│       │   ├── sockets/
│       │   └── tests/
│       ├── .env.example
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── contracts/                       # Shared Zod schemas / DTOs
│   ├── config/                           # Shared TS/lint/format config
│   └── types/                            # Runtime-safe shared types only
├── docs/
│   ├── 01_PRD_Product_Requirements.md
│   ├── 02_SYSTEM_ARCHITECTURE.md
│   ├── 03_UI_UX_DESIGN_SYSTEM.md
│   ├── 04_ANTIGRAVITY_MASTER_PROMPT.md
│   ├── 05_PROJECT_STRUCTURE.md
│   └── 06_ENVIRONMENT_SETUP.md
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

Each API domain module owns routes, controller, service, repository/model, Zod schemas, and tests as needed. Do not create empty boilerplate for every file in advance. Keep controllers thin; business rules belong in services/domain logic.

`apps/web` and `apps/server` are separately deployable. Shared packages may contain contracts and browser-safe types only; never put database models, AWS clients, secrets, or server-only code in shared packages. Use strict TypeScript, ESM consistently, and avoid circular imports.
