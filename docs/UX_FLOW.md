# DayDock UX flow

## Core loop

```text
Capture → Decide → Focus → Follow up → Close the day
```

The product is not another unlimited todo list. Its primary job is to reduce repeated decisions during a fragmented workday.

## Current implemented flow

### Capture

- desktop: click **Capture** or press **N**
- mobile: centered **Capture** action in the bottom navigation
- one required field: the thought itself
- default destination: Inbox
- no classification required at capture time

The user returns to the previous context immediately after capture.

### Decide in Inbox

Each unsorted Inbox item has three high-signal outcomes:

- **Today**
- **Later** — choose Tomorrow, Next week, a date, or Someday
- **Done**

Later is not a second backlog. Dated items automatically return to Inbox as **Ready again** when attention becomes useful. Ready-again work can go to Today, be snoozed, or be completed.

Scheduling is intentionally distinct from a deadline. A return date answers “when should I reconsider this?” and never produces an overdue or failure state.

Optional recurrence supports Daily, Weekdays, Weekly, and Monthly rhythms. Snoozing one recurring occurrence can move that occurrence without silently moving the recurrence anchor.

### Today

Today can contain more than three tasks, but only three can enter **Top 3**.

This separation matters:

- Today = plausible work for the day
- Top 3 = the outcomes that define success

Top 3 is enforced by the domain reducer rather than only by disabled UI.

### Complete

Completion:

- stamps the completion time outside the reducer
- moves the task to Done
- automatically removes it from Top 3
- closes active Focus when that task is completed
- for recurring work, atomically preserves the completed occurrence and creates a fresh future occurrence with a new id

Reopen is available from Review for accidental completion.


## Start Day ritual

For established workspaces, Today begins with a short daily reset rather than
another dashboard.

The panel answers four questions:

1. What deferred work is **Ready again**?
2. Which People follow-ups need attention?
3. How many of the Top 3 have been chosen?
4. How much protected focus room is realistic today?

The user chooses a rough focus-room estimate and starts the day. This value is
context, not a target or score. The daily plan is persisted, backed up, and
cross-tab synchronized with the rest of the canonical workspace, so a reload
does not restart the ritual.

## Primary surfaces

### Today

Answers:

- What matters today?
- What should I do now?
- What is next?

### Inbox

A temporary holding area for thoughts and interruptions.

### People

A lightweight follow-up surface, not a CRM.

### Review

Provides closure without grading the user.

## Emotional language

Prefer:

- A fresh day
- Inbox clear
- Needs a new plan
- Carry forward
- One thing at a time

Avoid:

- Failed
- Productivity score
- Broken streak
- motivational hype

## Mobile jobs

The mobile product prioritizes:

1. capture
2. check next
3. complete
4. follow up
5. focus timer controls

Complex planning and historical analysis remain secondary.


## People and follow-ups

People is intentionally a relationship context layer, not a CRM.

A person stores only:

- name
- lightweight context
- next follow-up date
- linked open tasks

Creating a follow-up task produces a normal DayDock task with a `personId`. The same canonical task can therefore appear in Inbox/Today and inside the person's context without duplicated state.

Past follow-up dates are described as **Needs a new plan**, not as failure. Clearing a follow-up means there is currently no date to remember; it does not delete the person or their linked work.


## Command palette

`Ctrl/Cmd + K` opens a keyboard-first command layer.

The palette searches locally across:

- product destinations
- high-value actions
- tasks
- people

Search input stays urgent while result filtering uses React `useDeferredValue`, so larger local workspaces do not make typing feel sticky.

The palette never becomes the only way to use a feature. Every command remains available through visible mouse/touch UI; the palette is an acceleration layer for power users.


## Review and seven-day rhythm

Review is a closure surface, not a scorecard.

It answers four questions:

1. What did I complete today?
2. How much protected focus time did I create?
3. Which Today items still need a home?
4. What has my recent focus rhythm looked like?

Unfinished Today tasks can be parked with a return date or completed directly from Review. When none remain, DayDock explicitly says that everything has a home.

The seven-day chart is derived from completed focus-session history. It shows data, not a grade, target, streak, or comparison against other people. Session duration is attributed to the calendar day on which the session ended; this keeps the calculation deterministic and appropriate for short work sessions.


## Review context layer

The seven-day Review stays intentionally aggregate, but today's review also exposes enough context to act:

- individual focus sessions for the current calendar day
- the task each session belonged to
- completed vs stopped outcome
- Inbox items still waiting
- People follow-ups still due

These are additive views over existing state. No second analytics model is introduced, and navigation from Review goes back to the canonical Inbox/People surfaces instead of duplicating their workflows.


## Calendar awareness

Calendar context is deliberately read-only. The user can import a standard `.ics` snapshot; DayDock normalizes only the busy events needed for the planning horizon and keeps them inside the local workspace.

Today uses that snapshot to show:
- timed constraints for the current day
- all-day context without automatically blocking the whole day
- 25+ minute focus windows inside the user's persisted working-day frame (08:00–18:00 by default)
- five-minute breathing room around timed events
- a realistic suggested Focus Room for Start Day

DayDock does not edit calendar events and does not pretend a local snapshot is live sync. The UI labels the source and import time and asks the user to refresh the file when the external calendar changes.

The working window is user-configurable in 30-minute increments. Changing its start or end time immediately recalculates focus windows and the Start Day focus-room suggestion, and the preference is persisted with the workspace and included in portable backups.


## Capture from other apps

When the installed PWA is selected from a system share sheet, DayDock launches Quick Capture with the shared title, text, and URL prefilled. Shared data is not saved automatically: the user must confirm **Capture**.

The one-time share parameters are removed from the URL immediately after launch so reload/back navigation cannot accidentally reopen or duplicate the capture. An installed-app shortcut can also open an empty Quick Capture directly.


## Ready again alerts

Ready again notifications are optional and off by default.

- Permission is requested only after the user presses **Enable** in Data controls.
- DayDock uses the active service worker for persistent/mobile-compatible notifications.
- Alerts are shown only when parked work has resurfaced into Inbox.
- A successful alert records the local date in workspace state, so tabs and reloads share once-per-day deduplication.
- If the app is fully closed, DayDock does not claim background scheduling without a push service; the alert is checked when the app is running or returns to the foreground.
- Opening a system notification focuses an existing DayDock window when possible, otherwise opens the installed app.
