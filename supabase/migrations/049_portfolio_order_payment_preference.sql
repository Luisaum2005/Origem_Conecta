-- Payment preference selected by the buyer when creating a portfolio order.
-- The platform only records the preference; it never processes payment data.

update public.orders
set payment_method = 'Dinheiro'
where payment_method = 'Dinheiro na entrega';

update public.demand_requests
set payment_method = 'Dinheiro'
where payment_method = 'Dinheiro na entrega';

alter table public.orders
  drop constraint if exists orders_payment_method_valid;

alter table public.orders
  add constraint orders_payment_method_valid
  check (payment_method is null or payment_method in ('Pix', 'Cartão', 'Dinheiro', 'A combinar'));

alter table public.demand_requests
  drop constraint if exists demand_requests_payment_method_valid;

alter table public.demand_requests
  add constraint demand_requests_payment_method_valid
  check (payment_method is null or payment_method in ('Pix', 'Cartão', 'Dinheiro', 'A combinar'));

-- `secure_create_portfolio_order` already writes this field through the
-- idempotent, address-safe RPC. The constraints above protect that same
-- server-side flow without replacing its validation or reservation logic.
