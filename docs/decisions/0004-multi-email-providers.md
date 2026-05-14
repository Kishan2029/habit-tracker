# ADR 0004: Multi-provider email layer (SMTP / Resend / Brevo)

Date: 2026-05-12
Status: Accepted

## Context

The server sends transactional email: welcome, verification code, password reset, shared-habit invites, weekly summary, feedback admin notification. Email providers have notoriously different reliability and deliverability per region / sender domain, and any single provider can fail or rate-limit at any time.

The free tiers of Resend, Brevo, and a generic SMTP relay each have their own quirks. We wanted to be able to switch without changing application code.

## Decision

Abstract email behind a provider factory at `server/src/services/email/providerFactory.js`:

- `EMAIL_PROVIDER` env var selects `smtp` | `resend` | `brevo`.
- Each provider implementation lives under `server/src/services/email/providers/`.
- `emailService.js` is the public API (`sendWelcome`, `sendVerificationCode`, `sendPasswordReset`, `sendSharedHabitInvite`, etc.) — call sites don't know which provider is active.
- Templates are HTML strings in `services/email/templates.js`, identical across providers.
- If no provider is configured, log to console and return success. Useful in local dev without burning quota.
- Calls are fire-and-forget: wrapped in `.catch()` at the call site so an email failure never fails the originating HTTP request.

## Consequences

**Good**
- Switching providers is a one-line env change in production.
- Local dev works with no email config at all.
- Easier to A/B providers when deliverability is suspect.

**Bad**
- Three integrations to maintain. If one provider changes its API, we patch their adapter; the rest are unaffected.
- Slight extra abstraction overhead — three files instead of one.

## Alternatives considered

- **One provider only** — simplest, but pins us to that provider's pricing/uptime. Past outages have cost us hours of debugging before we built this layer.
- **A third-party meta-provider (e.g. AWS SES, MailerSend)** — adds cost and another vendor dependency without obvious upside at our scale.

## Trigger to revisit

If we standardize on one provider for 6+ months without issue, consider deleting the unused adapters and keeping the factory as a stub for future flexibility. Don't delete the factory itself — the abstraction is cheap.
