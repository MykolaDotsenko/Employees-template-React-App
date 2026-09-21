# Contributing to DayDock

DayDock is a focused local-first product. Changes should preserve its core product principles: calm prioritization, truthful state, explicit recovery, privacy by default, and a small runtime dependency surface.

## Before opening a pull request

1. Install the supported Node.js version (24+).
2. Run `npm ci`.
3. Make the smallest coherent change.
4. Run `npm run check`.
5. If the change affects deployment paths, run `npm run build:pages`.
6. If the change affects layout or interaction, verify the Visual Smoke workflow on the pull request.

## Architecture expectations

- Business rules belong in the deterministic domain layer.
- Reducers must not read clocks, create ids, access storage, or call browser APIs.
- Persisted/imported input must be validated before becoming canonical state.
- New views should derive from the canonical workspace rather than maintain competing business state.
- Browser capabilities should stay behind narrow adapters.
- Accessibility and mobile behavior are part of the component contract.
- Prefer platform primitives over new runtime dependencies when the trade-off is reasonable.

## Testing

Add tests at the cheapest layer that proves the behavior:

- domain tests for invariants and state transitions
- persistence tests for validation, migration, and recovery
- component tests for user journeys
- Playwright release smoke for browser/platform behavior that unit tests cannot prove

Do not chase coverage for its own sake. Prioritize failure modes that could corrupt user state, lose work, or make a release unusable.

## Pull request scope

A pull request should explain:

- the user or engineering problem
- why the chosen boundary is appropriate
- relevant trade-offs
- verification performed
- screenshots for meaningful visual changes

Avoid mixing unrelated refactors with product behavior unless the refactor is required to make the behavior safe.
