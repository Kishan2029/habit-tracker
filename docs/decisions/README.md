# Architecture Decisions

This folder captures the *why* behind architectural choices in this repo. Each file is a short, dated record of one decision so future contributors (and Claude) don't have to re-derive it.

## Format

```
# ADR NNNN: <Title>

Date: YYYY-MM-DD
Status: Accepted | Superseded by NNNN | Deprecated

## Context
What problem were we solving? What constraints applied?

## Decision
What did we choose, in one or two sentences.

## Consequences
Good and bad — what this locks us into, what it costs, what it enables.

## Alternatives considered
(Optional) What we rejected, and why.
```

## Index

| # | Title | Status |
|---|-------|--------|
| 0001 | Context API instead of Redux/Zustand for state | Accepted |
| 0002 | Dates as YYYY-MM-DD strings in local timezone at app boundaries | Accepted |
| 0003 | No TypeScript — plain JavaScript + JSX | Accepted |
| 0004 | Multi-provider email layer (SMTP / Resend / Brevo) | Accepted |
| 0005 | Per-instance `node-cache` instead of Redis | Accepted |
| 0006 | Mobile swipe gestures via `react-swipeable`, touch-only, additive | Accepted |

## How to add one

1. Copy the template above.
2. Number it as the next integer (zero-padded to 4 digits).
3. Don't edit old ADRs to change a decision — write a new one with `Status: Supersedes NNNN` and update the old one to `Status: Superseded by MMMM`. The history matters.
