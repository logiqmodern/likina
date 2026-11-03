<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules (Likina)

- The spec is `docs/PROMPT.md`. Work phase by phase (§19); after each phase stop, show results and wait for approval.
- The audit of the old WordPress/WooCommerce site is `docs/AUDIT.md`.
- Base code comes from `logiqmodern/reducta-new` (spec §3.1): copy and adapt infrastructure, admin, security, measurement; do not carry over the booking domain.
- Never invent facts, prices, sizes, techniques, reviews, photos or claims. Unknowns → visible `TODO-CLIENT: …` placeholder + an entry in `docs/OPEN-QUESTIONS.md`.
- Tests for business logic (pricing, stock/reservation, order status transitions, myPOS signature, shipping) are written before or with the code.
- Code, identifiers and comments in English; user-facing content in Bulgarian and English (every CMS text has BG + EN).
- Prices are EUR only, computed in one place (`src/domain/pricing.ts`) and snapshotted on each order.
- A unique original can never be sold twice: reservation + partial unique index (spec §5.3).
- Shipping cost must never block checkout (spec §6.3).
- Time zone: business logic in `Europe/Sofia`, database in UTC (`timestamptz`).
- Stack decisions and their reasons: `docs/adr/`. Use npm 11.
- Before `git push`: `npm run check` and `npm run build` must pass.
