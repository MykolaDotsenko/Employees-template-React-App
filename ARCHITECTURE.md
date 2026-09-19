# DayDock architecture

## PR1: migration boundary

PR1 is intentionally a bridge, not the target architecture.

```text
React UI
   |
   +--> employee domain helpers
   |
   +--> legacy storage adapter
```

The original employee workflow remains available while the repository moves to a modern, typed, testable build.

## Target architecture

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
