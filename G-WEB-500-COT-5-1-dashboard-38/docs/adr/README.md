# Architecture Decision Records

Point-in-time records of notable engineering decisions: the context that
forced a choice, the decision itself, and the trade-offs we accepted.
Unlike [`../tech-stack.md`](../tech-stack.md) (a flat "what and why" per
technology), each ADR here tells the story behind one specific decision —
useful when a later contributor wonders "why is it built this way" and the
code comment alone isn't enough.

| # | Decision |
|---|----------|
| [0001](0001-monolithic-nextjs-app.md) | One Next.js app for frontend + backend, not two services (superseded by 0009) |
| [0002](0002-jwt-sessions-with-db-revocation-check.md) | JWT sessions with a per-request database revocation check |
| [0003](0003-central-timer-with-sse.md) | Central per-instance timer, pushed over SSE, not WebSocket |
| [0004](0004-service-subscription-enforcement.md) | Server-side service subscription enforcement |
| [0005](0005-linear-position-ordering.md) | Linear position ordering instead of persisted grid coordinates |
| [0006](0006-aes-gcm-token-encryption.md) | AES-256-GCM encryption for stored OAuth tokens |
| [0007](0007-self-hosted-fonts.md) | Self-hosted fonts instead of `next/font/google` |
| [0008](0008-font-awesome-icon-system.md) | Font Awesome as the single icon system |
| [0009](0009-split-backend-frontend-apps.md) | Split into two apps, `backend/` and `frontend/` |
| [0010](0010-hipolabs-plain-http.md) | Hipolabs Universities API over plain HTTP (no HTTPS upstream) |

Status values used below: **Accepted** (in production, no open questions),
**Accepted, revisited** (an earlier decision that was corrected after an
audit or incident — the record includes both), **Superseded** (a later ADR
replaced it — both stay, the later one explains why).
