-- ============================================================
-- STOCK MANAGEMENT SYSTEM
-- Phase 2: Warehouse Stock Transfers
-- ============================================================

create or replace function public.transfer_inventory(
  p_product_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_quantity numeric,
  p_reference_id uuid default null,
  p_reference_number text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_source_inventory public.inventory;
  v_destination_inventory public.inventory;
begin
  -- ----------------------------------------------------------
  -- Authentication
  -- ----------------------------------------------------------

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- ----------------------------------------------------------
  -- Validation
  -- ----------------------------------------------------------

  if p_product_id is null then
    raise exception 'Product is required';
  end if;

  if p_from_warehouse_id is null
     or p_to_warehouse_id is null then
    raise exception 'Source and destination warehouses are required';
  end if;

  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'Source and destination warehouses must be different';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Transfer quantity must be greater than zero';
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
  -- Validate warehouses
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.warehouses
    where id = p_from_warehouse_id
      and is_active = true
  ) then
    raise exception 'Source warehouse does not exist or is inactive';
  end if;

  if not exists (
    select 1
    from public.warehouses
    where id = p_to_warehouse_id
      and is_active = true
  ) then
    raise exception 'Destination warehouse does not exist or is inactive';
  end if;

  -- ----------------------------------------------------------
  -- Lock source inventory
  -- ----------------------------------------------------------

  select *
  into v_source_inventory
  from public.inventory
  where product_id = p_product_id
    and warehouse_id = p_from_warehouse_id
  for update;

  if not found then
    raise exception 'No inventory exists in the source warehouse';
  end if;

  -- ----------------------------------------------------------
  -- Validate available source stock
  -- ----------------------------------------------------------

  if v_source_inventory.quantity < p_quantity then
    raise exception
      'Insufficient stock. Available quantity: %',
      v_source_inventory.quantity;
  end if;

  if v_source_inventory.quantity
     - v_source_inventory.reserved_quantity
     < p_quantity then
    raise exception
      'Insufficient available stock. Reserved quantity: %',
      v_source_inventory.reserved_quantity;
  end if;

  -- ----------------------------------------------------------
  -- Remove stock from source
  -- ----------------------------------------------------------

  update public.inventory
  set
    quantity = quantity - p_quantity,
    updated_at = timezone('utc', now())
  where id = v_source_inventory.id
  returning *
  into v_source_inventory;

  -- ----------------------------------------------------------
  -- Add stock to destination
  -- ----------------------------------------------------------

  insert into public.inventory (
    product_id,
    warehouse_id,
    quantity,
    reserved_quantity
  )
  values (
    p_product_id,
    p_to_warehouse_id,
    p_quantity,
    0
  )
  on conflict (product_id, warehouse_id)
  do update set
    quantity = public.inventory.quantity + excluded.quantity,
    updated_at = timezone('utc', now())
  returning *
  into v_destination_inventory;

  -- ----------------------------------------------------------
  -- Record source movement
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
    p_from_warehouse_id,
    'transfer_out',
    p_quantity,
    p_reference_id,
    p_reference_number,
    p_notes,
    v_user_id
  );

  -- ----------------------------------------------------------
  -- Record destination movement
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
    p_to_warehouse_id,
    'transfer_in',
    p_quantity,
    p_reference_id,
    p_reference_number,
    p_notes,
    v_user_id
  );

  -- ----------------------------------------------------------
  -- Return both inventory states
  -- ----------------------------------------------------------

  return jsonb_build_object(
    'source_inventory', to_jsonb(v_source_inventory),
    'destination_inventory', to_jsonb(v_destination_inventory)
  );
end;
$$;

-- ============================================================
-- RPC ACCESS
-- ============================================================

grant execute
on function public.transfer_inventory(
  uuid,
  uuid,
  uuid,
  numeric,
  uuid,
  text,
  text
)
to authenticated;

-- ============================================================
-- END
-- ============================================================
