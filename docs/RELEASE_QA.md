# DayDock Release QA

## Release gate

- lint passes with zero warnings
- TypeScript passes without emit
- unit and component tests pass
- production build succeeds
- GitHub Pages build uses the repository subpath
- service worker navigation fallback is repository-scope aware
- persisted and imported state is validated
- backup restore is explicit and previewed
- reduced-motion and forced-colors paths are preserved
- calendar-day context refreshes across midnight

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
10. Mobile navigation remains usable at narrow widths.
