

// REPLACEMENT BEGINS
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SupplierForm = {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  tax_number: string;
  notes: string;
};

const emptyForm: SupplierForm = {
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  tax_number: "",
  notes: "",
};

export default function SuppliersPage() {
  const [supabase] = useState(() => createClient());
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  async function fetchSuppliers(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);
    setError("");

    const { data, error: suppliersError } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });

    if (suppliersError) {
      setError(suppliersError.message);
    } else {
      setSuppliers(data ?? []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSuppliers();
    }, 0);

    return () => window.clearTimeout(timer);
    // fetchSuppliers intentionally remains outside the dependency list because it is
    // a component-local async loader whose identity is recreated on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreateModal() {
    setEditingSupplier(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(supplier: Supplier) {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      tax_number: supplier.tax_number ?? "",
      notes: supplier.notes ?? "",
    });
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingSupplier(null);
    setForm(emptyForm);
    setError("");
  }

  function updateForm(field: keyof SupplierForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!name) {
      setError("Supplier name is required.");
      setSaving(false);
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      setSaving(false);
      return;
    }

    if (phone && !/^[+\d][\d\s().-]{6,}$/.test(phone)) {
      setError("Please enter a valid phone number.");
      setSaving(false);
      return;
    }

    const payload = {
      name,
      contact_person: form.contact_person.trim() || null,
      email: email || null,
      phone: phone || null,
      address: form.address.trim() || null,
      tax_number: form.tax_number.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editingSupplier) {
      const { data, error: updateError } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editingSupplier.id)
        .select("*")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setSuppliers((current) =>
        current.map((supplier) =>
          supplier.id === editingSupplier.id ? data : supplier,
        ),
      );
      setSuccess("Supplier updated successfully.");
    } else {
      const { data, error: insertError } = await supabase
        .from("suppliers")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setSuppliers((current) => [data, ...current]);
      setSuccess("Supplier created successfully.");
    }

    setSaving(false);
    setShowModal(false);
    setEditingSupplier(null);
    setForm(emptyForm);
  }

  async function toggleSupplierStatus(supplier: Supplier) {
    setError("");
    setSuccess("");

    const nextStatus = !supplier.is_active;
    const { error: updateError } = await supabase
      .from("suppliers")
      .update({ is_active: nextStatus })
      .eq("id", supplier.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuppliers((current) =>
      current.map((item) =>
        item.id === supplier.id ? { ...item, is_active: nextStatus } : item,
      ),
    );
    setSuccess(
      nextStatus
        ? "Supplier activated successfully."
        : "Supplier deactivated successfully.",
    );
  }

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesSearch =
        !query ||
        supplier.name.toLowerCase().includes(query) ||
        (supplier.contact_person ?? "").toLowerCase().includes(query) ||
        (supplier.email ?? "").toLowerCase().includes(query) ||
        (supplier.phone ?? "").toLowerCase().includes(query) ||
        (supplier.tax_number ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && supplier.is_active) ||
        (statusFilter === "inactive" && !supplier.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, suppliers]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.is_active).length,
    [suppliers],
  );
  const inactiveSuppliers = suppliers.length - activeSuppliers;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <span>/</span>
              <span>Suppliers</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage supplier contacts and purchasing relationships.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void fetchSuppliers(true)}
              disabled={refreshing || loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <span className="mr-2 text-lg">+</span>
              Add Supplier
            </button>
          </div>
        </div>

        {error && !showModal && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && !showModal && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Suppliers</p>
            <p className="mt-2 text-3xl font-bold">{suppliers.length}</p>
            <p className="mt-1 text-xs text-slate-500">All supplier records</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Active Suppliers</p>
            <p className="mt-2 text-3xl font-bold">{activeSuppliers}</p>
            <p className="mt-1 text-xs text-slate-500">Available for purchasing</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Inactive Suppliers</p>
            <p className="mt-2 text-3xl font-bold">{inactiveSuppliers}</p>
            <p className="mt-1 text-xs text-slate-500">Archived or disabled suppliers</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search suppliers..."
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 lg:max-w-md"
              />

              <div className="flex gap-2">
                {(["all", "active", "inactive"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                      statusFilter === filter
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
              <p className="mt-4 text-sm text-slate-500">Loading suppliers...</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
                🏢
              </div>
              <h2 className="mt-4 text-lg font-semibold">
                {suppliers.length === 0 ? "No suppliers yet" : "No suppliers found"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {suppliers.length === 0
                  ? "Create your first supplier to start managing purchasing relationships."
                  : "Try changing your search or status filter."}
              </p>
              {suppliers.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Add First Supplier
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Supplier</th>
                    <th className="px-5 py-4 font-semibold">Contact</th>
                    <th className="px-5 py-4 font-semibold">Phone</th>
                    <th className="px-5 py-4 font-semibold">Email</th>
                    <th className="px-5 py-4 font-semibold">Tax Number</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{supplier.name}</p>
                        {supplier.address && (
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                            {supplier.address}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{supplier.contact_person || "—"}</td>
                      <td className="px-5 py-4 text-slate-600">{supplier.phone || "—"}</td>
                      <td className="px-5 py-4 text-slate-600">{supplier.email || "—"}</td>
                      <td className="px-5 py-4 text-slate-600">{supplier.tax_number || "—"}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            supplier.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {supplier.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(supplier)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleSupplierStatus(supplier)}
                            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                              supplier.is_active
                                ? "border-red-200 text-red-600 hover:bg-red-50"
                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            {supplier.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredSuppliers.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
              Showing {filteredSuppliers.length} of {suppliers.length} suppliers
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">{editingSupplier ? "Edit Supplier" : "Add Supplier"}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingSupplier
                    ? "Update the supplier information."
                    : "Add a supplier to your purchasing database."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close supplier dialog"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold" htmlFor="supplier-name">Supplier Name *</label>
                  <input id="supplier-name" required value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="e.g. ABC Auto Parts" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold" htmlFor="supplier-contact">Contact Person</label>
                  <input id="supplier-contact" value={form.contact_person} onChange={(event) => updateForm("contact_person", event.target.value)} placeholder="Contact person name" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold" htmlFor="supplier-email">Email</label>
                  <input id="supplier-email" type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="supplier@example.com" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold" htmlFor="supplier-phone">Phone</label>
                  <input id="supplier-phone" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="+94 77 123 4567" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold" htmlFor="supplier-tax">Tax Number</label>
                  <input id="supplier-tax" value={form.tax_number} onChange={(event) => updateForm("tax_number", event.target.value)} placeholder="Tax / VAT number" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold" htmlFor="supplier-address">Address</label>
                  <input id="supplier-address" value={form.address} onChange={(event) => updateForm("address", event.target.value)} placeholder="Supplier address" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold" htmlFor="supplier-notes">Notes</label>
                <textarea id="supplier-notes" rows={4} value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Optional notes about this supplier..." className="w-full resize-none rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
              </div>

              {error && (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <div className="mt-7 flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button type="button" onClick={closeModal} disabled={saving} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? "Saving..." : editingSupplier ? "Update Supplier" : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}