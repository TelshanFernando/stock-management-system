"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  sku: string;
  selling_price: number | string;
  cost_price: number | string;
};
type Warehouse = { id: string; name: string };
type SaleRow = {
  id: string;
  sale_number: string;
  customer_id: string | null;
  warehouse_id: string | null;
  status: string;
  subtotal: number | string;
  tax_amount: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  notes: string | null;
  sold_at: string | null;
  customer?: { name: string } | null;
  warehouse?: { name: string } | null;
};
type CartItem = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};


const supabase = createClient();

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function getSupabaseErrorMessage(error: { message: string } | null | undefined): string {
  return error?.message ?? "An unexpected error occurred.";
}

export default function SalesPage() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  // Cart and product selection
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("1");
  const [selectedUnitPrice, setSelectedUnitPrice] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "bank_transfer" | "other">("cash");
  const [paymentAmount, setPaymentAmount] = useState("");

  // Fetch data
  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError("");
    const [{ data: salesData, error: salesError }, { data: customerData, error: customerError }, { data: productData, error: productError }, { data: warehouseData, error: warehouseError }] = await Promise.all([
      supabase
        .from("sales")
        .select("id,sale_number,customer_id,warehouse_id,status,subtotal,tax_amount,discount_amount,total_amount,notes,sold_at")
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name").eq("is_active", true).order("name"),
      supabase.from("products").select("id,name,sku,selling_price,cost_price").eq("is_active", true).order("name"),
      supabase.from("warehouses").select("id,name").eq("is_active", true).order("name"),
    ]);
    const customerMap = new Map((customerData ?? []).map((customer) => [customer.id, customer.name]));
    const warehouseMap = new Map((warehouseData ?? []).map((warehouse) => [warehouse.id, warehouse.name]));
    const normalizedSales = (salesData ?? []).map((sale) => ({
      ...sale,
      customer: sale.customer_id ? { name: customerMap.get(sale.customer_id) ?? "" } : null,
      warehouse: sale.warehouse_id ? { name: warehouseMap.get(sale.warehouse_id) ?? "" } : null,
    }));
    if (salesError || customerError || productError || warehouseError) {
      const message = getSupabaseErrorMessage(salesError) || getSupabaseErrorMessage(customerError) || getSupabaseErrorMessage(productError) || getSupabaseErrorMessage(warehouseError);
      setError(message);
      setSales([]);
      setLoading(false);
      return;
    }
    setSales(normalizedSales as SaleRow[]);
    setCustomers(customerData ?? []);
    setProducts((productData ?? []) as Product[]);
    setWarehouses(warehouseData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSales();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSales]);

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sales;
    return sales.filter((sale) => {
      const customerName = sale.customer?.name ?? "";
      const warehouseName = sale.warehouse?.name ?? "";
      return (
        sale.sale_number.toLowerCase().includes(term) ||
        customerName.toLowerCase().includes(term) ||
        warehouseName.toLowerCase().includes(term) ||
        sale.status.toLowerCase().includes(term)
      );
    });
  }, [sales, search]);

  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);

  // Cart logic
  function resetForm() {
    setCustomerId("");
    setWarehouseId("");
    setNotes("");
    setSelectedProductId("");
    setSelectedQuantity("1");
    setSelectedUnitPrice("");
    setCart([]);
    setPaymentMethod("cash");
    setPaymentAmount("");
    setError("");
  }

  function selectProduct(productId: string) {
    setSelectedProductId(productId);
    const selected = products.find((product) => product.id === productId);
    setSelectedQuantity("1");
    setSelectedUnitPrice(selected ? String(selected.selling_price) : "");
  }

  function handleAddToCart() {
    if (!selectedProductId) {
      setError("Please select a product.");
      return;
    }
    const quantity = Number.parseInt(selectedQuantity, 10);
    const unitPrice = Number(selectedUnitPrice);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Enter a valid quantity greater than 0.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError("Enter a valid non-negative unit price.");
      return;
    }
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) {
      setError("Selected product not found.");
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.productId === selectedProductId);
      if (idx >= 0) {
        // merge with existing line
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantity: updated[idx].quantity + quantity,
          unitPrice,
          unitCost: Number(product.cost_price) || 0,
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity,
          unitPrice,
          unitCost: Number(product.cost_price) || 0,
        },
      ];
    });
    setSelectedProductId("");
    setSelectedQuantity("1");
    setSelectedUnitPrice("");
    setError("");
  }

  function handleRemoveCartLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function handleEditCartLine(index: number, field: "quantity" | "unitPrice", value: string) {
    setCart((prev) => {
      const updated = [...prev];
      if (field === "quantity") {
        const q = Number.parseInt(value, 10);
        if (Number.isInteger(q) && q > 0) {
          updated[index] = { ...updated[index], quantity: q };
        }
      } else if (field === "unitPrice") {
        const p = Number(value);
        if (Number.isFinite(p) && p >= 0) {
          updated[index] = { ...updated[index], unitPrice: p };
        }
      }
      return updated;
    });
  }

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), [cart]);
  const total = subtotal; // tax and discount are zero in this phase
  const paymentAmountNum = Number(paymentAmount);
  const change = Number.isFinite(paymentAmountNum) ? paymentAmountNum - total : 0;

  // Sale creation and workflow
  // RPC result type
  type CompleteSaleResult = { sale_id: string; sale_number: string };

  async function createSale() {
    setError("");
    if (!warehouseId) {
      setError("Please select a warehouse.");
      return;
    }
    if (cart.length === 0) {
      setError("Add at least one item to the cart.");
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      setError("Cart total must be greater than zero.");
      return;
    }
    if (!paymentMethod) {
      setError("Please select a payment method.");
      return;
    }
    if (!Number.isFinite(paymentAmountNum) || paymentAmountNum < total) {
      setError("Payment amount must be at least the sale total.");
      return;
    }
    setSaving(true);

    // Inventory check (keep as before)
    const productIds = cart.map((item) => item.productId);
    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("inventory")
      .select("product_id,quantity")
      .eq("warehouse_id", warehouseId)
      .in("product_id", productIds);
    if (inventoryError) {
      setError(getSupabaseErrorMessage(inventoryError));
      setSaving(false);
      return;
    }
    const inventoryMap = new Map<string, number>();
    if (inventoryRows) {
      for (const row of inventoryRows) {
        inventoryMap.set(row.product_id, Number(row.quantity));
      }
    }
    // Check for insufficient inventory
    const insufficient: string[] = [];
    for (const item of cart) {
      const available = inventoryMap.get(item.productId) ?? 0;
      if (item.quantity > available) {
        insufficient.push(`${item.name} (SKU: ${item.sku}) - Available: ${available}, Needed: ${item.quantity}`);
      }
    }
    if (insufficient.length > 0) {
      setError(`Insufficient inventory for: ${insufficient.join("; ")}`);
      setSaving(false);
      return;
    }

    // Call complete_sale RPC
    const salePayload = {
      customer_id: customerId || null,
      warehouse_id: warehouseId,
      notes: notes.trim() || null,
      subtotal,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: total,
      payment_method: paymentMethod,
      payment_amount: paymentAmountNum,
      items: cart.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        unit_cost: item.unitCost,
        discount_amount: 0,
        line_total: item.quantity * item.unitPrice,
        cost_total: item.quantity * item.unitCost,
      })),
    };
    const { data: rpcResult, error: rpcError } = await supabase.rpc("complete_sale", { p_sale: salePayload });
    if (rpcError) {
      setError(getSupabaseErrorMessage(rpcError));
      setSaving(false);
      return;
    }
    // The RPC succeeded; the returned sale identifier is not needed by this page.
    void (rpcResult as CompleteSaleResult | null);
    // Success!
    resetForm();
    setShowModal(false);
    setSaving(false);
    await fetchSales();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm text-slate-500">Dashboard / Sales</p>
            <h1 className="text-3xl font-bold">Sales</h1>
            <p className="mt-1 text-sm text-slate-500">Manage sales transactions and customer orders.</p>
          </div>
          <button type="button" onClick={() => setShowModal(true)} className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            + New Sale
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Total Sales" value={String(sales.length)} />
          <Card title="Orders" value={String(sales.length)} />
          <Card title="Revenue" value={`LKR ${revenue.toFixed(2)}`} />
        </div>

        {error && !showModal && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Sales Transactions</h2>
              <p className="mt-1 text-sm text-slate-500">{filteredSales.length} transaction(s)</p>
            </div>
            <div className="flex gap-2">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice or customer..." className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 sm:w-72" />
              <button type="button" onClick={() => void fetchSales()} disabled={loading} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Refresh</button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading sales...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl">💰</div>
              <h2 className="mt-4 text-lg font-semibold">No sales recorded</h2>
              <p className="mt-2 text-sm text-slate-500">Create a sale to start tracking transactions.</p>
              <button type="button" onClick={() => setShowModal(true)} className="mt-5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Create First Sale</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Invoice</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Warehouse</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-medium">{sale.sale_number}</td>
                      <td className="px-5 py-4">{sale.customer?.name ?? "Walk-in customer"}</td>
                      <td className="px-5 py-4">{sale.warehouse?.name ?? "—"}</td>
                      <td className="px-5 py-4">LKR {Number(sale.total_amount || 0).toFixed(2)}</td>
                      <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{sale.status}</span></td>
                      <td className="px-5 py-4 text-slate-500">{sale.sold_at ? new Date(sale.sold_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">New Sale (POS)</h2>
              <button type="button" onClick={() => { resetForm(); setShowModal(false); }} className="text-2xl leading-none text-slate-400 hover:text-slate-700" aria-label="Close">×</button>
            </div>
            {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Customer</span>
                  <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500">
                    <option value="">Walk-in customer</option>
                    {customers.map((customerOption) => <option key={customerOption.id} value={customerOption.id}>{customerOption.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Warehouse *</span>
                  <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500">
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Notes</span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500" />
                </label>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <label className="col-span-2 block">
                    <span className="mb-1.5 block text-sm font-medium">Product</span>
                    <select value={selectedProductId} onChange={(e) => selectProduct(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500">
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Qty</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={selectedQuantity}
                      onChange={(e) => setSelectedQuantity(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="col-span-2 block">
                    <span className="mb-1.5 block text-sm font-medium">Unit Price (LKR)</span>
                    <input type="number" min="0" step="0.01" value={selectedUnitPrice} onChange={(e) => setSelectedUnitPrice(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500" />
                  </label>
                  <button type="button" onClick={handleAddToCart} className="mt-6 w-full rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Add</button>
                </div>
                <div className="mt-2">
                  <div className="text-sm font-semibold mb-1">Cart</div>
                  {cart.length === 0 ? (
                    <div className="text-slate-400 text-xs">No items in cart.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <th className="py-1 px-2">Product</th>
                            <th className="py-1 px-2">SKU</th>
                            <th className="py-1 px-2">Qty</th>
                            <th className="py-1 px-2">Unit Price</th>
                            <th className="py-1 px-2">Unit Cost</th>
                            <th className="py-1 px-2">Total</th>
                            <th className="py-1 px-2">Profit</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {cart.map((item, idx) => (
                            <tr key={item.productId}>
                              <td className="py-1 px-2">{item.name}</td>
                              <td className="py-1 px-2">{item.sku}</td>
                              <td className="py-1 px-2">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  inputMode="numeric"
                                  value={item.quantity}
                                  onChange={(e) => handleEditCartLine(idx, "quantity", e.target.value)}
                                  className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs"
                                />
                              </td>
                              <td className="py-1 px-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => handleEditCartLine(idx, "unitPrice", e.target.value)}
                                  className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs"
                                />
                              </td>
                              <td className="py-1 px-2">{item.unitCost.toFixed(2)}</td>
                              <td className="py-1 px-2">{(item.quantity * item.unitPrice).toFixed(2)}</td>
                              <td className="py-1 px-2 font-semibold">
                                {((item.unitPrice - item.unitCost) * item.quantity).toFixed(2)}
                              </td>
                              <td className="py-1 px-2">
                                <button type="button" onClick={() => handleRemoveCartLine(idx)} className="text-red-500 hover:underline text-xs">Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-right text-sm">
                  <div>Subtotal: <span className="font-semibold">LKR {subtotal.toFixed(2)}</span></div>
                  <div>Tax: <span className="font-semibold">LKR 0.00</span></div>
                  <div>Discount: <span className="font-semibold">LKR 0.00</span></div>
                  <div>Total: <span className="font-bold text-lg">LKR {total.toFixed(2)}</span></div>
                  <div className="mt-1">
                    COGS: <span className="font-semibold text-amber-700">
                      LKR {cart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    Gross Profit: <span className="font-bold text-emerald-700">
                      LKR {cart.reduce((sum, item) => sum + (item.unitPrice - item.unitCost) * item.quantity, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Payment Method *</span>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "cash" | "card" | "bank_transfer" | "other")} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Payment Amount *</span>
                  <input
                    type="number"
                    min={total}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500"
                  />
                </label>
                <div className="mt-1 text-sm">
                  Change: <span className={change < 0 ? "text-red-600" : "text-green-700 font-semibold"}>LKR {change >= 0 ? change.toFixed(2) : "0.00"}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { resetForm(); setShowModal(false); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void createSale()} disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Processing..." : "Complete Sale"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}