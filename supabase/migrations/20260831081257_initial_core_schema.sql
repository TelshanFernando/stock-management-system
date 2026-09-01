-- ============================================================
-- STOCK MANAGEMENT SYSTEM
-- Phase 1: Core Database Schema
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type public.user_role as enum (
  'admin',
  'manager',
  'staff'
);

create type public.stock_movement_type as enum (
  'purchase',
  'sale',
  'adjustment',
  'transfer_in',
  'transfer_out',
  'return_in',
  'return_out'
);

create type public.purchase_status as enum (
  'draft',
  'pending',
  'received',
  'partially_received',
  'cancelled'
);

create type public.sale_status as enum (
  'draft',
  'completed',
  'cancelled',
  'refunded'
);

-- ============================================================
-- UPDATED_AT FUNCTION
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ============================================================
-- PROFILES
-- Extends Supabase auth.users
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role public.user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index profiles_role_idx on public.profiles(role);
create index profiles_active_idx on public.profiles(is_active);

-- ============================================================
-- CATEGORIES
-- ============================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint categories_name_not_empty
    check (length(trim(name)) > 0)
);

create unique index categories_name_unique_idx
on public.categories(lower(trim(name)));

-- ============================================================
-- SUPPLIERS
-- ============================================================

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  tax_number text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint suppliers_name_not_empty
    check (length(trim(name)) > 0)
);

create index suppliers_name_idx on public.suppliers(name);
create index suppliers_active_idx on public.suppliers(is_active);

-- ============================================================
-- CUSTOMERS
-- ============================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  tax_number text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint customers_name_not_empty
    check (length(trim(name)) > 0)
);

create index customers_name_idx on public.customers(name);
create index customers_active_idx on public.customers(is_active);

-- ============================================================
-- WAREHOUSES
-- ============================================================

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  address text,
  manager_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint warehouses_name_not_empty
    check (length(trim(name)) > 0),

  constraint warehouses_code_not_empty
    check (length(trim(code)) > 0)
);

create unique index warehouses_code_unique_idx
on public.warehouses(lower(trim(code)));

create index warehouses_manager_idx
on public.warehouses(manager_id);

-- ============================================================
-- PRODUCTS
-- ============================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  barcode text,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,

  cost_price numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null default 0,

  reorder_level numeric(14,3) not null default 0,
  reorder_quantity numeric(14,3) not null default 0,

  unit text not null default 'unit',
  is_active boolean not null default true,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint products_sku_not_empty
    check (length(trim(sku)) > 0),

  constraint products_name_not_empty
    check (length(trim(name)) > 0),

  constraint products_cost_price_check
    check (cost_price >= 0),

  constraint products_selling_price_check
    check (selling_price >= 0),

  constraint products_reorder_level_check
    check (reorder_level >= 0),

  constraint products_reorder_quantity_check
    check (reorder_quantity >= 0),

  constraint products_unit_not_empty
    check (length(trim(unit)) > 0)
);

create unique index products_sku_unique_idx
on public.products(lower(trim(sku)));

create unique index products_barcode_unique_idx
on public.products(barcode)
where barcode is not null;

create index products_category_idx
on public.products(category_id);

create index products_supplier_idx
on public.products(supplier_id);

create index products_name_idx
on public.products(name);

create index products_active_idx
on public.products(is_active);

-- ============================================================
-- INVENTORY
-- One row per product per warehouse
-- ============================================================

create table public.inventory (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  warehouse_id uuid not null
    references public.warehouses(id)
    on delete cascade,

  quantity numeric(14,3) not null default 0,
  reserved_quantity numeric(14,3) not null default 0,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint inventory_quantity_check
    check (quantity >= 0),

  constraint inventory_reserved_check
    check (reserved_quantity >= 0),

  constraint inventory_reserved_not_greater_than_quantity
    check (reserved_quantity <= quantity),

  constraint inventory_product_warehouse_unique
    unique(product_id, warehouse_id)
);

create index inventory_product_idx
on public.inventory(product_id);

create index inventory_warehouse_idx
on public.inventory(warehouse_id);

-- ============================================================
-- STOCK MOVEMENTS
-- Immutable inventory history
-- ============================================================

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products(id)
    on delete restrict,

  warehouse_id uuid not null
    references public.warehouses(id)
    on delete restrict,

  movement_type public.stock_movement_type not null,

  quantity numeric(14,3) not null,

  reference_id uuid,
  reference_number text,

  notes text,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default timezone('utc', now()),

  constraint stock_movements_quantity_check
    check (quantity > 0)
);

create index stock_movements_product_idx
on public.stock_movements(product_id);

create index stock_movements_warehouse_idx
on public.stock_movements(warehouse_id);

create index stock_movements_type_idx
on public.stock_movements(movement_type);

create index stock_movements_created_at_idx
on public.stock_movements(created_at desc);

create index stock_movements_reference_idx
on public.stock_movements(reference_id);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),

  order_number text not null,

  supplier_id uuid
    references public.suppliers(id)
    on delete set null,

  warehouse_id uuid
    references public.warehouses(id)
    on delete set null,

  status public.purchase_status not null default 'draft',

  subtotal numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,

  notes text,

  ordered_at timestamptz,
  received_at timestamptz,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint purchase_orders_number_not_empty
    check (length(trim(order_number)) > 0),

  constraint purchase_orders_subtotal_check
    check (subtotal >= 0),

  constraint purchase_orders_tax_check
    check (tax_amount >= 0),

  constraint purchase_orders_discount_check
    check (discount_amount >= 0),

  constraint purchase_orders_total_check
    check (total_amount >= 0)
);

create unique index purchase_orders_number_unique_idx
on public.purchase_orders(lower(trim(order_number)));

create index purchase_orders_supplier_idx
on public.purchase_orders(supplier_id);

create index purchase_orders_warehouse_idx
on public.purchase_orders(warehouse_id);

create index purchase_orders_status_idx
on public.purchase_orders(status);

create index purchase_orders_created_at_idx
on public.purchase_orders(created_at desc);

-- ============================================================
-- PURCHASE ITEMS
-- ============================================================

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),

  purchase_order_id uuid not null
    references public.purchase_orders(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete restrict,

  quantity numeric(14,3) not null,
  received_quantity numeric(14,3) not null default 0,

  unit_cost numeric(14,2) not null,

  line_total numeric(14,2)
    generated always as (quantity * unit_cost) stored,

  created_at timestamptz not null default timezone('utc', now()),

  constraint purchase_items_quantity_check
    check (quantity > 0),

  constraint purchase_items_received_check
    check (
      received_quantity >= 0
      and received_quantity <= quantity
    ),

  constraint purchase_items_unit_cost_check
    check (unit_cost >= 0)
);

create index purchase_items_order_idx
on public.purchase_items(purchase_order_id);

create index purchase_items_product_idx
on public.purchase_items(product_id);

-- ============================================================
-- SALES
-- ============================================================

create table public.sales (
  id uuid primary key default gen_random_uuid(),

  sale_number text not null,

  customer_id uuid
    references public.customers(id)
    on delete set null,

  warehouse_id uuid
    references public.warehouses(id)
    on delete set null,

  status public.sale_status not null default 'draft',

  subtotal numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,

  notes text,

  sold_at timestamptz,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint sales_number_not_empty
    check (length(trim(sale_number)) > 0),

  constraint sales_subtotal_check
    check (subtotal >= 0),

  constraint sales_tax_check
    check (tax_amount >= 0),

  constraint sales_discount_check
    check (discount_amount >= 0),

  constraint sales_total_check
    check (total_amount >= 0)
);

create unique index sales_number_unique_idx
on public.sales(lower(trim(sale_number)));

create index sales_customer_idx
on public.sales(customer_id);

create index sales_warehouse_idx
on public.sales(warehouse_id);

create index sales_status_idx
on public.sales(status);

create index sales_sold_at_idx
on public.sales(sold_at desc);

-- ============================================================
-- SALE ITEMS
-- ============================================================

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),

  sale_id uuid not null
    references public.sales(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete restrict,

  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,

  discount_amount numeric(14,2) not null default 0,

  line_total numeric(14,2)
    generated always as (
      (quantity * unit_price) - discount_amount
    ) stored,

  created_at timestamptz not null default timezone('utc', now()),

  constraint sale_items_quantity_check
    check (quantity > 0),

  constraint sale_items_unit_price_check
    check (unit_price >= 0),

  constraint sale_items_discount_check
    check (
      discount_amount >= 0
      and discount_amount <= quantity * unit_price
    )
);

create index sale_items_sale_idx
on public.sale_items(sale_id);

create index sale_items_product_idx
on public.sale_items(product_id);

-- ============================================================
-- PAYMENTS
-- ============================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),

  sale_id uuid not null
    references public.sales(id)
    on delete cascade,

  amount numeric(14,2) not null,

  payment_method text not null,

  reference text,

  paid_at timestamptz not null default timezone('utc', now()),

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default timezone('utc', now()),

  constraint payments_amount_check
    check (amount > 0),

  constraint payments_method_not_empty
    check (length(trim(payment_method)) > 0)
);

create index payments_sale_idx
on public.payments(sale_id);

create index payments_paid_at_idx
on public.payments(paid_at desc);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references public.profiles(id)
    on delete set null,

  action text not null,
  table_name text,
  record_id uuid,

  old_data jsonb,
  new_data jsonb,

  ip_address inet,
  user_agent text,

  created_at timestamptz not null default timezone('utc', now()),

  constraint audit_logs_action_not_empty
    check (length(trim(action)) > 0)
);

create index audit_logs_user_idx
on public.audit_logs(user_id);

create index audit_logs_table_idx
on public.audit_logs(table_name);

create index audit_logs_record_idx
on public.audit_logs(record_id);

create index audit_logs_created_at_idx
on public.audit_logs(created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create trigger customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger warehouses_updated_at
before update on public.warehouses
for each row execute function public.set_updated_at();

create trigger products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger inventory_updated_at
before update on public.inventory
for each row execute function public.set_updated_at();

create trigger purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

create trigger sales_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE AFTER SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.warehouses enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- PROFILE POLICIES
-- ============================================================

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- ============================================================
-- AUTHENTICATED USER READ POLICIES
-- ============================================================

create policy "Authenticated users can view categories"
on public.categories
for select
to authenticated
using (true);

create policy "Authenticated users can view suppliers"
on public.suppliers
for select
to authenticated
using (true);

create policy "Authenticated users can view customers"
on public.customers
for select
to authenticated
using (true);

create policy "Authenticated users can view warehouses"
on public.warehouses
for select
to authenticated
using (true);

create policy "Authenticated users can view products"
on public.products
for select
to authenticated
using (true);

create policy "Authenticated users can view inventory"
on public.inventory
for select
to authenticated
using (true);

create policy "Authenticated users can view stock movements"
on public.stock_movements
for select
to authenticated
using (true);

create policy "Authenticated users can view purchase orders"
on public.purchase_orders
for select
to authenticated
using (true);

create policy "Authenticated users can view purchase items"
on public.purchase_items
for select
to authenticated
using (true);

create policy "Authenticated users can view sales"
on public.sales
for select
to authenticated
using (true);

create policy "Authenticated users can view sale items"
on public.sale_items
for select
to authenticated
using (true);

create policy "Authenticated users can view payments"
on public.payments
for select
to authenticated
using (true);

-- ============================================================
-- END OF PHASE 1
-- ============================================================
