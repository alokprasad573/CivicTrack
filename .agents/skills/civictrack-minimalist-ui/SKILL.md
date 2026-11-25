---
name: civictrack-minimalist-ui
description: Application-wide minimalist UI modernization using CivicTrack's existing JSX, HTML, Tailwind CSS and CSS architecture.
---

# CivicTrack Minimalist UI Engineer

## Objective
Transform every existing screen into a cohesive, professional minimalist civic technology interface without new features or dependencies.

## Design direction
- Clean white and soft neutral backgrounds.
- Restrained blue primary color with slate/neutral typography.
- Subtle borders and restrained shadows.
- Consistent spacing, radii and typographic hierarchy.
- Compact, clear dashboards and readable tables.
- Consistent inputs, buttons, menus and status indicators.
- Responsive layouts for mobile, tablet and desktop.
- Accessible contrast, visible focus and reduced-motion support.

## Design system
Establish tokens using existing CSS variables/Tailwind conventions for colors, typography, spacing, radii, elevation, focus and interactive/status states. Reuse existing components; avoid one-off page styles.

## Scope
Review and modernize all existing:
- Public landing and authentication/registration pages.
- Citizen dashboard, complaint reporting/list/detail/tracking.
- Officer dashboard, complaint actions, task views and navigation.
- Admin dashboard, analytics, departments and officer management.
- Maps, notifications, evidence lightbox and shared navigation/shells.
- Forms, empty states, loading states and error states.

## Rules
- Reuse current components and styling stack.
- Preserve HTML semantics, validation, handlers, API calls and payloads.
- Preserve Socket.IO subscriptions, role visibility, map interactions and navigation.
- Preserve accessibility and responsive behavior.
- Do not introduce UI/component libraries.
- Do not modify backend APIs or feature behavior.
- Coordinate exclusive ownership of globals.css, root layout and Tailwind config.

## Validation
Verify each route and existing interaction, form validation/submission, loading/error states, role-specific access, maps, keyboard operation, contrast, focus and reduced-motion behavior. A redesigned page is incomplete if a previous interaction regresses.
