# DayDock

**Make room for what matters.**

DayDock is a calm, local-first workday command center for turning loose commitments into a deliberate daily rhythm:

**Capture → Decide → Focus → Follow up → Close the day**

It started as an employee-management React exercise and was rebuilt into a complete product and frontend-architecture case study.

## Product capabilities

- 60-second **Start Day** ritual with attention signals and a realistic focus-room estimate
- one-field Quick Capture with keyboard shortcut
- Inbox triage into Today, Done, or calm **Later** scheduling with automatic resurfacing
- Tomorrow / Next week / custom-date / Someday resurfacing
- Daily, Weekdays, Weekly, and Monthly recurring work without rewriting completion history
- protected **Top 3** daily priorities
- resilient Focus Mode with pause/resume and timestamp-derived timing
- People context with scheduled follow-ups and linked tasks
- command palette and local search with **Ctrl/Cmd + K**
- local read-only **Calendar Awareness** from standard `.ics` files with meeting constraints and derived focus windows
- Daily Review with completed work, unresolved work, and seven-day focus rhythm
- versioned local-first persistence and legacy migration
- validated cross-tab synchronization with BroadcastChannel
- portable JSON backup, validation preview, and explicit restore
- responsive mobile navigation
- reduced-motion and forced-colors support
- installable PWA shell with build-generated, versioned offline precache
- no account, analytics, ads, or cloud dependency

## Why DayDock is different

DayDock deliberately avoids turning productivity into a score.

There are no streaks, leaderboards, guilt states, or fake urgency. Unfinished work gets a new home. Review reports facts. Focus protects one task at a time.

The product also keeps private work data local to the browser by default.

## Stack

### Runtime

- React 19.3
- strict TypeScript 6
- Zod 4
- Vite 8.3
- semantic HTML
- modern CSS with OKLCH, container queries and progressive View Transitions
- Web Storage API
- BroadcastChannel
- native Dialog and Popover APIs
- Service Worker + Web App Manifest

### Verification

- Vitest
- Testing Library
- ESLint 10
- TypeScript compiler
- GitHub Actions

Runtime package dependencies are intentionally small: React, React DOM, and Zod.

## Architecture

```text
React feature surfaces
        |
        v
useSyncExternalStore
        |
        v
DayDock external store
        |
        +--> versioned persistence
        +--> BroadcastChannel sync
        +--> backup / restore
        +--> local calendar snapshot / focus windows
        |
        v
pure domain reducer
        |
        +--> task + resurface invariants
        +--> recurrence lifecycle
        +--> daily planning state
        +--> Top 3 limit
        +--> focus lifecycle
        +--> people relationships
        +--> derived selectors / insights
```

The reducer does not create ids, read the clock, access storage, or call browser APIs. Persisted and imported data is treated as untrusted input and validated before becoming application state.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [UX flow](./docs/UX_FLOW.md), and [Nordic Daylight design system](./docs/DESIGN_SYSTEM.md).

## Signature engineering decisions

### Attention dates are not deadlines

Later work can carry a `deferUntil` date that controls when it returns to Inbox. The UI calls this **Ready again**, never overdue. Recurrence has a separate anchor so snoozing one occurrence does not silently move the whole series.

Completing a recurring occurrence atomically records the old task as Done and creates a fresh future occurrence with a new id. Historical completion and focus records therefore remain truthful.

### Resilient focus timing

Focus time is derived from timestamps instead of decrementing canonical seconds. Background throttling, tab visibility changes, and reloads therefore do not silently corrupt the timer.

### One canonical workspace

Tasks, people, focus history, and navigation views do not maintain competing copies of business state. UI surfaces derive what they need from the canonical workspace.

### Local-first without pretending localStorage is enough

DayDock adds schema migrations, normalization, cross-tab ordering, portable backup, import validation, and explicit recovery UX around browser persistence.

### Modern React with a reason

React 19.3 Activity preserves useful local UI state across surfaces. View Transitions communicate spatial continuity. `startTransition` keeps navigation work non-urgent. These primitives are progressive UX enhancements rather than business-state dependencies.

## Brand system — Nordic Daylight

DayDock uses a warm daylight palette, Nordic blue, restrained apricot and leaf-green signals, generous whitespace, and a custom dock/sun mark.

The visual rule is simple: **hierarchy over decoration**. Motion communicates continuity; it does not compete for attention.

## Run locally

```bash
npm ci
npm run dev
```

Run the complete quality gate:

```bash
npm run check
```

## Recruiter walkthrough

For a fast technical review:

1. `src/domain/daydock/reducer.ts` — deterministic business transitions and invariants
2. `src/domain/daydock/scheduling.ts` — calendar-safe resurface and recurrence arithmetic
3. `src/storage/dayDockPersistence.ts` — versioned persistence and validation
4. `src/store/synchronizedDayDockStore.ts` — cross-tab ordering and failure isolation
5. `src/features/focus/FocusMode.tsx` — signature focus workflow
6. `src/features/review/ReviewSurface.tsx` — derived closure and insight UX
7. `src/features/data-safety/DataSafetyPopover.tsx` — backup/recovery product boundary
8. `src/App.test.tsx` — end-to-end component journeys
9. `scripts/finalize-service-worker.mjs` — build-derived offline shell manifest
10. `.github/workflows/quality.yml` — automated quality gate
11. `.github/workflows/visual-smoke.yml` — desktop/mobile, mature-state, focus and offline release evidence
12. `.github/workflows/pages.yml` — release deployment gate

## Privacy

DayDock does not require an account and does not send workspace data to an application backend. Backup export is generated client-side. Imported backup data is validated before the user can replace the current workspace.
