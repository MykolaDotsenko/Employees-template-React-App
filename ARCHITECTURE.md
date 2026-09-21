# DayDock architecture

DayDock is a local-first workday application built around one canonical workspace state, a deterministic domain core, explicit browser-platform boundaries, and release-time verification of the production artifact.

The architecture is intentionally small. DayDock does not use a backend, state-management framework, CRDT, service-worker framework, calendar SDK, or analytics layer. Each dependency or browser primitive has a narrow responsibility.

## System overview

```text
┌──────────────────────────────────────────────────────────────┐
│ React feature surfaces                                     │
│ Today · Inbox · People · Review · Focus · Data safety       │
└───────────────────────┬──────────────────────────────────────┘
                        │ useSyncExternalStore
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ DayDock external store                                     │
│ dispatch · replaceState · subscribe · getSnapshot           │
└──────────────┬──────────────┬───────────────┬────────────────┘
               │              │               │
               │              │               └── backup / restore
               │              └── BroadcastChannel transport
               └── versioned localStorage persistence
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Deterministic domain reducer                               │
│ tasks · recurrence · resurfacing · Top 3 · focus · people   │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Derived selectors and adapters                             │
│ review insights · calendar awareness · notification status  │
└──────────────────────────────────────────────────────────────┘
```

The core rule is simple: **business state has one owner**. Views derive what they need instead of maintaining competing copies.

## Architectural boundaries

### Domain

The domain layer owns rules that should remain valid regardless of React, browser APIs, storage, or deployment environment.

Examples:

- task lifecycle
- Later / Ready again resurfacing
- recurrence
- Top 3 constraints
- current-work selection
- focus lifecycle
- person relationships
- review data derivation

The reducer does not:

- create ids
- read the clock
- access localStorage
- access BroadcastChannel
- send notifications
- parse calendar files
- call React APIs

Commands carry ids, dates, and timestamps into the reducer. This keeps transitions deterministic and makes invariants directly testable.

### Application store

React consumes the workspace through `useSyncExternalStore`.

The store is intentionally thin:

```text
dispatch(action)
   ↓
pure reducer
   ↓
next canonical snapshot
   ↓
subscribers
   ├── React
   ├── persistence
   └── cross-tab transport
```

There is no second UI-specific business-state graph.

### Platform adapters

Browser capabilities sit outside the domain:

- localStorage for durable local persistence
- BroadcastChannel for same-browser live synchronization
- Service Worker for offline shell delivery
- Notification API for optional Ready again alerts
- File / Blob APIs for backup export
- File input for restore and calendar import
- native Dialog / Popover primitives for interaction surfaces

If one of these capabilities is unavailable, the domain model remains valid.

## Canonical workspace

The canonical `DayDockState` contains:

- tasks and task ordering
- Top 3 ids
- people and person ordering
- active focus session and focus history
- current day plan
- normalized calendar snapshot
- notification preference state
- configurable workday window

Relational references are normalized after validation. Broken person references are removed, invalid Top 3 entries are discarded, orders are deduplicated, and focus sessions that no longer point to valid Today work are rejected.

This means structurally valid JSON is not automatically trusted as semantically valid state.

## Persistence and schema evolution

Browser persistence uses a versioned envelope:

```text
{
  schemaVersion: 7,
  updatedAt: ISO date-time,
  data: DayDockState
}
```

Load path:

```text
localStorage bytes
      ↓
JSON parse
      ↓
versioned envelope validation
      ↓
current schema ───────────────→ normalize
      │
      └── older schema → migrate → normalize
      ↓
canonical DayDockState
```

Important properties:

- persisted input is treated as untrusted
- unknown future schemas fail safe
- older supported schemas are upgraded explicitly
- relational normalization runs after structural validation
- successful migrations are persisted back in the current format
- corrupt storage recovers to a valid empty workspace instead of crashing the app

Persistence remains outside the reducer so loading, migration, and storage failure cannot change domain semantics.

## Cross-tab synchronization

DayDock uses `BroadcastChannel` as a live transport and localStorage as durable local persistence.

```text
local action
   ↓
pure reducer
   ↓
canonical snapshot
   ├── persist locally
   └── broadcast revisioned snapshot
                        ↓
                  another tab
                        ↓
                    validate
                        ↓
                 compare revision
                        ↓
                   replace state
                        ↓
                  persist locally
```

### Ordering model

Synchronization is deliberately **last-write-wins at complete-workspace snapshot level**.

Each message carries:

- source id
- monotonic revision timestamp
- source id tie-breaker
- candidate state

A local mutation always advances beyond the latest revision observed by that tab, even when the wall clock does not advance.

Incoming state must pass the same validation and normalization boundary used by persistence.

Remote application suppresses rebroadcast, which prevents echo loops.

### Why this is not a CRDT

DayDock targets one person using a small number of tabs on one browser profile. Concurrent editing across distributed devices is not a product requirement.

A CRDT would add substantial data-model, migration, and debugging complexity without solving a current user problem.

The trade-off is explicit: two genuinely concurrent tab edits can cause the later complete snapshot to replace the earlier one.

## Scheduling and Ready again

A Later task may carry an attention date:

```text
deferUntil: YYYY-MM-DD | null
```

This is not a deadline. DayDock deliberately calls it **Ready again**.

When the relevant local calendar date is reached, the app dispatches a deterministic resurface action. No background timer or server scheduler is required.

```text
Later
  │
  ├── Tomorrow
  ├── Next week
  ├── custom date
  └── Someday
        │
        ▼
local calendar day changes
        │
        ▼
task/resurfaceDue(dateKey)
        │
        ▼
Inbox
```

The app checks this at boot and when the local calendar day changes.

## Recurrence

Recurrence is distinct from resurfacing.

A recurring task stores a recurrence anchor so postponing one occurrence does not silently shift the entire cadence.

Completing a recurring task is atomic from the reducer's perspective:

```text
current occurrence
      │
      ├── mark Done
      └── create future occurrence with a new id
```

The caller creates the new id and timestamps before dispatch because the reducer remains deterministic.

The completed occurrence stays in history. Focus records therefore continue to refer to the task that actually existed at the time.

## Focus timing

The active focus session stores timestamps, not a canonical decrementing second counter.

Remaining time is derived from:

- start timestamp
- optional pause timestamp
- accumulated paused duration
- configured focus duration

This avoids a common timer defect where background-tab throttling causes logical time to drift away from real elapsed time.

The UI may update frequently for presentation, but presentation ticks never become the source of truth.

## Top 3 and Now

Today and Top 3 intentionally mean different things.

- **Today**: work intentionally available today
- **Top 3**: protected outcomes for the day
- **Now**: the current Top 3 outcome

Promoting a new current outcome changes prioritization without duplicating, recreating, or reordering unrelated work.

The reducer enforces the Top 3 cap so UI bugs cannot create an invalid fourth protected outcome.

## People boundary

People are lightweight context, not a CRM subsystem.

A person can carry:

- name
- context
- next follow-up date
- linked tasks

Tasks own the optional `personId` relationship.

Deleting a person removes the relationship from linked tasks rather than deleting the tasks themselves.

This keeps task ownership and people context separate.

## Calendar awareness

Calendar data is an input adapter, not a second planning system.

Standard `.ics` input is parsed into bounded normalized busy events:

```text
.ics text
   ↓
parser
   ↓
timezone / recurrence handling
   ↓
normalized CalendarBusyEvent[]
   ↓
calendar awareness
   ├── timed events
   ├── all-day events
   ├── merged busy windows
   └── candidate focus windows
```

React components do not parse iCalendar syntax.

Availability is derived from:

- configured workday
- current local time
- timed busy events
- small meeting buffers
- minimum useful focus-window length

An imported calendar is explicitly a **snapshot**. DayDock does not imply live synchronization.

A future Google Calendar or Microsoft Graph adapter could produce the same normalized busy-event representation without changing the Today domain or presentation contract.

## Backup and recovery

Local durability and portability are different problems.

DayDock therefore defines a separate backup envelope rather than exposing raw localStorage bytes.

```text
canonical state
     ↓
normalize
     ↓
portable backup envelope
     ↓
client-side JSON download
```

Restore path:

```text
JSON file
   ↓
size guard
   ↓
backup-envelope validation
   ↓
application-state validation
   ↓
normalization
   ↓
preview counts
   ↓
explicit user confirmation
   ↓
store.replaceState
   ├── persistence
   └── cross-tab synchronization
```

Import never mutates the current workspace before the full candidate validates.

### Structural Undo

Task and person removal use compensating domain actions.

Undo restores the removed entity and its necessary relationships. It does **not** restore an old whole-workspace snapshot.

That distinction matters: a whole-state rollback could accidentally erase legitimate edits made after the deletion.

## Notification boundary

The stored Ready again preference and the browser's current notification permission are not treated as the same fact.

A restored backup can say the user prefers alerts while the current browser still has permission denied or unset.

The UI surfaces that mismatch and requires a fresh explicit permission action.

This avoids falsely presenting notification delivery as active.

## Offline and PWA boundary

DayDock ships an installable web-app shell.

The production build:

1. emits hashed JS/CSS assets
2. finalizes the service-worker precache from the actual build output
3. scopes URLs to the deployment base
4. verifies GitHub Pages asset paths before release

The service worker is deliberately small. It exists to keep the application shell available offline; it is not used as a hidden business-logic scheduler.

The release smoke suite warms a real production profile, confirms a controlling service worker, disables the network, reloads, and verifies that the shell still renders.

## React and presentation

React is responsible for presentation and interaction orchestration, not business truth.

Current patterns include:

- `useSyncExternalStore` for canonical state subscription
- native Dialog and Popover primitives
- `startTransition` for non-urgent surface changes
- progressive View Transitions
- semantic landmarks and accessible names
- reduced-motion support
- forced-colors support
- explicit mobile layouts instead of desktop-only shrinking

Modern browser capabilities are treated as progressive enhancement where possible.

## Release architecture

DayDock treats the built artifact as something that must be verified, not merely emitted.

```text
PR / main
   │
   ├── lint
   ├── TypeScript
   ├── unit + component tests
   ├── production build
   ├── GitHub Pages artifact verification
   └── Playwright release smoke
            ├── desktop
            ├── mobile
            ├── focus
            ├── critical dialogs / Undo
            ├── notification mismatch
            └── real offline reopen
```

The Pages verifier rejects:

- absolute asset URLs outside `/daydock/`
- emitted JS/CSS references that do not exist in `dist`
- any surviving legacy repository path

Visual smoke uses real browser interaction and explicit readiness assertions rather than fixed screenshot delays.

## Failure model

DayDock favors understandable degraded modes.

| Failure | Expected behavior |
| --- | --- |
| corrupt persisted JSON | recover to a valid workspace |
| unsupported future schema | fail safe rather than downgrade |
| localStorage write failure | live app continues with degraded persistence status |
| BroadcastChannel unavailable | local persistence still works |
| invalid backup | reject before replacement |
| invalid calendar entries | ignore/reject invalid input and preserve valid state |
| notification permission absent | show preference/permission mismatch |
| network unavailable after warm install | service-worker shell reopens |
| Pages path regression | build gate fails before deployment |

## Deliberate trade-offs and non-goals

### No cloud account

DayDock does not currently solve multi-device synchronization, collaboration, server backup, or organization administration.

That keeps the privacy and failure model simple, but browser-profile loss still requires a user-exported backup for recovery.

### Snapshot-level tab synchronization

Cross-tab state is not field-merged. This is appropriate for the current single-user scope but would need redesign for collaborative editing.

### Calendar snapshot, not live provider integration

No OAuth token, remote calendar account, or provider-specific state enters the product today.

### Browser notifications are best-effort

The application does not claim guaranteed background delivery across every mobile/browser installation mode.

### No productivity scoring

Focus history and review are descriptive. DayDock intentionally avoids turning completion counts or focus minutes into a score, streak, ranking, or guilt signal.

## Dependency philosophy

Runtime dependencies are intentionally limited to:

- React
- React DOM
- Zod

Browser APIs are preferred when they provide a sufficiently stable and accessible primitive.

New runtime dependencies should earn their cost through a product or reliability capability that would otherwise be substantially harder to implement or maintain.

## Migration history

DayDock originated from an earlier React exercise and was rebuilt incrementally rather than rewritten in one opaque replacement.

The important architectural milestones were:

1. isolate legacy behavior
2. introduce a deterministic DayDock domain
3. add versioned persistence and migration
4. move feature surfaces onto the canonical store
5. add resurfacing, recurrence, focus, people, and review
6. harden local-first sync and backup
7. add calendar awareness and PWA/offline behavior
8. add release-grade artifact and browser verification

The current architecture described above is the source of truth. Historical PR boundaries are implementation history, not runtime architecture.
