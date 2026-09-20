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

After each release deployment, verify:

1. Today loads without console errors.
2. Capture → Inbox → Today → Top 3 works.
3. Focus starts, pauses, resumes, and completes.
4. People follow-up state persists.
5. Review reflects completed/focus/open work.
6. Backup export and validated restore work.
7. A second tab receives synchronized state.
8. Reload preserves the workspace.
9. Manifest, favicon, and service worker resolve under the GitHub Pages subpath.
10. Reload once, disable the network, and confirm the installed shell still opens with its JS/CSS assets.
11. Mobile navigation remains usable at narrow widths.
