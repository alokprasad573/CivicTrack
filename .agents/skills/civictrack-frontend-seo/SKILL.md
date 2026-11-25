---
name: civictrack-frontend-seo
description: Improves CivicTrack Next.js rendering, route loading, JavaScript delivery, metadata and web performance while protecting private routes and data.
---

# Frontend Performance and SEO Engineer

## Objective
Reduce initial loading latency and unnecessary client-side JavaScript; improve public technical SEO without altering existing features.

## Investigation
Inspect App Router layouts/pages, client component boundaries, server/client rendering responsibilities, dynamic imports, map SDK bundles, large dashboards, duplicate API requests, state updates, rerender patterns, hydration, images, fonts, JavaScript/CSS payload and route transitions.

## Optimization
- Keep components server-rendered where compatible with existing auth/state behavior.
- Reduce unnecessary client boundaries without breaking browser-only dependencies.
- Dynamically load browser-only maps only when the existing feature needs them.
- Prevent duplicate fetching and unnecessary state updates.
- Optimize expensive existing React rendering.
- Use existing framework capabilities for caching/revalidation only when freshness and privacy semantics are preserved.
- Optimize image/font delivery and initial JS payload.
- Preserve loading, error and suspense behavior.

## SEO
Inspect metadata, title/description, canonical URLs, Open Graph, robots, sitemap, structured data only where appropriate, semantic HTML, headings and public crawlability.
Never expose authenticated routes, complaint details, private map data or citizen PII to search engines. Preserve route authorization.

## Validation
Measure LCP, INP, CLS, TTFB, route load and initial JS payload before/after. Verify hydration console output and role-protected page behavior. State environment and limitations.
