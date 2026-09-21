# DayDock Release QA

## Release gate

- lint passes with zero warnings
- TypeScript passes without emit
- unit and component tests pass
- production build succeeds
- GitHub Pages build uses the repository subpath
- service worker precache is generated from the production build and repository-scope aware
- a warmed production profile reopens successfully after the preview server is stopped
- persisted and imported state is validated
- backup restore is explicit and previewed
- reduced-motion and forced-colors paths are preserved
- calendar-day context refreshes across midnight

## One-time GitHub Pages setup

The repository owner must enable the Pages site once before the first publication:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Rerun the **Deploy Pages** workflow.

The workflow deliberately does not try to create the Pages site with `GITHUB_TOKEN`: GitHub does not grant that token the repository-administration permission required for first-time Pages enablement. Until the one-time setting is enabled, the workflow still verifies the Pages build and exits successfully with an explicit warning instead of leaving `main` red.

## Production smoke test

After each release deployment, verify the user-critical hierarchy before feature depth:

- **Now** appears before detailed calendar context on a mature Today view.
- Calendar detail is collapsed by default and remains keyboard-expandable.
- Start Day exposes the selected focus-room value on the primary action.
- The first mobile viewport prioritizes current work over calendar analytics.
- A 30-minute workday boundary (for example 08:30–17:30) persists and immediately changes derived focus room.
- A day with no remaining 25+ minute focus window suggests **0 min**, never invented availability.
- The visual fixture uses the current persisted schema rather than relying on a migration side effect.

Then verify:

1. Today loads without console errors.
2. Capture → Inbox → Today → Top 3 works.
3. Focus starts, pauses, resumes, and completes.
4. People follow-up state persists.
5. Review reflects completed/focus/open work.
6. Backup export and validated restore work.
7. A second tab receives synchronized state.
8. Reload preserves the workspace, including the configured working window.
9. Export/restore preserves that working window and zero-focus day plans.
10. Manifest, favicon, and service worker resolve under the GitHub Pages subpath.
11. Reload once, disable the network, and confirm the installed shell still opens with its JS/CSS assets.
12. On a supporting installed-PWA platform, Share → DayDock opens prefilled Quick Capture and does not save until confirmed.
13. Reload after a share launch does not reopen the one-time shared content.
14. Mobile navigation remains usable at narrow widths.
