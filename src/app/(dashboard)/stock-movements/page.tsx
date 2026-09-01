"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string | null;
  sku: string | null;
};

type Warehouse = {
  id: string;
  name: string | null;
  code: string | null;
};

type InventoryRow = {
  product_id: string;
  warehouse_id: string;
  quantity: number;
  reserved_quantity: number;
};

type StockMovement = {
  id: string;
  product_id: string;
  warehouse_id: string;
  movement_type: string;
  quantity: number;
  reference_id: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  product: Product | null;
  warehouse: Warehouse | null;
};

type TransferForm = {
  product_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  quantity: string;
  reference_number: string;
  notes: string;
};

const supabase = createClient();

const movementLabels: Record<string, string> = {
  purchase: "Purchase",
  sale: "Sale",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  adjustment: "Adjustment",
  return_in: "Return In",
  return_out: "Return Out",
};

function getMovementLabel(type: string) {
  return (
    movementLabels[type] ??
    type
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function getMovementClass(type: string) {
  if (
    type === "purchase" ||
    type === "transfer_in" ||
    type === "adjustment_in" ||
    type === "return_in"
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (
    type === "sale" ||
    type === "transfer_out" ||
    type === "adjustment_out" ||
    type === "return_out"
  ) {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [showTransferModal, setShowTransferModal] = useState(false);

  const [transferForm, setTransferForm] = useState<TransferForm>({
    product_id: "",
    from_warehouse_id: "",
    to_warehouse_id: "",
    quantity: "",
    reference_number: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [
      movementsResult,
      productsResult,
      warehousesResult,
      inventoryResult,
    ] = await Promise.all([
      supabase
        .from("stock_movements")
        .select(
          `
            id,
            product_id,
            warehouse_id,
            movement_type,
            quantity,
            reference_id,
            reference_number,
            notes,
            created_at,
            product:products (
              id,
              name,
              sku
            ),
            warehouse:warehouses (
              id,
              name,
              code
            )
          `,
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("products")
        .select("id, name, sku")
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("warehouses")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("inventory")
        .select(
          "product_id, warehouse_id, quantity, reserved_quantity",
        ),
    ]);

    if (movementsResult.error) {
      setError(movementsResult.error.message);
      setMovements([]);
      setLoading(false);
      return;
    }

    if (productsResult.error) {
      setError(productsResult.error.message);
    } else {
      setProducts((productsResult.data ?? []) as Product[]);
    }

    if (warehousesResult.error) {
      setError(warehousesResult.error.message);
    } else {
      setWarehouses((warehousesResult.data ?? []) as Warehouse[]);
    }

    if (inventoryResult.error) {
      setError(inventoryResult.error.message);
    } else {
      setInventory(
        (inventoryResult.data ?? []).map((row) => ({
          product_id: String(row.product_id),
          warehouse_id: String(row.warehouse_id),
          quantity: Number(row.quantity ?? 0),
          reserved_quantity: Number(row.reserved_quantity ?? 0),
        })),
      );
    }

    const normalizedMovements: StockMovement[] = (
      movementsResult.data ?? []
    ).map((row) => {
      const rawProduct = row.product;
      const rawWarehouse = row.warehouse;

      const productData = Array.isArray(rawProduct)
        ? rawProduct[0]
        : rawProduct;

      const warehouseData = Array.isArray(rawWarehouse)
        ? rawWarehouse[0]
        : rawWarehouse;

      return {
        id: String(row.id),
        product_id: String(row.product_id),
        warehouse_id: String(row.warehouse_id),
        movement_type: String(row.movement_type),
        quantity: Number(row.quantity ?? 0),
        reference_id: row.reference_id
          ? String(row.reference_id)
          : null,
        reference_number: row.reference_number
          ? String(row.reference_number)
          : null,
        notes: row.notes ? String(row.notes) : null,
        created_at: String(row.created_at),
        product: productData
          ? {
              id: String(productData.id),
              name: productData.name ?? null,
              sku: productData.sku ?? null,
            }
          : null,
        warehouse: warehouseData
          ? {
              id: String(warehouseData.id),
              name: warehouseData.name ?? null,
              code: warehouseData.code ?? null,
            }
          : null,
      };
    });

    setMovements(normalizedMovements);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadData]);

  const filteredMovements = useMemo(() => {
    const query = search.trim().toLowerCase();

    return movements.filter((movement) => {
      const productName = movement.product?.name ?? "";
      const productSku = movement.product?.sku ?? "";
      const warehouseName = movement.warehouse?.name ?? "";
      const warehouseCode = movement.warehouse?.code ?? "";
      const referenceNumber = movement.reference_number ?? "";
      const notes = movement.notes ?? "";

      const matchesSearch =
        !query ||
        productName.toLowerCase().includes(query) ||
        productSku.toLowerCase().includes(query) ||
        warehouseName.toLowerCase().includes(query) ||
        warehouseCode.toLowerCase().includes(query) ||
        referenceNumber.toLowerCase().includes(query) ||
        notes.toLowerCase().includes(query);

      const matchesProduct =
        productFilter === "all" ||
        movement.product_id === productFilter;

      const matchesWarehouse =
        warehouseFilter === "all" ||
        movement.warehouse_id === warehouseFilter;

      const matchesType =
        typeFilter === "all" ||
        movement.movement_type === typeFilter;

      return (
        matchesSearch &&
        matchesProduct &&
        matchesWarehouse &&
        matchesType
      );
    });
  }, [
    movements,
    search,
    productFilter,
    warehouseFilter,
    typeFilter,
  ]);

  const movementTypes = useMemo(() => {
    return Array.from(
      new Set(movements.map((movement) => movement.movement_type)),
    ).sort();
  }, [movements]);

  const availableQuantity = useMemo(() => {
    if (
      !transferForm.product_id ||
      !transferForm.from_warehouse_id
    ) {
      return 0;
    }

    const row = inventory.find(
      (item) =>
        item.product_id === transferForm.product_id &&
        item.warehouse_id === transferForm.from_warehouse_id,
    );

    if (!row) {
      return 0;
    }

    return Math.max(
      0,
      row.quantity - row.reserved_quantity,
    );
  }, [
    inventory,
    transferForm.product_id,
    transferForm.from_warehouse_id,
  ]);

  const incomingQuantity = movements
    .filter((movement) =>
      [
        "purchase",
        "transfer_in",
        "adjustment_in",
        "return_in",
      ].includes(movement.movement_type),
    )
    .reduce(
      (total, movement) => total + movement.quantity,
      0,
    );

  const outgoingQuantity = movements
    .filter((movement) =>
      [
        "sale",
        "transfer_out",
        "adjustment_out",
        "return_out",
      ].includes(movement.movement_type),
    )
    .reduce(
      (total, movement) => total + movement.quantity,
      0,
    );

  const formatNumber = (value: number) =>
    value.toLocaleString(undefined, {
      maximumFractionDigits: 3,
    });

  const formatDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  };

  function openTransferModal() {
    setError("");

    setTransferForm({
      product_id: "",
      from_warehouse_id: "",
      to_warehouse_id: "",
      quantity: "",
      reference_number: "",
      notes: "",
    });

    setShowTransferModal(true);
  }

  function closeTransferModal() {
    if (transferring) {
      return;
    }

    setShowTransferModal(false);
  }

  async function executeTransfer() {
    setError("");

    if (!transferForm.product_id) {
      setError("Select a product.");
      return;
    }

    if (!transferForm.from_warehouse_id) {
      setError("Select the source warehouse.");
      return;
    }

    if (!transferForm.to_warehouse_id) {
      setError("Select the destination warehouse.");
      return;
    }

    if (
      transferForm.from_warehouse_id ===
      transferForm.to_warehouse_id
    ) {
      setError(
        "Source and destination warehouses must be different.",
      );
      return;
    }

    const quantity = Number(transferForm.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a transfer quantity greater than zero.");
      return;
    }

    if (quantity > availableQuantity) {
      setError(
        `Insufficient available stock. Available quantity: ${formatNumber(
          availableQuantity,
        )}.`,
      );
      return;
    }

    setTransferring(true);

    const { error: transferError } = await supabase.rpc(
      "transfer_inventory",
      {
        p_product_id: transferForm.product_id,
        p_from_warehouse_id:
          transferForm.from_warehouse_id,
        p_to_warehouse_id:
          transferForm.to_warehouse_id,
        p_quantity: quantity,
        p_reference_id: null,
        p_reference_number:
          transferForm.reference_number.trim() || null,
        p_notes: transferForm.notes.trim() || null,
      },
    );

    if (transferError) {
      setError(transferError.message);
      setTransferring(false);
      return;
    }

    setShowTransferModal(false);
    setTransferring(false);

    setTransferForm({
      product_id: "",
      from_warehouse_id: "",
      to_warehouse_id: "",
      quantity: "",
      reference_number: "",
      notes: "",
    });

    await loadData();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">
                Inventory Management
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Stock Movements
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Review stock history and transfer inventory between
                warehouses.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <button
                type="button"
                onClick={openTransferModal}
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Transfer Stock
              </button>
            </div>
          </div>
        </header>

        {error && (
          <section className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="font-semibold text-red-800">
              Operation failed
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Total movements"
            value={formatNumber(movements.length)}
            description="Recorded inventory events"
          />

          <StatCard
            title="Incoming quantity"
            value={formatNumber(incomingQuantity)}
            description="Stock added to warehouses"
          />

          <StatCard
            title="Outgoing quantity"
            value={formatNumber(outgoingQuantity)}
            description="Stock removed from warehouses"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="grid gap-3 lg:grid-cols-4">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search product, SKU, warehouse..."
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 lg:col-span-2"
              />

              <select
                value={productFilter}
                onChange={(event) =>
                  setProductFilter(event.target.value)
                }
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">All products</option>

                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name}
                    {product.sku
                      ? ` (${product.sku})`
                      : ""}
                  </option>
                ))}
              </select>

              <select
                value={warehouseFilter}
                onChange={(event) =>
                  setWarehouseFilter(event.target.value)
                }
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">All warehouses</option>

                {warehouses.map((warehouse) => (
                  <option
                    key={warehouse.id}
                    value={warehouse.id}
                  >
                    {warehouse.name}
                    {warehouse.code
                      ? ` (${warehouse.code})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value)
                }
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">
                  All movement types
                </option>

                {movementTypes.map((type) => (
                  <option key={type} value={type}>
                    {getMovementLabel(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && movements.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              Loading stock movements...
            </div>
          ) : !error &&
            filteredMovements.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="text-4xl">↕</div>

              <h2 className="mt-4 text-lg font-semibold">
                No stock movements found
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Product
                    </th>

                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Warehouse
                    </th>

                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Type
                    </th>

                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Quantity
                    </th>

                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Reference
                    </th>

                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Date
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.map((movement) => (
                    <tr
                      key={movement.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {movement.product?.name ??
                            "Unknown product"}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {movement.product?.sku ??
                            "No SKU"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {movement.warehouse?.name ??
                            "Unknown warehouse"}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {movement.warehouse?.code ?? ""}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getMovementClass(
                            movement.movement_type,
                          )}`}
                        >
                          {getMovementLabel(
                            movement.movement_type,
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-bold text-slate-900">
                          {formatNumber(
                            movement.quantity,
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-700">
                          {movement.reference_number ??
                            "—"}
                        </p>

                        {movement.notes && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-slate-500">
                            {movement.notes}
                          </p>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                        {formatDate(movement.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading &&
            !error &&
            filteredMovements.length > 0 && (
              <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-3.5 text-xs text-slate-500">
                Showing {filteredMovements.length} of{" "}
                {movements.length} stock movements.
              </div>
            )}
        </section>
      </div>

      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Transfer Stock
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Move inventory from one warehouse to another.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTransferModal}
                disabled={transferring}
                aria-label="Close"
                className="text-2xl leading-none text-slate-400 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Product
                </span>

                <select
                  value={transferForm.product_id}
                  onChange={(event) =>
                    setTransferForm((current) => ({
                      ...current,
                      product_id: event.target.value,
                    }))
                  }
                  disabled={transferring}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">
                    Select product
                  </option>

                  {products.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.name}
                      {product.sku
                        ? ` (${product.sku})`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    From warehouse
                  </span>

                  <select
                    value={
                      transferForm.from_warehouse_id
                    }
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        from_warehouse_id:
                          event.target.value,
                      }))
                    }
                    disabled={transferring}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">
                      Select source
                    </option>

                    {warehouses.map((warehouse) => (
                      <option
                        key={warehouse.id}
                        value={warehouse.id}
                      >
                        {warehouse.name}
                        {warehouse.code
                          ? ` (${warehouse.code})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    To warehouse
                  </span>

                  <select
                    value={
                      transferForm.to_warehouse_id
                    }
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        to_warehouse_id:
                          event.target.value,
                      }))
                    }
                    disabled={transferring}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">
                      Select destination
                    </option>

                    {warehouses.map((warehouse) => (
                      <option
                        key={warehouse.id}
                        value={warehouse.id}
                        disabled={
                          warehouse.id ===
                          transferForm.from_warehouse_id
                        }
                      >
                        {warehouse.name}
                        {warehouse.code
                          ? ` (${warehouse.code})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-medium text-blue-600">
                  Available source stock
                </p>

                <p className="mt-1 text-xl font-bold text-blue-900">
                  {formatNumber(availableQuantity)}
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Quantity
                </span>

                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={transferForm.quantity}
                  onChange={(event) =>
                    setTransferForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  disabled={transferring}
                  placeholder="Enter quantity"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Reference number
                </span>

                <input
                  type="text"
                  value={
                    transferForm.reference_number
                  }
                  onChange={(event) =>
                    setTransferForm((current) => ({
                      ...current,
                      reference_number:
                        event.target.value,
                    }))
                  }
                  disabled={transferring}
                  placeholder="Optional reference"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Notes
                </span>

                <textarea
                  rows={3}
                  value={transferForm.notes}
                  onChange={(event) =>
                    setTransferForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  disabled={transferring}
                  placeholder="Optional notes"
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeTransferModal}
                  disabled={transferring}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void executeTransfer()}
                  disabled={transferring}
                  className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {transferring
                    ? "Transferring..."
                    : "Transfer Stock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-950">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}