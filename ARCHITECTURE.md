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
        +--> current schema → normalize
        +--> v0 schema → migrate → write v1
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
  schemaVersion: 1,
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
