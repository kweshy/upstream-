create type public.app_role as enum ('admin', 'rider', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '' unique,
  block text not null default '',
  house_number text not null default '',
  gate_instructions text not null default '',
  wallet_balance numeric(10,2) not null default 0,
  bottles_with_customer integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Profile + role on signup; the very first account becomes admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, block, house_number, gate_instructions)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.phone, new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'block', ''),
    coalesce(new.raw_user_meta_data->>'house_number', ''),
    coalesce(new.raw_user_meta_data->>'gate_instructions', '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  select new.id, 'admin'
  where not exists (select 1 from public.user_roles where role = 'admin');

  if not exists (select 1 from public.user_roles where user_id = new.id) then
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  size_label text not null default '',
  description text not null default '',
  price_kes numeric(10,2) not null,
  deposit_kes numeric(10,2) not null default 0,
  category text not null default 'water',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.delivery_slots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  start_time text not null,
  end_time text not null,
  cutoff_minutes integer not null default 120,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  label text not null default 'Home',
  block text not null default '',
  house_number text not null default '',
  gate_instructions text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create type public.order_status as enum ('pending_payment','confirmed','packed','out_for_delivery','delivered','cancelled');
create type public.payment_method as enum ('mpesa_stk','wallet','on_delivery_mpesa','on_delivery_cash');
create type public.payment_status as enum ('pending','success','failed');

create sequence public.order_number_seq start 1;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status public.order_status not null default 'pending_payment',
  payment_method public.payment_method not null,
  delivery_slot_id uuid references public.delivery_slots(id),
  delivery_date date not null default current_date,
  delivery_fee_kes numeric(10,2) not null default 0,
  total_kes numeric(10,2) not null,
  block text not null default '',
  house_number text not null default '',
  gate_instructions text not null default '',
  rider_id uuid references public.profiles(id),
  empties_collected integer not null default 0,
  cash_collected numeric(10,2),
  notes text not null default '',
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_order_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'UP-' || lpad(nextval('public.order_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger trg_set_order_number
before insert on public.orders
for each row execute function public.set_order_number();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id),
  product_name text not null,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  deposit_kes numeric(10,2) not null default 0,
  line_total numeric(10,2) not null
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  purpose text not null default 'order' check (purpose in ('order','wallet_topup')),
  method text not null default 'mpesa_stk',
  amount numeric(10,2) not null,
  status public.payment_status not null default 'pending',
  mpesa_receipt text,
  checkout_request_id text,
  merchant_request_id text,
  phone_number text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric(10,2) not null,
  kind text not null check (kind in ('topup','order_payment','refund','adjustment')),
  mpesa_receipt text,
  created_at timestamptz not null default now()
);

create or replace function public.apply_wallet_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set wallet_balance = wallet_balance + new.amount where id = new.user_id;
  return new;
end;
$$;

create trigger trg_wallet_balance
after insert on public.wallet_transactions
for each row execute function public.apply_wallet_transaction();

create table public.bottle_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete set null,
  change integer not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.apply_bottle_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set bottles_with_customer = greatest(0, bottles_with_customer + new.change) where id = new.user_id;
  return new;
end;
$$;

create trigger trg_bottle_ledger
after insert on public.bottle_ledger
for each row execute function public.apply_bottle_change();

create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  channel text not null default 'log',
  recipient text not null default '',
  message text not null,
  status text not null default 'logged',
  created_at timestamptz not null default now()
);

-- Grants
grant select, insert, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant select on public.products, public.delivery_slots to anon, authenticated;
grant all on public.products, public.delivery_slots to service_role;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;
grant select, insert on public.payments to authenticated;
grant select, insert on public.wallet_transactions to authenticated;
grant select, insert on public.bottle_ledger to authenticated;
grant select, insert on public.notifications_log to authenticated;
grant all on public.orders, public.order_items, public.payments, public.wallet_transactions, public.bottle_ledger, public.notifications_log, public.addresses to service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant usage on sequence public.order_number_seq to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.products enable row level security;
alter table public.delivery_slots enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.bottle_ledger enable row level security;
alter table public.notifications_log enable row level security;

create policy "Own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Update own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "Rider sees assigned customers" on public.profiles for select to authenticated using (
  exists (select 1 from public.orders o where o.user_id = profiles.id and o.rider_id = auth.uid())
);
create policy "Roles readable by owner" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Catalogue public" on public.products for select to anon, authenticated using (is_active);
create policy "Admin manages products" on public.products for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Slots public" on public.delivery_slots for select to anon, authenticated using (is_active);
create policy "Admin manages slots" on public.delivery_slots for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "Own addresses" on public.addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Own orders" on public.orders for select to authenticated using (user_id = auth.uid());
create policy "Insert own order" on public.orders for insert to authenticated with check (user_id = auth.uid());
create policy "Update own order" on public.orders for update to authenticated using (user_id = auth.uid());
create policy "Rider sees assigned orders" on public.orders for select to authenticated using (rider_id = auth.uid());
create policy "Rider updates assigned orders" on public.orders for update to authenticated using (rider_id = auth.uid());
create policy "Admin sees all orders" on public.orders for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admin updates orders" on public.orders for update to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Items via own order" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and (o.user_id = auth.uid() or o.rider_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
);
create policy "Insert items own order" on public.order_items for insert to authenticated with check (
  exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
);

create policy "Own payments" on public.payments for select to authenticated using (user_id = auth.uid());
create policy "Insert own payment" on public.payments for insert to authenticated with check (user_id = auth.uid());
create policy "Admin payments" on public.payments for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admin updates payments" on public.payments for update to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Own wallet txns" on public.wallet_transactions for select to authenticated using (user_id = auth.uid());
create policy "Insert own wallet txn" on public.wallet_transactions for insert to authenticated with check (user_id = auth.uid());
create policy "Admin wallet txns" on public.wallet_transactions for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Own bottle ledger" on public.bottle_ledger for select to authenticated using (user_id = auth.uid());
create policy "Insert own bottle ledger" on public.bottle_ledger for insert to authenticated with check (user_id = auth.uid());
create policy "Admin bottle ledger" on public.bottle_ledger for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Own notifications" on public.notifications_log for select to authenticated using (user_id = auth.uid());
create policy "Admin notifications" on public.notifications_log for select to authenticated using (public.has_role(auth.uid(), 'admin'));

insert into public.products (name, size_label, description, price_kes, deposit_kes, category, sort_order) values
  ('20L Refill', '20 litres', 'Refill of your 20L bottle - swap your empty for a full one.', 250, 0, 'refill', 1),
  ('20L New Bottle', '20 litres', 'Brand new 20L bottle of purified water, includes refundable bottle deposit.', 450, 150, 'new_bottle', 2),
  ('5L Bottle', '5 litres', 'Handy 5L bottle for the counter or desk.', 200, 0, 'pack', 3),
  ('1L Bottle', '1 litre', 'Single 1L bottle.', 60, 0, 'pack', 4),
  ('500ml Bottle', '500 ml', 'Single 500ml bottle.', 40, 0, 'pack', 5);

insert into public.delivery_slots (label, start_time, end_time, cutoff_minutes, sort_order) values
  ('Morning (8am - 12pm)', '08:00', '12:00', 120, 1),
  ('Afternoon (12pm - 4pm)', '12:00', '16:00', 120, 2),
  ('Evening (4pm - 7pm)', '16:00', '19:00', 120, 3);
