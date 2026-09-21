# DayDock Release QA

## Release gate

Every pull request and release should prove the product at multiple layers:

- lint passes with zero warnings
- TypeScript passes without emit
- unit and component tests pass
- standard production build succeeds
- GitHub Pages build uses the repository subpath
- the Pages artifact verifier rejects asset URLs outside `/daydock/` and any stale `/Employees-template-React-App/` reference
- Playwright release smoke passes against the built production app
- desktop, mobile, narrow-mobile, Focus, destructive recovery, notification-mismatch, and offline states are captured as artifacts
- the service-worker precache is generated from the production build and remains repository-scope aware
- a warmed production browser context reopens after networking is disabled
- persisted and imported state is validated
- backup restore is explicit and previewed
- reduced-motion and forced-colors paths are preserved
- calendar-day context refreshes across midnight

## Browser smoke strategy

Visual Smoke uses Playwright against the real Vite production preview.

The suite is intentionally deterministic:

- state is injected before application boot through `addInitScript`
- interactions use accessible roles and labels
- readiness is asserted through visible product states, not fixed sleep intervals
- runtime `pageerror` and `console.error` events fail the scenario
- each scenario gets an isolated browser context
- retry is owned by the test runner rather than ad-hoc shell loops
- offline behavior uses Playwright's network emulation after the production service worker controls the page

The smoke suite currently proves:

1. first-run desktop, mobile, and narrow-mobile layouts
2. mature Today hierarchy
3. Inbox, People, and Review mobile navigation
4. Focus Mode on desktop and mobile
5. task-edit dialog
6. structural Undo after destructive removal
7. restored notification preference vs browser-permission mismatch
8. warm-install offline reopening

Screenshots, traces on failure, and the HTML report are uploaded as the `daydock-visual-smoke` workflow artifact.

## One-time GitHub Pages setup

The repository owner must enable the Pages site once before the first publication:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Rerun the **Deploy Pages** workflow.

The workflow deliberately does not try to create the Pages site with `GITHUB_TOKEN`: GitHub does not grant that token the repository-administration permission required for first-time Pages enablement. Until the one-time setting is enabled, the workflow still verifies the Pages build and exits successfully with an explicit warning instead of leaving `main` red.

### Repository rename safety

The Pages base in `vite.config.ts` must match the deployed repository path. For the current repository the production scope is `/daydock/`.

`npm run build:pages` is not considered successful merely because Vite emits files. After the service worker is finalized, `scripts/verify-pages-build.mjs` inspects the emitted artifact and fails the build when:

- an absolute `src` or `href` in `dist/index.html` escapes `/daydock/`
- the emitted JavaScript or CSS bundle references do not resolve inside `dist`
- the old `/Employees-template-React-App/` deployment path survives anywhere in emitted text assets

If the repository is renamed again, update the Pages base and this explicit release contract together.

## Product smoke contract

The automated browser suite covers release-critical rendering and interaction, while the following product contract should remain true:

- **Now** appears before detailed calendar context on a mature Today view.
- Promoting another Top 3 outcome immediately changes **Now** without removing or duplicating any priority.
- Command Palette task/person results reveal and focus the exact canonical row/card.
- Removing a task/person exposes a persistent Undo bar.
- Undo restores only the removed entity/relationships and must not overwrite newer Top 3 choices or later task reassignment.
- Calendar detail is collapsed by default and remains keyboard-expandable.
- Start Day exposes the selected focus-room value on the primary action.
- Editing a task estimate immediately updates its row metadata and the default Focus block for the current task.
- A restored workspace with Ready again preference enabled but no granted permission on the current browser shows alerts as inactive and explains the mismatch.
- The first mobile viewport prioritizes current work over calendar analytics.
- A 30-minute workday boundary persists and immediately changes derived focus room.
- A day with no remaining 25+ minute focus window suggests **0 min**, never invented availability.

## Manual release sanity check

Before calling a version release-ready:

1. Open the deployed GitHub Pages URL.
2. Capture → Inbox → Today → Top 3 works.
3. Focus starts, pauses, resumes, and completes.
4. People follow-up state persists.
5. Review reflects completed/focus/open work.
6. Backup export and validated restore work.
7. A second tab receives synchronized state.
8. Reload preserves the workspace, including the configured working window.
9. Export/restore preserves that working window and zero-focus day plans.
10. Manifest, favicon, JavaScript, CSS, PWA screenshot, and service worker resolve under `https://mykoladotsenko.github.io/daydock/`.
11. On a supporting installed-PWA platform, Share → DayDock opens prefilled Quick Capture and does not save until confirmed.
12. Reload after a share launch does not reopen one-time shared content.
13. Mobile navigation remains usable at narrow widths.

## Evidence retention

Visual evidence is CI-generated rather than hand-maintained wherever practical. This avoids README screenshots silently diverging from the actual release UI.

When a screenshot is promoted into repository documentation or PWA install metadata, it should originate from a green release-smoke run and be refreshed when that surface changes materially.
