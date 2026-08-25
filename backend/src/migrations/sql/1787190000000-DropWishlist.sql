-- Removes the saved-pieces table.
--
-- A new migration rather than a revert of 1787182000000, which is already
-- recorded as run on every environment sharing this database. This is the
-- ordinary way to retire a table: say so forwards.
--
-- Only safe because the code reading it is removed on every branch in the same
-- change. Dropping a table a deployed branch still selects from is the one
-- thing a shared database cannot survive.
DROP TABLE IF EXISTS "wishlist_items";
