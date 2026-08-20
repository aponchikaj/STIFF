-- OrderLifecycle — tracking numbers, customer cancellation, and returns.
--
-- Companion SQL for 1787176000000-OrderLifecycle.ts.
--
-- /rules has promised "14 days, unworn, tags on" since launch with nothing in
-- the system to honour it. These tables are that promise made real, plus the
-- two smaller gaps around it: no way to tell a customer where their parcel is,
-- and no way for them to call an order off before it is packed.

-- ---------------------------------------------------------------- orders ---
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "trackingCarrier"  character varying(60);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "trackingNumber"   character varying(120);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "trackingUrl"      character varying(500);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveredAt"      TIMESTAMP WITH TIME ZONE;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelledAt"      TIMESTAMP WITH TIME ZONE;
-- Who called it off. Null until something does.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelledBy"      character varying(10);

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "CHK_orders_cancelled_by";
ALTER TABLE "orders"
  ADD CONSTRAINT "CHK_orders_cancelled_by"
  CHECK ("cancelledBy" IS NULL OR "cancelledBy" IN ('customer', 'admin'));

-- --------------------------------------------------------------- returns ---
CREATE TABLE IF NOT EXISTS "return_requests" (
  "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
  "orderId"        uuid NOT NULL,
  "status"         character varying(12) NOT NULL DEFAULT 'requested',
  "reason"         text NOT NULL DEFAULT '',
  "resolutionNote" text NOT NULL DEFAULT '',
  "refundCents"    integer NOT NULL DEFAULT 0,
  "resolvedAt"     TIMESTAMP WITH TIME ZONE,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_return_requests" PRIMARY KEY ("id"),
  CONSTRAINT "FK_return_requests_order"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
  CONSTRAINT "CHK_return_requests_status"
    CHECK ("status" IN ('requested','approved','rejected','received','refunded'))
);

CREATE INDEX IF NOT EXISTS "IDX_return_requests_status"
  ON "return_requests" ("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_return_requests_orderId"
  ON "return_requests" ("orderId");

-- One open request per order at a time: two live claims on the same parcel is
-- an ambiguity nobody can resolve later.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_return_requests_open_per_order"
  ON "return_requests" ("orderId")
  WHERE "status" IN ('requested', 'approved', 'received');

CREATE TABLE IF NOT EXISTS "return_request_items" (
  "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
  "returnRequestId" uuid NOT NULL,
  "orderItemId"     uuid NOT NULL,
  "quantity"        integer NOT NULL,
  CONSTRAINT "PK_return_request_items" PRIMARY KEY ("id"),
  CONSTRAINT "FK_return_request_items_request"
    FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_return_request_items_order_item"
    FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE,
  CONSTRAINT "CHK_return_request_items_quantity" CHECK ("quantity" > 0),
  CONSTRAINT "UQ_return_request_items_pair" UNIQUE ("returnRequestId", "orderItemId")
);
