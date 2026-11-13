# ADR 0002 — Orders, stock and the legacy import (Phase 1 + 3)

Date: 13.11.2026 · Status: accepted

## Orders and statuses

- Statuses follow spec §5.2 with one rename: **`confirmed`** instead of `cod_confirmed`. It covers every "pay later" order — cash on delivery *and* paying at the atelier on pickup (`payment_method = on_pickup`, §6.2). One status, two payment methods; the label for the client is „Потвърдена“.
- Atelier pickups are handed over, not shipped: `paid | confirmed → delivered`. A shipment must pass `shipped`.
- A late successful card payment can revive a `payment_failed` order if the artworks are still free; otherwise the payment is recorded and flagged for a refund (`needs_refund`).
- All transitions live in `src/domain/orders.ts` (table + tests). `src/server/shop/orders.ts` is the only code that writes order status and artwork stock.

## Never selling an original twice (§5.3)

1. The checkout transaction locks the artworks (`SELECT … FOR UPDATE`, in id order — no deadlocks) and checks `status = available`.
2. `order_items.holds_stock` is true while the order is active; the partial unique index `order_items_one_active_original_uq (artwork_id) WHERE kind = 'original' AND holds_stock` makes a second active order for the same original impossible in the database itself.
3. Expired card reservations are released by `releaseExpiredReservations` — called at the start of every checkout as well as by the cron/worker, so an abandoned payment never blocks a sale even if the cron is late.
4. Test: 20 parallel checkouts for one original → exactly 1 succeeds (`orders.int.test.ts`).

A returned shipment brings the original back as `hidden` (the atelier checks it first); a cancelled or failed order makes it `available` at once.

## Money and sizes

- Money: integer euro cents everywhere; `src/domain/pricing.ts` is the only place that computes totals (pickup −5 %, shipping model `included` = 0 €). The quote's inputs are snapshotted on the order (`pricing_snapshot`).
- Sizes: integer millimetres (`width_mm`, `height_mm`, `depth_mm`), shown as centimetres. No floats in the database.

## Legacy import

- Source: the cPanel backup (MariaDB dump + `wp-content/uploads`), not the REST API — the backup also has the drafts and the original image files. `scripts/legacy/extract-dump.py` writes `data/legacy/catalog.json` (public catalogue only: no orders, customers or users); `scripts/import-legacy.ts` imports it.
- Old descriptions are cleaned (`src/server/import/legacy-text.ts`): spec lines → fields, the old ✓ trust bullets / shipping terms / contact block removed, every "сертификат за автентичност" removed (not issued). Sizes become a suggestion with `size_needs_check`.
- Images are re-encoded to WebP (≤ 2400 px) and stored in the database like all media (276 images ≈ 33 MB).
- Idempotent: matched by WordPress ids; existing rows are not overwritten unless `--overwrite`.
- English texts are not imported (TranslatePress had only ~8 % translated); they are generated with the Claude API (§7).
