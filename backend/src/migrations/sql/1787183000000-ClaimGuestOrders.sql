-- Records when a guest order was taken over by an account.
--
-- Mirrored by `1787183000000-ClaimGuestOrders.ts`. This file is the reviewable
-- record of what actually touches the database.
--
-- An order placed without signing in is reachable only by its uuid and the
-- email on it. When someone later proves they own that email — by verifying it
-- on an account — the order becomes theirs. `guestEmail` is deliberately kept
-- rather than cleared: it is the address the invoice actually went to, and
-- that is history, not a pointer. This column is what separates "ordered while
-- signed in" from "claimed afterwards".

BEGIN;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP WITH TIME ZONE;

-- The claim looks up unclaimed orders by lowercased email. Without this it is
-- a sequential scan on every sign-in.
CREATE INDEX IF NOT EXISTS "IDX_orders_unclaimed_email"
  ON "orders" (lower("guestEmail"))
  WHERE "userId" IS NULL AND "guestEmail" IS NOT NULL;

COMMIT;
