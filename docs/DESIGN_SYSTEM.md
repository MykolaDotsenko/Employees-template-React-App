# DayDock design system — Nordic Daylight

## Product feeling

DayDock should feel calm, optimistic and precise rather than like a dark developer dashboard.

The visual system is built around four ideas:

1. **Daylight** — warm ivory canvas, clean surfaces, clear Nordic blue.
2. **Hierarchy over decoration** — typography and spacing carry more weight than cards.
3. **Positive neutrality** — unfinished work is not presented as failure.
4. **Native speed** — interactions should feel closer to a focused desktop utility than a SaaS admin panel.

## Color

The production CSS uses OKLCH tokens and `color-mix()` for perceptually consistent states.

Primary roles:

- canvas — warm ivory
- surface — soft white
- text — warm graphite
- accent — Nordic blue
- positive — leaf green
- attention — soft apricot

Red is reserved for destructive or error states.

There is intentionally **no dark theme** in the initial product. A second theme would double design and accessibility surface area without improving the current product thesis.

## Shape

Cards are not the default grouping mechanism.

- navigation: medium radii
- empty states: dashed, quiet surfaces
- Now / Focus: larger signature surface
- data rows: mostly borders and whitespace
- pills: only for compact status/count metadata

## Responsive model

DayDock uses a single navigation DOM structure.

- wide container: vertical rail + workspace
- narrow container: bottom navigation + full-width workspace

The responsive breakpoint is a **container query**, not a viewport media query, so the shell remains composable inside other layouts.

## Motion

Motion will be added only when it communicates spatial continuity.

Future priority:

1. task → Focus shared View Transition
2. Inbox → Today task movement
3. contextual popovers / command palette
4. subtle completion feedback

`prefers-reduced-motion` always removes non-essential motion.
