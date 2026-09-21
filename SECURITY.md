# Security policy

DayDock is a client-side, local-first application with no application backend. Workspace data is stored in the user's browser unless the user explicitly exports a backup file.

## Reporting a vulnerability

Please do not disclose a security vulnerability in a public issue before a fix is available.

Use GitHub's private vulnerability reporting flow for this repository when available. If private reporting is unavailable, contact the repository owner through their GitHub profile and share only enough information to establish a private channel.

Useful reports include:

- affected DayDock version or commit
- browser and operating system
- reproduction steps
- impact
- proof of concept where safe
- suggested mitigation, if known

## Security boundaries

DayDock treats these inputs as untrusted:

- persisted localStorage state
- imported backup JSON
- imported calendar (.ics) data
- cross-tab BroadcastChannel snapshots
- share-target URL/text input

Validation and normalization are required before imported or persisted data becomes canonical workspace state.

## Out of scope

Because DayDock has no account system or application backend, reports about server-side authentication, password storage, account takeover, or server database exposure do not apply to the current architecture.

Browser-, extension-, operating-system-, and GitHub Pages platform vulnerabilities should be reported to the relevant vendor unless DayDock introduces a specific exploitable condition.
