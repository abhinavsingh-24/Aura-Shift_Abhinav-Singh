# SIDEQUEST production launch checklist

Feature 20 introduces baseline hardening only. Complete this checklist before opening the app to real users.

## Required before deployment

- [ ] Set `NODE_ENV=production` and a cryptographically random `SESSION_SECRET` of at least 32 characters.
- [ ] Set `FRONTEND_URL` to the exact HTTPS frontend origin; do not allow broad wildcard origins when cookies are used.
- [ ] Configure MongoDB with least-privilege credentials, network restrictions, automated backups, and a tested restore procedure.
- [ ] Terminate TLS at a trusted hosting provider and ensure secure cookies remain enabled.
- [ ] Replace process-local rate limiting with a shared store if running multiple instances; consider stricter per-route and per-account policies.
- [ ] Add email verification, password reset, session revocation/rotation, account deletion, and verified organizer onboarding.
- [ ] Review authentication and authorization on every write route; add CSRF protections if cookie-authenticated mutations are deployed cross-site.
- [ ] Add structured logs, alerting, uptime checks, error tracking, and retention policies that avoid logging secrets or unnecessary personal data.
- [ ] Run `npm ci`, `npm test`, `npm run build --prefix client`, and a manual/browser end-to-end suite in CI.
- [ ] Run dependency auditing, accessibility checks, responsive-device testing, and a security review.
- [ ] Confirm privacy notice, terms, moderation procedures, event safety escalation, and payment provider compliance before enabling commerce.

## Current implementation notes

- Baseline security headers and request-body limits are enabled by the Express server.
- Login/register, report creation, and registration endpoints have process-local rate limits.
- In-memory rate limits reset on restart and do not coordinate across multiple server instances.
- This checklist is not a security certification; the full application and deployment configuration must be tested independently.
