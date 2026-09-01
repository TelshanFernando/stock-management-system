// Corrected implementation using purchase_orders table and its actual columns
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  name: string;
};

type PurchaseOrder = {
  id: string;
  order_number: string;
  supplier_id: string | null;
  warehouse_id: string | null;
  status: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  supplier?: { name: string | null } | null;
};

const supabase = createClient();

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({
    supplier_id: "",
    order_number: "",
    total_amount: "",
    ordered_at: new Date().toISOString().slice(0, 10),
    status: "pending",
  });

  async function loadPurchases() {
    setLoading(true);
    setError("");

    const { data, error: purchasesError } = await supabase
      .from("purchase_orders")
      .select("*, supplier:suppliers(name)")
      .order("created_at", { ascending: false });

    if (purchasesError) {
      setError(purchasesError.message);
      setPurchases([]);
    } else {
      setPurchases((data ?? []) as PurchaseOrder[]);
    }

    setLoading(false);
  }

  async function loadSuppliers() {
    const { data, error: suppliersError } = await supabase
      .from("suppliers")
      .select("id, name")
      .order("name");

    if (suppliersError) {
      setError(suppliersError.message);
      return;
    }

    setSuppliers((data ?? []) as Supplier[]);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadPurchases(), loadSuppliers()]);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const filteredPurchases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return purchases.filter((purchase) => {
      const supplierName = purchase.supplier?.name ?? "";
      const matchesSearch =
        !query ||
        supplierName.toLowerCase().includes(query) ||
        purchase.order_number.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (purchase.status ?? "pending").toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [purchases, search, statusFilter]);

  const totalPurchases = purchases.length;
  const pendingPurchases = purchases.filter(
    (purchase) => (purchase.status ?? "pending").toLowerCase() === "pending"
  ).length;
  const receivedPurchases = purchases.filter(
    (purchase) => (purchase.status ?? "pending").toLowerCase() === "received"
  ).length;

  function openCreateModal() {
    setError("");
    setForm({
      supplier_id: "",
      order_number: "",
      total_amount: "",
      ordered_at: new Date().toISOString().slice(0, 10),
      status: "pending",
    });
    setShowModal(true);
  }

  async function createPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const totalAmount = Number(form.total_amount);

    if (!form.order_number.trim()) {
      setError("Enter a purchase order number.");
      setSaving(false);
      return;
    }

    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      setError("Enter a valid purchase amount.");
      setSaving(false);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      setError(userError.message);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("purchase_orders").insert({
      order_number: form.order_number.trim(),
      supplier_id: form.supplier_id || null,
      status: form.status,
      subtotal: totalAmount,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: totalAmount,
      ordered_at: form.ordered_at,
      created_by: userData.user?.id ?? null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setShowModal(false);
    setSaving(false);
    await loadPurchases();
  }

  async function updateStatus(id: string, status: string) {
    setError("");

    const updateData: { status: string; received_at?: string } = { status };

    if (status === "received") {
      updateData.received_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("purchase_orders")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadPurchases();
  }

  async function deletePurchase(id: string) {
    if (!window.confirm("Delete this purchase order?")) return;

    setError("");
    const { error: deleteError } = await supabase
      .from("purchase_orders")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setPurchases((current) => current.filter((purchase) => purchase.id !== id));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm text-slate-500">Dashboard / Purchases</p>
            <h1 className="text-3xl font-bold">Purchases</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage supplier purchase orders and incoming stock.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            New Purchase
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Total Purchases" value={String(totalPurchases)} />
          <Card title="Pending" value={String(pendingPurchases)} />
          <Card title="Received" value={String(receivedPurchases)} />
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search supplier or order number..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading purchases...
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl">🛒</div>
              <h2 className="mt-4 text-lg font-semibold">No purchases recorded</h2>
              <p className="mt-2 text-sm text-slate-500">
                Create a purchase order to start tracking supplier transactions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Order Number</th>
                    <th className="px-5 py-3">Supplier</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredPurchases.map((purchase) => {
                    const status = (purchase.status ?? "pending").toLowerCase();
                    return (
                      <tr key={purchase.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 font-medium">{purchase.order_number}</td>
                        <td className="px-5 py-4">{purchase.supplier?.name || "—"}</td>
                        <td className="px-5 py-4">
                          {purchase.ordered_at
                            ? new Date(purchase.ordered_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-5 py-4 font-medium">
                          {Number(purchase.total_amount ?? 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize">
                            {status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {status === "pending" && (
                              <button
                                type="button"
                                onClick={() => void updateStatus(purchase.id, "received")}
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
                              >
                                Mark received
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void deletePurchase(purchase.id)}
                              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">New Purchase</h2>
                <p className="text-sm text-slate-500">
                  Record an incoming supplier purchase order.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-2xl text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={createPurchase} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Supplier</span>
                <select
                  value={form.supplier_id}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, supplier_id: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Order Number</span>
                <input
                  required
                  value={form.order_number}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, order_number: event.target.value }))
                  }
                  placeholder="PO-0001"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Amount</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.total_amount}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, total_amount: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Order date</span>
                  <input
                    required
                    type="date"
                    value={form.ordered_at}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, ordered_at: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Create Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}