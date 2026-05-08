-- Run this in the Supabase SQL editor (or via CLI: supabase db push).
-- Creates a view that computes each client's running balance in the database,
-- replacing the client-side Promise.all(charges, payments) calculation.
--
-- After running this migration, the useBalances hook queries this view instead
-- of fetching all charges + all payments and reducing them in JavaScript.

create or replace view client_balances as
select
  c.id as client_id,
  coalesce(
    (select sum(amount)::numeric from charges where client_id = c.id),
    0
  ) - coalesce(
    (select sum(amount)::numeric from payments where client_id = c.id),
    0
  ) as balance
from clients c;
