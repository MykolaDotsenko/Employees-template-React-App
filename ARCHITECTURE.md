# DayDock architecture

## PR1: migration boundary

PR1 modernizes the legacy app without mixing infrastructure changes with the product redesign.

```text
React UI
   |
   +--> employee domain helpers
   |
   +--> legacy storage adapter
```

## PR2: deterministic domain core

PR2 introduces the browser-independent DayDock model before the new UI consumes it.

```text
React feature surfaces
        |
        v
useSyncExternalStore
        |
        v
DayDock external store
        |
        v
pure domain reducer
        |
        +--> task invariants
        +--> Top 3 limit
        +--> people relationships
        +--> derived selectors
```

The reducer does **not** create ids, read the clock, access storage, or call browser APIs. Commands carry those values into the reducer so state transitions stay deterministic and easy to verify.

## PR3: local-first persistence boundary

The browser store is hydrated through a versioned persistence adapter.

```text
browser localStorage
        |
        v
versioned envelope
        |
        v
Zod validation
        |
        +--> current schema v3 → normalize
        +--> v0/v1/v2 → migrate → write v3
        +--> corrupt/future → safe recovery
        |
        v
DayDock external store
        |
        v
pure reducer
```

Persistence is deliberately outside the reducer. Stored data is untrusted input and must pass schema validation before it becomes application state.

### Current storage contract

```text
{
  schemaVersion: 3,
  updatedAt: ISO date-time,
  data: DayDockState
}
```

Relational normalization repairs ordering and removes broken references after structural validation. Unknown future schemas fail safe rather than being silently downgraded.

## Target local-first boundary

```text
React feature surfaces
        |
        v
DayDock application actions
        |
        v
browser-independent domain reducer
        |
        +--> derived selectors
        |
        v
external local-first store
        |
        +--> versioned persistence
        +--> migrations
        +--> BroadcastChannel
        +--> backup / restore
```

### Principles

1. One canonical state; views derive data rather than duplicate it.
2. Domain behavior stays independent from React and browser APIs.
3. Persistence is validated and migrated at the boundary.
4. Modern browser primitives are preferred over unnecessary dependencies.
5. Accessibility and keyboard interaction are part of component contracts.
6. Motion is progressive enhancement and respects reduced-motion preferences.
7. Mobile behavior is designed explicitly rather than produced by shrinking desktop UI.
8. Domain commands are deterministic: ids and timestamps are created outside the reducer.
9. Unknown persisted schemas fail safe rather than being silently downgraded.


## Resurface and recurrence boundary

Scheduling remains part of the deterministic domain rather than a timer running in
the background.

```text
Later task
    |
    +--> deferUntil: YYYY-MM-DD | null
    +--> recurrence: { kind, anchorDate } | null
    |
calendar day becomes relevant
    |
task/resurfaceDue(dateKey)
    |
    v
Inbox → "Ready again"
```

A return date is an **attention date**, not a deadline. No background service is
required: the application dispatches the deterministic resurface command when it
opens and when the local calendar day changes.

Recurring completion is atomic. The caller generates the next id/timestamp/date
outside the reducer, then the reducer marks the current occurrence Done and inserts
the future occurrence in one transition. Snooze dates are separate from recurrence
anchors so moving one occurrence does not accidentally move the whole cadence.

## Cross-tab local-first synchronization

DayDock keeps `localStorage` as the durable local source of truth and uses
`BroadcastChannel` only as a live transport between open tabs.

```text
local action
    |
    v
pure reducer
    |
    v
external store
    |
    +--> persist normalized v3 workspace to localStorage
    |
    +--> revisioned BroadcastChannel snapshot
              |
              v
        another open tab
              |
        validate with Zod
              |
        compare revision
              |
        replace store snapshot
              |
        persist locally
        (no rebroadcast echo)
```

### Ordering and safety

- Each tab has a unique source id.
- Revisions order first by timestamp and then by source id for deterministic
  ties.
- A local mutation always advances beyond the latest revision observed by that
  tab, even if the clock does not move.
- Incoming snapshots are treated as untrusted data and must pass the same Zod
  validation and relational normalization used by persistence.
- Applying a remote snapshot suppresses rebroadcast, preventing echo loops.
- If `BroadcastChannel` is unavailable or live transport fails,
  `localStorage` persistence continues to work independently.

The sync layer intentionally does not introduce polling, a server, or a second
canonical state.


## Portable backup and recovery

Durable browser persistence is not the same thing as portability. DayDock therefore
has a separate backup boundary instead of exposing raw localStorage bytes.

```text
workspace state
    |
normalize
    |
portable backup envelope
    |  format: daydock-backup
    |  formatVersion: 1
    |  exportedAt
    |  appSchemaVersion
    v
JSON file

JSON import
    |
backup-envelope validation
    |
current state-schema validation
    |
relational normalization
    |
preview counts
    |
explicit Restore backup
    |
store.replaceState
    |
    +--> localStorage persistence
    +--> cross-tab BroadcastChannel sync
```

### Recovery rules

- Backups use their own format version rather than mirroring localStorage.
- Import never mutates state until the entire file validates.
- Files larger than 5 MB are rejected before reading.
- Users see task, person and focus-history counts before replacing the current
  workspace.
- Restore uses the normal external-store replacement path, so there is no
  special persistence bypass.
- Export is entirely client-side: the JSON file is created with Blob/Object URL
  APIs and is never uploaded.
- The data-safety surface uses the native HTML Popover API as progressive
  enhancement in the app shell.
