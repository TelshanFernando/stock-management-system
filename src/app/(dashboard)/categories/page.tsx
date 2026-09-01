"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CategoryForm = {
  name: string;
  description: string;
};

const emptyForm: CategoryForm = {
  name: "",
  description: "",
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function fetchCategories() {
      setLoading(true);
      setError("");

      const { data, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (categoriesError) {
        setError(categoriesError.message);
        setCategories([]);
      } else {
        setCategories(data ?? []);
      }

      setLoading(false);
    }

    void fetchCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  function openCreateModal() {
    setEditingCategory(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    setForm({
      name: category.name,
      description: category.description ?? "",
    });
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingCategory(null);
    setForm(emptyForm);
  }

  function updateForm(field: keyof CategoryForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const name = form.name.trim();
    const description = form.description.trim() || null;

    if (!name) {
      setError("Category name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const supabase = createClient();

    if (editingCategory) {
      const { data, error: updateError } = await supabase
        .from("categories")
        .update({ name, description })
        .eq("id", editingCategory.id)
        .select("*")
        .single();

      if (updateError) {
        setError(
          updateError.code === "23505"
            ? "A category with this name already exists."
            : updateError.message
        );
        setSaving(false);
        return;
      }

      setCategories((current) =>
        current.map((category) =>
          category.id === editingCategory.id ? data : category
        )
      );
      setSuccess("Category updated successfully.");
    } else {
      const { data, error: insertError } = await supabase
        .from("categories")
        .insert({ name, description })
        .select("*")
        .single();

      if (insertError) {
        setError(
          insertError.code === "23505"
            ? "A category with this name already exists."
            : insertError.message
        );
        setSaving(false);
        return;
      }

      setCategories((current) => [data, ...current]);
      setSuccess("Category created successfully.");
    }

    setSaving(false);
    setShowModal(false);
    setEditingCategory(null);
    setForm(emptyForm);
  }

  async function toggleCategoryStatus(category: Category) {
    if (updatingId) return;

    setUpdatingId(category.id);
    setError("");
    setSuccess("");

    const supabase = createClient();
    const nextStatus = !category.is_active;

    const { error: updateError } = await supabase
      .from("categories")
      .update({ is_active: nextStatus })
      .eq("id", category.id);

    if (updateError) {
      setError(updateError.message);
      setUpdatingId(null);
      return;
    }

    setCategories((current) =>
      current.map((item) =>
        item.id === category.id
          ? { ...item, is_active: nextStatus }
          : item
      )
    );

    setSuccess(
      nextStatus
        ? "Category activated successfully."
        : "Category deactivated successfully."
    );
    setUpdatingId(null);
  }

  const filteredCategories = categories.filter((category) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      category.name.toLowerCase().includes(query) ||
      (category.description ?? "").toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && category.is_active) ||
      (statusFilter === "inactive" && !category.is_active);

    return matchesSearch && matchesStatus;
  });

  const activeCategories = categories.filter((category) => category.is_active).length;
  const inactiveCategories = categories.length - activeCategories;

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium" }).format(
      new Date(value)
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Catalogue</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Categories
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize your products into clear, manageable categories.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <span className="text-lg leading-none">+</span>
          Add Category
        </button>
      </header>

      {error && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="font-semibold text-red-600 hover:text-red-800">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")} className="font-semibold text-emerald-600 hover:text-emerald-800">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Categories</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{categories.length}</p>
          <p className="mt-1 text-xs text-slate-500">All catalogue categories</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Active Categories</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{activeCategories}</p>
          <p className="mt-1 text-xs text-slate-500">Available for products</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Inactive Categories</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{inactiveCategories}</p>
          <p className="mt-1 text-xs text-slate-500">Archived or disabled</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search categories..."
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="flex flex-wrap gap-2">
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
            <p className="mt-4 text-sm text-slate-500">Loading categories...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">🗂️</div>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">
              {categories.length === 0 ? "No categories yet" : "No categories found"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {categories.length === 0
                ? "Create your first category to organize your product catalogue."
                : "Try changing your search or status filter."}
            </p>
            {categories.length === 0 && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Add First Category
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Category</th>
                  <th className="px-5 py-4 font-semibold">Description</th>
                  <th className="px-5 py-4 font-semibold">Created</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{category.name}</p>
                    </td>
                    <td className="max-w-md px-5 py-4 text-slate-600">
                      {category.description || "No description"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(category.created_at)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${category.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {category.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(category)}
                          disabled={updatingId === category.id}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleCategoryStatus(category)}
                          disabled={updatingId !== null}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${category.is_active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                        >
                          {updatingId === category.id ? "Saving..." : category.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredCategories.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
            Showing {filteredCategories.length} of {categories.length} categories
          </div>
        )}
      </section>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) closeModal();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{editingCategory ? "Edit Category" : "Add Category"}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingCategory ? "Update the category information." : "Create a category for your product catalogue."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close modal"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div>
                <label htmlFor="category-name" className="mb-2 block text-sm font-semibold text-slate-900">Category Name *</label>
                <input
                  id="category-name"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="e.g. Electronics"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="mt-5">
                <label htmlFor="category-description" className="mb-2 block text-sm font-semibold text-slate-900">Description</label>
                <textarea
                  id="category-description"
                  rows={4}
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Optional category description..."
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {error && (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <div className="mt-7 flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button type="button" onClick={closeModal} disabled={saving} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
