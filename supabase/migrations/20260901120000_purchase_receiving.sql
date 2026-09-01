-- ============================================================
-- STOCK MANAGEMENT SYSTEM
-- Phase 4: Purchase Receiving & Atomic Inventory Increase
-- ============================================================

create or replace function public.receive_purchase(
  p_purchase_order_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_order public.purchase_orders;
  v_item jsonb;

  v_purchase_item public.purchase_items;
  v_inventory public.inventory;

  v_item_id uuid;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_receive_quantity numeric(14,3);

  v_new_received_quantity numeric(14,3);
  v_total_quantity numeric(14,3);
  v_total_received numeric(14,3);

  v_processed_items integer := 0;
begin
  -- ==========================================================
  -- Authentication
  -- ==========================================================

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- ==========================================================
  -- Validate input
  -- ==========================================================

  if p_purchase_order_id is null then
    raise exception 'Purchase order is required';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception 'At least one purchase item is required';
  end if;

  -- ==========================================================
  -- Lock purchase order
  -- ==========================================================

  select *
  into v_order
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if not found then
    raise exception 'Purchase order does not exist';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Cancelled purchase orders cannot be received';
  end if;

  if v_order.status = 'received' then
    raise exception 'Fully received purchase orders cannot be received again';
  end if;

  if v_order.warehouse_id is null then
    raise exception 'Purchase order has no warehouse';
  end if;

  v_warehouse_id := v_order.warehouse_id;

  -- ==========================================================
  -- Validate warehouse
  -- ==========================================================

  if not exists (
    select 1
    from public.warehouses
    where id = v_warehouse_id
      and is_active = true
  ) then
    raise exception 'Purchase warehouse does not exist or is inactive';
  end if;

  -- ==========================================================
  -- Process receiving items
  -- ==========================================================

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop

    v_item_id :=
      nullif(v_item->>'purchase_item_id', '')::uuid;

    v_receive_quantity :=
      coalesce((v_item->>'quantity')::numeric, 0);

    if v_item_id is null then
      raise exception 'Purchase item is required';
    end if;

    if v_receive_quantity <= 0 then
      raise exception 'Receive quantity must be greater than zero';
    end if;

    -- ----------------------------------------------------------
    -- Lock purchase item
    -- ----------------------------------------------------------

    select *
    into v_purchase_item
    from public.purchase_items
    where id = v_item_id
      and purchase_order_id = p_purchase_order_id
    for update;

    if not found then
      raise exception
        'Purchase item does not belong to this purchase order';
    end if;

    -- ----------------------------------------------------------
    -- Validate remaining quantity
    -- ----------------------------------------------------------

    if v_purchase_item.received_quantity
       + v_receive_quantity
       > v_purchase_item.quantity
    then
      raise exception
        'Receive quantity exceeds remaining quantity for purchase item %',
        v_item_id;
    end if;

    v_product_id := v_purchase_item.product_id;

    -- ----------------------------------------------------------
    -- Lock/create inventory row
    -- ----------------------------------------------------------

    select *
    into v_inventory
    from public.inventory
    where product_id = v_product_id
      and warehouse_id = v_warehouse_id
    for update;

    if not found then
      insert into public.inventory (
        product_id,
        warehouse_id,
        quantity,
        reserved_quantity
      )
      values (
        v_product_id,
        v_warehouse_id,
        v_receive_quantity,
        0
      )
      returning *
      into v_inventory;
    else
      update public.inventory
      set
        quantity = quantity + v_receive_quantity,
        updated_at = timezone('utc', now())
      where id = v_inventory.id
      returning *
      into v_inventory;
    end if;

    -- ----------------------------------------------------------
    -- Update received quantity
    -- ----------------------------------------------------------

    v_new_received_quantity :=
      v_purchase_item.received_quantity
      + v_receive_quantity;

    update public.purchase_items
    set received_quantity = v_new_received_quantity
    where id = v_purchase_item.id;

    -- ----------------------------------------------------------
    -- Record stock movement
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
      v_product_id,
      v_warehouse_id,
      'purchase',
      v_receive_quantity,
      v_order.id,
      v_order.order_number,
      'Purchase stock received',
      v_user_id
    );

    v_processed_items := v_processed_items + 1;

  end loop;

  -- ==========================================================
  -- Recalculate purchase order status
  -- ==========================================================

  select
    coalesce(sum(quantity), 0),
    coalesce(sum(received_quantity), 0)
  into
    v_total_quantity,
    v_total_received
  from public.purchase_items
  where purchase_order_id = p_purchase_order_id;

  if v_total_quantity > 0
     and v_total_received >= v_total_quantity
  then

    update public.purchase_orders
    set
      status = 'received',
      received_at = coalesce(
        received_at,
        timezone('utc', now())
      ),
      updated_at = timezone('utc', now())
    where id = p_purchase_order_id;

  elsif v_total_received > 0 then

    update public.purchase_orders
    set
      status = 'partially_received',
      received_at = null,
      updated_at = timezone('utc', now())
    where id = p_purchase_order_id;

  end if;

  -- ==========================================================
  -- Return result
  -- ==========================================================

  return jsonb_build_object(
    'purchase_order_id', p_purchase_order_id,
    'status',
      (
        select status::text
        from public.purchase_orders
        where id = p_purchase_order_id
      ),
    'processed_items', v_processed_items,
    'total_quantity', v_total_quantity,
    'total_received', v_total_received
  );

exception
  when others then
    raise;
end;
$$;

-- ============================================================
-- RPC ACCESS
-- ============================================================

grant execute
on function public.receive_purchase(uuid, jsonb)
to authenticated;

-- ============================================================
-- END
-- ============================================================
