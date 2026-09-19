# DayDock

> **Migration in progress:** this repository is being rebuilt from an early employee-management React exercise into **DayDock**, a local-first workday command center.

## Current milestone — PR1 foundation

This branch deliberately preserves the original employee workflow while replacing the obsolete toolchain and fragile state handling underneath it.

### What PR1 establishes

- React 19.3
- Vite 8.3
- strict TypeScript
- function components
- defensive legacy localStorage migration
- collision-safe generated ids
- accessible native controls
- Vitest + Testing Library characterization coverage
- ESLint 10 quality gate
- GitHub Actions CI
- responsive migration-bridge shell

The product redesign starts only after this baseline is green, so every later DayDock PR has a reliable regression boundary.

## Planned product direction

DayDock is designed around a small daily loop:

**Capture → Decide → Focus → Follow up → Close the day**

The final product will be local-first, light-themed, mobile-first, installable, keyboard-friendly, accessible, and intentionally free of accounts, analytics, and tracking.

## Development

```bash
npm install
npm run dev
```

Run the complete local gate:

```bash
npm run check
```

## Roadmap

1. modern foundation and legacy characterization
2. DayDock domain model and reducer
3. versioned local-first persistence and migrations
4. Nordic Daylight design system and responsive app shell
5. Today + Top 3 + Inbox
6. Focus mode and resilient timer
7. People + follow-ups
8. command palette and global search
9. review, insights, backup and cross-tab sync
10. PWA, accessibility, E2E, GitHub Pages deployment

## Why the rebuild is incremental

The old application mixed product state, persistence, filtering and rendering inside class components. Replacing everything in one commit would make regressions difficult to isolate. The rebuild therefore uses small, reviewable PRs with a green quality gate between architectural steps.
