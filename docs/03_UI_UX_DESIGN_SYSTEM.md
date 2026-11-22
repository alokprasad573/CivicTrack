# CivicTrack — Premium UI/UX Design System

**Design direction:** Premium civic-tech, dark graphite, black, slate, and restrained teal/cyan accents.  
**Explicit exclusion:** No purple or violet palette.  
**Product feel:** Trustworthy, modern, calm, operationally clear, map-centric.

## 1. Visual direction

Create a premium civic-tech product, not a generic admin template and not a government-portal clone.

Visual qualities:
- Deep charcoal and near-black surfaces.
- Neutral graphite borders and elevated panels.
- Restrained teal/cyan as the primary action accent.
- Warm amber for pending/attention states.
- Green for resolved/success.
- Red only for destructive/error states.
- Strong typography hierarchy and generous spacing.
- Subtle shadows and restrained blur; avoid excessive glassmorphism.
- Clear map-first reporting experience.
- Dense data tables that remain readable.

Do not use:
- Purple, violet, lavender, magenta, or indigo as brand accents.
- Neon gradients.
- Excessive glowing borders.
- Huge rounded cards everywhere.
- Emoji as interface icons.
- Random decorative charts with fabricated data.
- Tiny low-contrast text.

## 2. Color tokens

Use CSS variables and semantic tokens. Suggested dark theme:

```css
:root {
  --background: 220 18% 7%;       /* near-black */
  --foreground: 210 20% 96%;
  --card: 220 16% 10%;
  --card-foreground: 210 20% 96%;
  --popover: 220 16% 10%;
  --popover-foreground: 210 20% 96%;
  --primary: 174 72% 42%;         /* restrained teal */
  --primary-foreground: 220 25% 8%;
  --secondary: 218 14% 16%;
  --secondary-foreground: 210 18% 92%;
  --muted: 218 14% 14%;
  --muted-foreground: 215 12% 65%;
  --accent: 190 75% 42%;          /* cyan-teal */
  --accent-foreground: 220 25% 8%;
  --destructive: 0 68% 52%;
  --border: 216 14% 20%;
  --input: 216 14% 20%;
  --ring: 174 72% 42%;
}
```

Status colors must be semantic and consistent:
- Submitted: neutral slate
- Under review: amber
- Verified: cyan/teal
- Assigned: blue
- In progress: orange
- Resolved: green
- Closed: muted green/neutral
- Rejected: red

Do not rely on color alone; always include text labels and optionally icons.

## 3. Typography

Use a modern sans-serif such as Geist or Inter.
- Page title: 28–32px desktop, 24px mobile, semibold.
- Section title: 16–20px, semibold.
- Body: 14–16px.
- Table/meta: 12–14px with sufficient contrast.
- Numeric KPI: 28–36px, semibold.
Use tabular numerals for metrics and timestamps where practical.

## 4. Layout principles

- Desktop dashboard: fixed/collapsible left navigation, top bar, content canvas.
- Mobile: compact header and bottom navigation or accessible drawer.
- Main content max width should support tables and maps without excessive line length.
- Use consistent spacing scale (4/8px base).
- Cards should group related information, not wrap every individual text item.
- Prefer clear page sections and aligned grids.
- Provide breadcrumbs on deep admin/officer pages.
- Keep primary action visible and unambiguous.

## 5. Core navigation

### Public
- Home
- How it works
- Report an issue
- Sign in
- Create account

### Citizen
- Overview
- Report an issue
- My complaints
- Nearby issues
- Notifications
- Profile

### Admin
- Overview
- Complaints
- Map view
- Departments
- Officers
- Analytics
- Escalations
- Audit log
- Settings

### Officer
- My work
- Map
- Due soon
- Resolved
- Profile

Navigation must be role-aware and server authorization must still protect every route/API.

## 6. Required screens and UX details

### Landing page
- Premium hero with clear product value proposition.
- Primary CTA: “Report an issue”.
- Secondary CTA: “Track a complaint”.
- Short “How it works” section.
- Issue categories.
- Public impact metrics only when backed by real data; use clearly marked demo data in demo mode.
- Responsive layout and accessible footer.

### Authentication
- Use Clerk's sign-in/sign-up components or supported custom flows, styled to match the CivicTrack design system.
- Keep Clerk's session and identity lifecycle; do not build custom password forms or password visibility controls unless the selected Clerk component explicitly supports that customization.
- Explain why location permission is requested only at the point of use.
- Never show demo credentials in production.

### Citizen dashboard
- Welcome and quick “Report an issue” action.
- KPI row: total, in progress, resolved.
- Recent complaints list with reference number, category, date, status.
- Compact map preview of nearby/public issues.
- Recent notifications.
- Useful empty state for a new user.

### Report complaint flow
Use a clear multi-step or well-grouped form:
1. Issue details: title, category, description.
2. Location: Ola map, locate-me action, draggable/selectable marker, manual address fallback.
3. Evidence: drag/drop or file picker, preview, remove, upload progress.
4. Review: summary and explicit submit action.

Show location accuracy/permission errors clearly. Never block manual pin selection if geolocation is unavailable. Prevent duplicate submits while request is pending.

### Complaint details
- Reference number and current status.
- Clear vertical timeline of status changes.
- Location map and address.
- Evidence gallery with secure image access.
- Assignment/department details only when appropriate for the viewer.
- Remarks and resolution evidence.
- Citizen feedback action after resolution.
- Show rejection reason when rejected.

### Admin dashboard
- KPI cards with date filter.
- Trend chart.
- Category distribution chart.
- Department performance table.
- Recent complaints queue.
- Overdue/SLA panel.
- Map/heatmap section.
Charts must have loading, empty, and error states and should use real API response data.

### Complaint management
- Search by reference/title.
- Filters: status, category, priority, department, date.
- Server-side pagination and sorting.
- Table rows with status badge and clear actions.
- Detail drawer/page for review.
- Verification/rejection dialogs with reason.
- Assignment dialog with department/officer selection.
- Confirmation for destructive/reject actions.

### Officer dashboard
- Assigned complaint count.
- Work queue grouped by priority/due date.
- Complaint details with location/evidence.
- Progress update form.
- Resolution evidence upload.
- Clear SLA/due-date indicator.

### Analytics
- Date range and department filters.
- Complaint trends.
- Category distribution.
- Resolution-time distribution.
- Department comparison.
- Geographic density view.
- Export only if implemented securely and correctly.

## 7. Component library

Use shadcn/ui for:
- Button, Input, Textarea, Select, Checkbox, Switch
- Dialog, AlertDialog, Sheet, Drawer
- DropdownMenu, Popover, Calendar
- Tabs, Table, Badge, Tooltip
- Skeleton, Sonner/Toast, Form
- Card, Separator, Breadcrumb
- Chart components

Use Recharts through shadcn chart wrappers. Keep chart colors mapped to semantic tokens; do not use purple.

## 8. Interaction states

Every data-driven screen must support:
- Loading skeleton
- Empty state with useful next action
- Error state with retry where safe
- Success feedback
- Disabled/pending state
- Permission-denied state where relevant

Forms:
- Inline validation.
- Clear required/optional labels.
- Preserve safe user input after recoverable errors.
- Prevent accidental duplicate submissions.
- Use accessible focus management in dialogs.

## 9. Accessibility and responsive behavior

- Keyboard navigable controls.
- Visible focus ring.
- Semantic headings and landmarks.
- Form labels and descriptive errors.
- WCAG AA contrast target.
- Do not rely on color alone.
- Respect reduced-motion preference.
- Mobile layouts must support complaint submission without horizontal scrolling.
- Maps need a non-map fallback (address/coordinates) for users unable to use the map.

## 10. Motion

Use restrained motion:
- 150–220ms transitions.
- Subtle hover/press feedback.
- Skeleton shimmer only if it does not distract.
- Avoid parallax, constant pulsing, and animated backgrounds.
- Respect `prefers-reduced-motion`.

## 11. Design acceptance checklist

- No purple/violet/indigo brand colors.
- Black/graphite surfaces with restrained teal/cyan accent.
- Consistent typography, spacing, radii, and shadows.
- Citizen, admin, and officer experiences are visually related but role-appropriate.
- Mobile and desktop layouts both polished.
- All forms, tables, maps, and charts have realistic interaction states.
- Charts use real API data or explicitly labelled demo fixtures.
- No broken map placeholders or fake live indicators.


## 12. Clerk UI integration

- Use Clerk's official Next.js SDK and components for sign-in, sign-up, user profile, and session state.
- Theme Clerk components to match the graphite/teal design tokens; avoid introducing purple/violet Clerk defaults.
- Do not duplicate Clerk's authentication forms or session state in custom application code.
- After authentication, load the CivicTrack profile from the API. The local profile determines the app role and permitted navigation.
- Show a pending/provisioning state if the Clerk identity exists but the local CivicTrack user record has not yet synchronized.
- Do not offer role selection on public sign-up.
