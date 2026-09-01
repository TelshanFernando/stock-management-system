-- ============================================================
-- STOCK MANAGEMENT SYSTEM
-- Phase 3: Sales & Atomic Stock Deduction
-- ============================================================

create or replace function public.complete_sale(
  p_sale jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_sale_id uuid;
  v_sale_number text;
  v_customer_id uuid;
  v_warehouse_id uuid;
  v_notes text;
  v_subtotal numeric(14,2);
  v_tax_amount numeric(14,2);
  v_discount_amount numeric(14,2);
  v_total_amount numeric(14,2);
  v_payment_method text;
  v_payment_amount numeric(14,2);

  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric(14,3);
  v_unit_price numeric(14,2);
  v_discount_amount numeric(14,2);
  v_unit_cost numeric(14,2);

  v_product_name text;
  v_product_sku text;
  v_inventory public.inventory;

  v_sale_item_count integer := 0;
  v_movement_id uuid;
  v_sale_item_id uuid;
  v_payment_id uuid;

  v_calculated_subtotal numeric(14,2) := 0;
begin
  -- ==========================================================
  -- Authentication
  -- ==========================================================

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- ==========================================================
  -- Validate payload
  -- ==========================================================

  if p_sale is null then
    raise exception 'Sale data is required';
  end if;

  if jsonb_typeof(p_sale) <> 'object' then
    raise exception 'Invalid sale data';
  end if;

  -- ==========================================================
  -- Extract sale header
  -- ==========================================================

  v_customer_id :=
    nullif(p_sale->>'customer_id', '')::uuid;

  v_warehouse_id :=
    nullif(p_sale->>'warehouse_id', '')::uuid;

  v_notes :=
    nullif(trim(p_sale->>'notes'), '');

  v_subtotal :=
    coalesce((p_sale->>'subtotal')::numeric, 0);

  v_tax_amount :=
    coalesce((p_sale->>'tax_amount')::numeric, 0);

  v_discount_amount :=
    coalesce((p_sale->>'discount_amount')::numeric, 0);

  v_total_amount :=
    coalesce((p_sale->>'total_amount')::numeric, 0);

  v_payment_method :=
    nullif(trim(p_sale->>'payment_method'), '');

  v_payment_amount :=
    coalesce((p_sale->>'payment_amount')::numeric, 0);

  -- ==========================================================
  -- Basic validation
  -- ==========================================================

  if v_warehouse_id is null then
    raise exception 'Warehouse is required';
  end if;

  if v_subtotal < 0 then
    raise exception 'Subtotal cannot be negative';
  end if;

  if v_tax_amount < 0 then
    raise exception 'Tax amount cannot be negative';
  end if;

  if v_discount_amount < 0 then
    raise exception 'Discount amount cannot be negative';
  end if;

  if v_total_amount < 0 then
    raise exception 'Total amount cannot be negative';
  end if;

  if v_payment_method is null then
    raise exception 'Payment method is required';
  end if;

  if v_payment_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if v_payment_amount < v_total_amount then
    raise exception
      'Payment amount is less than sale total';
  end if;

  if jsonb_typeof(p_sale->'items') <> 'array' then
    raise exception 'Sale items are required';
  end if;

  if jsonb_array_length(p_sale->'items') = 0 then
    raise exception 'At least one sale item is required';
  end if;

  -- ==========================================================
  -- Validate warehouse
  -- ==========================================================

  if not exists (
    select 1
    from public.warehouses
    where id = v_warehouse_id
      and is_active = true
  ) then
    raise exception 'Warehouse does not exist or is inactive';
  end if;

  -- ==========================================================
  -- Validate customer if supplied
  -- ==========================================================

  if v_customer_id is not null
     and not exists (
       select 1
       from public.customers
       where id = v_customer_id
     )
  then
    raise exception 'Customer does not exist';
  end if;

  -- ==========================================================
  -- Generate sale number
  -- ==========================================================

  v_sale_number :=
    'SAL-' ||
    to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDDHH24MISSMS') ||
    '-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  -- ==========================================================
  -- Validate all items and lock inventory rows
  -- ==========================================================

  for v_item in
    select value
    from jsonb_array_elements(p_sale->'items')
  loop

    v_product_id :=
      nullif(v_item->>'product_id', '')::uuid;

    v_quantity :=
      coalesce((v_item->>'quantity')::numeric, 0);

    v_unit_price :=
      coalesce((v_item->>'unit_price')::numeric, 0);

    v_discount_amount :=
      coalesce((v_item->>'discount_amount')::numeric, 0);

    if v_product_id is null then
      raise exception 'Sale item product is required';
    end if;

    if v_quantity <= 0 then
      raise exception
        'Sale quantity must be greater than zero';
    end if;

    if v_unit_price < 0 then
      raise exception
        'Sale unit price cannot be negative';
    end if;

    if v_discount_amount < 0 then
      raise exception
        'Sale item discount cannot be negative';
    end if;

    if v_discount_amount > v_quantity * v_unit_price then
      raise exception
        'Sale item discount cannot exceed line value';
    end if;

    -- ----------------------------------------------------------
    -- Product validation
    -- ----------------------------------------------------------

    select
      name,
      sku,
      cost_price
    into
      v_product_name,
      v_product_sku,
      v_unit_cost
    from public.products
    where id = v_product_id
      and is_active = true;

    if not found then
      raise exception
        'Product does not exist or is inactive: %',
        v_product_id;
    end if;

    -- ----------------------------------------------------------
    -- Lock inventory
    -- ----------------------------------------------------------

    select *
    into v_inventory
    from public.inventory
    where product_id = v_product_id
      and warehouse_id = v_warehouse_id
    for update;

    if not found then
      raise exception
        'No inventory exists for product % (% / %) in selected warehouse',
        v_product_name,
        v_product_sku,
        v_product_id;
    end if;

    -- ----------------------------------------------------------
    -- Validate available stock
    -- ----------------------------------------------------------

    if v_inventory.quantity - v_inventory.reserved_quantity
       < v_quantity
    then
      raise exception
        'Insufficient available stock for % (%). Available: %, Needed: %',
        v_product_name,
        v_product_sku,
        v_inventory.quantity - v_inventory.reserved_quantity,
        v_quantity;
    end if;

    v_sale_item_count :=
      v_sale_item_count + 1;

    v_calculated_subtotal :=
      v_calculated_subtotal +
      round(
        (v_quantity * v_unit_price) - v_discount_amount,
        2
      );

  end loop;

  -- ==========================================================
  -- Validate subtotal against cart
  -- ==========================================================

  if round(v_calculated_subtotal, 2) <> round(v_subtotal, 2) then
    raise exception
      'Sale subtotal does not match sale items';
  end if;

  -- ==========================================================
  -- Validate total
  -- ==========================================================

  if round(
       v_subtotal + v_tax_amount - v_discount_amount,
       2
     ) <> round(v_total_amount, 2)
  then
    raise exception
      'Sale total does not match subtotal, tax and discount';
  end if;

  -- ==========================================================
  -- Create sale
  -- ==========================================================

  insert into public.sales (
    sale_number,
    customer_id,
    warehouse_id,
    status,
    subtotal,
    tax_amount,
    discount_amount,
    total_amount,
    notes,
    sold_at,
    created_by
  )
  values (
    v_sale_number,
    v_customer_id,
    v_warehouse_id,
    'completed',
    v_subtotal,
    v_tax_amount,
    v_discount_amount,
    v_total_amount,
    v_notes,
    timezone('utc', now()),
    v_user_id
  )
  returning id into v_sale_id;

  -- ==========================================================
  -- Process sale items
  -- ==========================================================

  for v_item in
    select value
    from jsonb_array_elements(p_sale->'items')
  loop

    v_product_id :=
      nullif(v_item->>'product_id', '')::uuid;

    v_quantity :=
      (v_item->>'quantity')::numeric;

    v_unit_price :=
      (v_item->>'unit_price')::numeric;

    v_discount_amount :=
      coalesce((v_item->>'discount_amount')::numeric, 0);

    v_unit_cost :=
      coalesce(
        (select cost_price
         from public.products
         where id = v_product_id),
        0
      );

    -- ----------------------------------------------------------
    -- Insert sale item
    -- ----------------------------------------------------------

    insert into public.sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      discount_amount
    )
    values (
      v_sale_id,
      v_product_id,
      v_quantity,
      v_unit_price,
      v_discount_amount
    )
    returning id into v_sale_item_id;

    -- ----------------------------------------------------------
    -- Deduct stock
    -- ----------------------------------------------------------

    update public.inventory
    set
      quantity = quantity - v_quantity,
      updated_at = timezone('utc', now())
    where product_id = v_product_id
      and warehouse_id = v_warehouse_id;

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
      'sale',
      v_quantity,
      v_sale_id,
      v_sale_number,
      'Sale completed',
      v_user_id
    )
    returning id into v_movement_id;

  end loop;

  -- ==========================================================
  -- Record payment
  -- ==========================================================

  insert into public.payments (
    sale_id,
    amount,
    payment_method,
    reference,
    paid_at,
    created_by
  )
  values (
    v_sale_id,
    v_payment_amount,
    v_payment_method,
    nullif(p_sale->>'payment_reference', ''),
    timezone('utc', now()),
    v_user_id
  )
  returning id into v_payment_id;

  -- ==========================================================
  -- Return completed sale
  -- ==========================================================

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'status', 'completed',
    'customer_id', v_customer_id,
    'warehouse_id', v_warehouse_id,
    'item_count', v_sale_item_count,
    'subtotal', v_subtotal,
    'tax_amount', v_tax_amount,
    'discount_amount', v_discount_amount,
    'total_amount', v_total_amount,
    'payment_amount', v_payment_amount,
    'payment_method', v_payment_method,
    'payment_id', v_payment_id
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
on function public.complete_sale(jsonb)
to authenticated;

-- ============================================================
-- END
-- ============================================================
