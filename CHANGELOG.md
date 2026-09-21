# Changelog

All notable DayDock product and release-engineering changes are documented here.

DayDock follows semantic versioning for intentional product releases. Git history and pull requests remain the detailed implementation record.

## 1.0.0 — 2026-09-21

### Product

- local-first Today / Inbox / Later workflow
- Top 3 priorities with explicit current **Now** outcome
- recurring tasks with history-preserving future occurrences
- timestamp-derived Focus Mode with pause/resume
- People follow-ups and linked tasks
- Daily Review and seven-day focus context
- local `.ics` Calendar Awareness and configurable workday
- command palette with exact task/person reveal
- optional Ready again notifications
- installable PWA, share target, and offline shell
- validated JSON backup / restore
- structural Undo for task and person removal

### Data integrity

- versioned schema migration through schema v7
- Zod validation at persistence, backup, and cross-tab boundaries
- relational normalization after structural validation
- deterministic snapshot-level BroadcastChannel synchronization
- explicit degraded persistence behavior

### Release engineering

- strict TypeScript and zero-warning ESLint gate
- unit and component tests for domain and user journeys
- GitHub Pages deployment with repository-path artifact validation
- deterministic Playwright production smoke across desktop, mobile, Focus, recovery, notification, and offline states
- build-generated service-worker precache
- PWA install metadata and production screenshot

### Repository maturity

- current-state architecture and trade-off documentation
- contribution and security policies
- CODEOWNERS, Dependabot, and pull-request template
- feature-scoped stylesheet modules
