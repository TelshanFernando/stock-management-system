-- ============================================================
-- STOCK MANAGEMENT SYSTEM
-- Phase 2: Inventory Operations
-- ============================================================

-- ============================================================
-- STOCK ADJUSTMENT FUNCTION
-- ============================================================

create or replace function public.adjust_inventory(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_movement_type public.stock_movement_type,
  p_notes text default null,
  p_reference_id uuid default null,
  p_reference_number text default null
)
returns public.inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public.inventory;
  v_user_id uuid;
  v_current_quantity numeric;
  v_current_reserved numeric;
  v_new_quantity numeric;
  v_movement_quantity numeric;
begin
  -- ----------------------------------------------------------
  -- Authentication
  -- ----------------------------------------------------------

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- ----------------------------------------------------------
  -- Validate quantity
  --
  -- Normal movements must be positive.
  -- Adjustments may be positive or negative.
  -- ----------------------------------------------------------

  if p_quantity is null then
    raise exception 'Quantity is required';
  end if;

  if p_movement_type = 'adjustment' then
    if p_quantity = 0 then
      raise exception 'Adjustment quantity cannot be zero';
    end if;
  elsif p_quantity <= 0 then
    raise exception 'Movement quantity must be greater than zero';
  end if;

  -- ----------------------------------------------------------
  -- Validate movement type
  -- ----------------------------------------------------------

  if p_movement_type not in (
    'adjustment',
    'purchase',
    'sale',
    'transfer_in',
    'transfer_out',
    'return_in',
    'return_out'
  ) then
    raise exception 'Invalid stock movement type';
  end if;

  -- ----------------------------------------------------------
  -- Validate product
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.products
    where id = p_product_id
      and is_active = true
  ) then
    raise exception 'Product does not exist or is inactive';
  end if;

  -- ----------------------------------------------------------
  -- Validate warehouse
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.warehouses
    where id = p_warehouse_id
      and is_active = true
  ) then
    raise exception 'Warehouse does not exist or is inactive';
  end if;

  -- ----------------------------------------------------------
  -- Lock existing inventory row
  -- ----------------------------------------------------------

  select
    quantity,
    reserved_quantity
  into
    v_current_quantity,
    v_current_reserved
  from public.inventory
  where product_id = p_product_id
    and warehouse_id = p_warehouse_id
  for update;

  v_current_quantity := coalesce(v_current_quantity, 0);
  v_current_reserved := coalesce(v_current_reserved, 0);

  -- ----------------------------------------------------------
  -- Calculate new quantity
  -- ----------------------------------------------------------

  if p_movement_type in (
    'purchase',
    'transfer_in',
    'return_in'
  ) then

    v_new_quantity := v_current_quantity + p_quantity;
    v_movement_quantity := p_quantity;

  elsif p_movement_type in (
    'sale',
    'transfer_out',
    'return_out'
  ) then

    v_new_quantity := v_current_quantity - p_quantity;
    v_movement_quantity := p_quantity;

  else
    -- adjustment
    --
    -- Positive adjustment = add stock
    -- Negative adjustment = remove stock

    v_new_quantity := v_current_quantity + p_quantity;
    v_movement_quantity := abs(p_quantity);

  end if;

  -- ----------------------------------------------------------
  -- Prevent negative inventory
  -- ----------------------------------------------------------

  if v_new_quantity < 0 then
    raise exception
      'Insufficient stock. Available quantity: %',
      v_current_quantity;
  end if;

  -- ----------------------------------------------------------
  -- Reserved stock protection
  -- ----------------------------------------------------------

  if v_current_reserved > v_new_quantity then
    raise exception
      'Adjustment would make reserved stock greater than total stock';
  end if;

  -- ----------------------------------------------------------
  -- Insert or update inventory
  -- ----------------------------------------------------------

  insert into public.inventory (
    product_id,
    warehouse_id,
    quantity,
    reserved_quantity
  )
  values (
    p_product_id,
    p_warehouse_id,
    v_new_quantity,
    0
  )
  on conflict (product_id, warehouse_id)
  do update set
    quantity = excluded.quantity,
    updated_at = timezone('utc', now())
  returning *
  into v_inventory;

  -- ----------------------------------------------------------
  -- Record immutable stock movement
  -- ----------------------------------------------------------

  insert into public.stock_movements (
    product_id,
    warehouse_id,
    movement_type,
    quantity,
    reference_id,
    reference_number,
    notes,
    created_by
  )
  values (
    p_product_id,
    p_warehouse_id,
    p_movement_type,
    v_movement_quantity,
    p_reference_id,
    p_reference_number,
    p_notes,
    v_user_id
  );

  return v_inventory;
end;
$$;

-- ============================================================
-- RPC ACCESS
-- ============================================================

grant execute
on function public.adjust_inventory(
  uuid,
  uuid,
  numeric,
  public.stock_movement_type,
  text,
  uuid,
  text
)
to authenticated;

-- ============================================================
-- INVENTORY SUMMARY VIEW
-- ============================================================

create or replace view public.inventory_summary
with (security_invoker = true)
as
select
  i.id,
  i.product_id,
  i.warehouse_id,

  p.sku,
  p.barcode,
  p.name as product_name,
  p.description,

  p.category_id,
  c.name as category_name,

  p.supplier_id,
  s.name as supplier_name,

  p.cost_price,
  p.selling_price,

  p.reorder_level,
  p.reorder_quantity,
  p.unit,

  i.quantity,
  i.reserved_quantity,

  greatest(
    i.quantity - i.reserved_quantity,
    0
  ) as available_quantity,

  case
    when i.quantity <= 0 then 'out_of_stock'
    when i.quantity <= p.reorder_level then 'low_stock'
    else 'in_stock'
  end as stock_status,

  p.is_active as product_is_active,
  i.created_at,
  i.updated_at

from public.inventory i

inner join public.products p
  on p.id = i.product_id

left join public.categories c
  on c.id = p.category_id

left join public.suppliers s
  on s.id = p.supplier_id;

-- ============================================================
-- VIEW ACCESS
-- ============================================================

grant select
on public.inventory_summary
to authenticated;

-- ============================================================
-- END OF PHASE 2 DATABASE OPERATIONS
-- ============================================================