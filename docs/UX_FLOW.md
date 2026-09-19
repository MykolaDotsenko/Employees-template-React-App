# DayDock UX flow

## Core loop

```text
Capture → Decide → Focus → Follow up → Close the day
```

The product is not another unlimited todo list. Its primary job is to reduce repeated decisions during a fragmented workday.

## Current implemented flow

### Capture

- desktop: click **Capture** or press **N**
- mobile: thumb-friendly floating **+**
- one required field: the thought itself
- default destination: Inbox
- no classification required at capture time

The user returns to the previous context immediately after capture.

### Decide in Inbox

Each Inbox item currently has three high-signal outcomes:

- **Today**
- **Later**
- **Done**

Person attachment and richer scheduling are later layers.

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

Undo/reopen exists in the domain model and will surface with review/recovery UI.

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
