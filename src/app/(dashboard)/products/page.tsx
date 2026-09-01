"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  supplier_id: string | null;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  reorder_quantity: number;
  unit: string;
  is_active: boolean;
  created_at: string;
};

type Category = {
  id: string;
  name: string;
};

type Supplier = {
  id: string;
  name: string;
};

type ProductForm = {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  category_id: string;
  supplier_id: string;
  cost_price: string;
  selling_price: string;
  unit: string;
  initial_stock: string;
};

const emptyForm: ProductForm = {
  sku: "",
  barcode: "",
  name: "",
  description: "",
  category_id: "",
  supplier_id: "",
  cost_price: "",
  selling_price: "",
  unit: "",
  initial_stock: "0",
};

function generateSkuBaseFromName(name: string) {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) return "";

  return `SKU-${normalized}`;
}

async function generateUniqueSku(
  supabase: ReturnType<typeof createClient>,
  name: string,
  excludeProductId?: string
) {
  const baseSku = generateSkuBaseFromName(name);

  if (!baseSku) return "";

  let candidate = baseSku;
  let suffix = 2;

  while (true) {
    let query = supabase
      .from("products")
      .select("id")
      .eq("sku", candidate)
      .limit(1);

    if (excludeProductId) {
      query = query.neq("id", excludeProductId);
    }

    const { data, error: skuCheckError } = await query;

    if (skuCheckError) {
      throw new Error(skuCheckError.message);
    }

    if (!data || data.length === 0) {
      return candidate;
    }

    candidate = `${baseSku}-${suffix}`;
    suffix += 1;
  }
}

export default function ProductsPage() {
  const [supabase] = useState(() => createClient());
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialData() {
      setLoading(true);
      setError("");

      const [
        productsResult,
        categoriesResult,
        suppliersResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("categories")
          .select("id, name")
          .order("name"),

        supabase
          .from("suppliers")
          .select("id, name")
          .order("name"),
      ]);

      if (cancelled) return;

      if (productsResult.error) {
        setError(productsResult.error.message);
      } else {
        setProducts((productsResult.data ?? []) as Product[]);
      }

      if (categoriesResult.error) {
        setError(
          (current) => current || categoriesResult.error.message
        );
      } else {
        setCategories(
          (categoriesResult.data ?? []) as Category[]
        );
      }

      if (suppliersResult.error) {
        setError(
          (current) => current || suppliersResult.error.message
        );
      } else {
        setSuppliers(
          (suppliersResult.data ?? []) as Supplier[]
        );
      }

      setLoading(false);
    }

    void fetchInitialData();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function loadData() {
    setLoading(true);
    setError("");

    const [
      productsResult,
      categoriesResult,
      suppliersResult,
    ] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("categories")
        .select("id, name")
        .order("name"),

      supabase
        .from("suppliers")
        .select("id, name")
        .order("name"),
    ]);

    if (productsResult.error) {
      setError(productsResult.error.message);
    } else {
      setProducts((productsResult.data ?? []) as Product[]);
    }

    if (categoriesResult.error) {
      setError(
        (current) => current || categoriesResult.error.message
      );
    } else {
      setCategories(
        (categoriesResult.data ?? []) as Category[]
      );
    }

    if (suppliersResult.error) {
      setError(
        (current) => current || suppliersResult.error.message
      );
    } else {
      setSuppliers(
        (suppliersResult.data ?? []) as Supplier[]
      );
    }

    setLoading(false);
  }

  function openCreateModal() {
    setEditingProduct(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);

    setForm({
      sku: product.sku,
      barcode: product.barcode ?? "",
      name: product.name,
      description: product.description ?? "",
      category_id: product.category_id ?? "",
      supplier_id: product.supplier_id ?? "",
      cost_price: String(product.cost_price),
      selling_price: String(product.selling_price),
      unit: product.unit,
      initial_stock: "0",
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingProduct(null);
    setForm(emptyForm);
  }

  function updateForm(
    field: keyof ProductForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    const name = form.name.trim();

    let sku = form.sku.trim();

    try {
      sku = await generateUniqueSku(
        supabase,
        name,
        editingProduct?.id
      );
    } catch (skuError) {
      setError(
        skuError instanceof Error
          ? skuError.message
          : "Unable to generate SKU."
      );

      setSaving(false);
      return;
    }

    const barcode = form.barcode.trim() || null;
    const description = form.description.trim() || null;
    const unit = form.unit.trim();

    const costPrice = Number(form.cost_price);
    const sellingPrice = Number(form.selling_price);
    const initialStock = Number(form.initial_stock);

    if (!sku || !name || !unit) {
      setError(
        "SKU, product name, and unit are required."
      );
      setSaving(false);
      return;
    }

    if (
      !Number.isFinite(costPrice) ||
      !Number.isFinite(sellingPrice) ||
      !Number.isFinite(initialStock)
    ) {
      setError("Please enter valid numeric values.");
      setSaving(false);
      return;
    }

    if (
      costPrice < 0 ||
      sellingPrice < 0 ||
      initialStock < 0
    ) {
      setError(
        "Prices and initial stock cannot be negative."
      );
      setSaving(false);
      return;
    }

    const productData = {
      sku,
      barcode,
      name,
      description,
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
      cost_price: costPrice,
      selling_price: sellingPrice,
      unit,
    };

    /*
     * EDIT PRODUCT
     */
    if (editingProduct) {
      const {
        data,
        error: updateError,
      } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id)
        .select("*")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setProducts((current) =>
        current.map((product) =>
          product.id === editingProduct.id
            ? data
            : product
        )
      );

      setSuccess("Product updated successfully.");

      setSaving(false);
      setShowModal(false);
      setEditingProduct(null);
      setForm(emptyForm);

      return;
    }

    /*
     * CREATE PRODUCT
     */

    // Step 1: Create the product
    const {
      data,
      error: insertError,
    } = await supabase
      .from("products")
      .insert(productData)
      .select("*")
      .single();

    if (insertError || !data) {
      setError(
        insertError?.message ||
          "Failed to create product."
      );

      setSaving(false);
      return;
    }

    /*
     * Step 2:
     * Find the Main Warehouse.
     *
     * Your database currently has:
     *
     * Main Warehouse
     * code = MAIN
     */
    const {
      data: warehouse,
      error: warehouseError,
    } = await supabase
      .from("warehouses")
      .select("id")
      .eq("code", "MAIN")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (warehouseError || !warehouse) {
      /*
       * Roll back product creation.
       * We don't want a product without inventory.
       */
      await supabase
        .from("products")
        .delete()
        .eq("id", data.id);

      setError(
        warehouseError?.message ||
          "Main Warehouse was not found. Product was not created."
      );

      setSaving(false);
      return;
    }

    /*
     * Step 3:
     * Create the inventory record.
     *
     * IMPORTANT:
     * The database has a unique constraint on:
     *
     * product_id + warehouse_id
     *
     * Therefore we use UPSERT.
     */
    const {
      error: inventoryError,
    } = await supabase
      .from("inventory")
      .upsert(
        {
          product_id: data.id,
          warehouse_id: warehouse.id,
          quantity: initialStock,
          reserved_quantity: 0,
        },
        {
          onConflict: "product_id,warehouse_id",
        }
      );

    if (inventoryError) {
      /*
       * Roll back the product if inventory creation fails.
       */
      await supabase
        .from("products")
        .delete()
        .eq("id", data.id);

      setError(
        inventoryError.message ||
          "Failed to create inventory record. Product was not created."
      );

      setSaving(false);
      return;
    }

    /*
     * Step 4:
     * Update UI.
     */
    setProducts((current) => [
      data as Product,
      ...current,
    ]);

    setSuccess(
      "Product and initial stock created successfully."
    );

    setSaving(false);
    setShowModal(false);
    setEditingProduct(null);
    setForm(emptyForm);
  }

  async function toggleProductStatus(
    product: Product
  ) {
    setError("");
    setSuccess("");

    const {
      error: updateError,
    } = await supabase
      .from("products")
      .update({
        is_active: !product.is_active,
      })
      .eq("id", product.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setProducts((current) =>
      current.map((item) =>
        item.id === product.id
          ? {
              ...item,
              is_active: !item.is_active,
            }
          : item
      )
    );

    setSuccess(
      product.is_active
        ? "Product deactivated successfully."
        : "Product activated successfully."
    );
  }

  const filteredProducts = products.filter(
    (product) => {
      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        product.name
          .toLowerCase()
          .includes(query) ||
        product.sku
          .toLowerCase()
          .includes(query) ||
        (product.barcode ?? "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          product.is_active) ||
        (statusFilter === "inactive" &&
          !product.is_active);

      return matchesSearch && matchesStatus;
    }
  );

  const activeProducts = products.filter(
    (product) => product.is_active
  ).length;

  const averageSellingPrice =
    products.length > 0
      ? products.reduce(
          (total, product) =>
            total + Number(product.selling_price),
          0
        ) / products.length
      : 0;

  function categoryName(
    categoryId: string | null
  ) {
    if (!categoryId) return "Uncategorized";

    return (
      categories.find(
        (category) => category.id === categoryId
      )?.name ?? "Uncategorized"
    );
  }

  function supplierName(
    supplierId: string | null
  ) {
    if (!supplierId) return "No supplier";

    return (
      suppliers.find(
        (supplier) => supplier.id === supplierId
      )?.name ?? "No supplier"
    );
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
    }).format(value);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <span>/</span>
              <span>Products</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Products
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage your product catalogue, pricing,
              suppliers, and inventory.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <span className="mr-2 text-lg">+</span>
            Add Product
          </button>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {/* STATS */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Products
            </p>

            <p className="mt-2 text-3xl font-bold">
              {products.length}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              All catalogue items
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Active Products
            </p>

            <p className="mt-2 text-3xl font-bold">
              {activeProducts}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Currently available
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Average Selling Price
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatCurrency(averageSellingPrice)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Average across all catalogue items
            </p>
          </div>

        </div>

        {/* PRODUCT TABLE */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-4 sm:p-5">

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

              <div className="relative flex-1 lg:max-w-md">

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search by name, SKU or barcode..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />

              </div>

              <div className="flex gap-2">

                {(
                  [
                    "all",
                    "active",
                    "inactive",
                  ] as const
                ).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() =>
                      setStatusFilter(filter)
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                      statusFilter === filter
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {filter}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={loadData}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                >
                  Refresh
                </button>

              </div>

            </div>

          </div>

          {loading ? (
            <div className="p-12 text-center">

              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />

              <p className="mt-4 text-sm text-slate-500">
                Loading products...
              </p>

            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
                📦
              </div>

              <h2 className="mt-4 text-lg font-semibold">
                {products.length === 0
                  ? "No products yet"
                  : "No products found"}
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {products.length === 0
                  ? "Create your first product to start building your inventory catalogue."
                  : "Try changing your search or status filter."}
              </p>

              {products.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Add First Product
                </button>
              )}

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1100px] text-left text-sm">

                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">

                  <tr>
                    <th className="px-5 py-4 font-semibold">
                      Product
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      SKU
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Category
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Supplier
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Cost
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Selling
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Status
                    </th>

                    <th className="px-5 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {filteredProducts.map(
                    (product) => (
                      <tr
                        key={product.id}
                        className="transition hover:bg-slate-50"
                      >

                        <td className="px-5 py-4">

                          <div>

                            <p className="font-semibold text-slate-900">
                              {product.name}
                            </p>

                            {product.barcode && (
                              <p className="mt-1 text-xs text-slate-400">
                                Barcode:{" "}
                                {product.barcode}
                              </p>
                            )}

                          </div>

                        </td>

                        <td className="px-5 py-4 font-mono text-xs text-slate-600">
                          {product.sku}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {categoryName(
                            product.category_id
                          )}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {supplierName(
                            product.supplier_id
                          )}
                        </td>

                        <td className="px-5 py-4 font-medium">
                          {formatCurrency(
                            Number(product.cost_price)
                          )}
                        </td>

                        <td className="px-5 py-4 font-medium">
                          {formatCurrency(
                            Number(
                              product.selling_price
                            )
                          )}
                        </td>

                        <td className="px-5 py-4">

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              product.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {product.is_active
                              ? "Active"
                              : "Inactive"}
                          </span>

                        </td>

                        <td className="px-5 py-4">

                          <div className="flex justify-end gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  product
                                )
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                toggleProductStatus(
                                  product
                                )
                              }
                              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                                product.is_active
                                  ? "border-red-200 text-red-600 hover:bg-red-50"
                                  : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                              }`}
                            >
                              {product.is_active
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                          </div>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

          {!loading &&
            filteredProducts.length > 0 && (
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
                Showing{" "}
                {filteredProducts.length} of{" "}
                {products.length} products
              </div>
            )}

        </section>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">

          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">

              <div>

                <h2 className="text-xl font-bold">
                  {editingProduct
                    ? "Edit Product"
                    : "Add Product"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingProduct
                    ? "Update product information and pricing."
                    : "Add a new product and its opening stock."}
                </p>

              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6"
            >

              <div className="grid gap-5 md:grid-cols-2">

                {/* PRODUCT NAME */}
                <div>

                  <label className="mb-2 block text-sm font-semibold">
                    Product Name *
                  </label>

                  <input
                    required
                    value={form.name}
                    onChange={(event) => {
                      const name =
                        event.target.value;

                      updateForm(
                        "name",
                        name
                      );

                      updateForm(
                        "sku",
                        generateSkuBaseFromName(
                          name
                        )
                      );
                    }}
                    placeholder="e.g. Brake Pad Set"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />

                </div>

                {/* SKU */}
                <div>

                  <label className="mb-2 block text-sm font-semibold">
                    SKU * 
                  </label>

                  <input
                    required
                    readOnly
                    value={form.sku}
                    placeholder="Generated from product name"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 font-mono text-sm text-slate-600 outline-none"
                  />

                  <p className="mt-1.5 text-xs text-slate-500">
                    
                  </p>

                </div>

                {/* BARCODE 
                <div>

                  <label className="mb-2 block text-sm font-semibold">
                    Barcode
                  </label>

                  <input
                    value={form.barcode}
                    onChange={(event) =>
                      updateForm(
                        "barcode",
                        event.target.value
                      )
                    }
                    placeholder="Optional barcode"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />

                </div>
                
                {/* UNIT */}
                <div>

                  <label className="mb-2 block text-sm font-semibold">
                    Unit *
                  </label>

                  <input
                    required
                    value={form.unit}
                    onChange={(event) =>
                      updateForm(
                        "unit",
                        event.target.value
                      )
                    }
                    placeholder="e.g. pcs, box, kg"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />

                  <p className="mt-1.5 text-xs text-slate-500">
                    Measurement unit for this product.
                  </p>

                </div>

                {/* INITIAL STOCK */}
                <div>

                  <label className="mb-2 block text-sm font-semibold">
                    Initial Stock
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.initial_stock}
                    onChange={(event) =>
                      updateForm(
                        "initial_stock",
                        event.target.value
                      )
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />

                  <p className="mt-1.5 text-xs text-slate-500">
                  </p>

                </div>

               {/* CATEGORY 
                <div>

                  <label className="mb-2 block text-sm font-semibold">
                    Category
                  </label>

                  <select
                    value={form.category_id}
                    onChange={(event) =>
                      updateForm(
                        "category_id",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >

                    <option value="">
                      No category
                    </option>

                    {categories.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      )
                    )}

                  </select>

                </div>

                 SUPPLIER 
                <div>

                  <label className="mb-2 block text-sm font-semibold">
                    Supplier
                  </label>

                  <select
                    value={form.supplier_id}
                    onChange={(event) =>
                      updateForm(
                        "supplier_id",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >

                    <option value="">
                      No supplier
                    </option>

                    {suppliers.map(
                      (supplier) => (
                        <option
                          key={supplier.id}
                          value={supplier.id}
                        >
                          {supplier.name}
                        </option>
                      )
                    )}

                  </select>

                </div>

                /* COST */}
                <div>

                  <label className="mb-2 block text-sm font-semibold">
                    Cost Price *
                  </label>

                  <div className="flex overflow-hidden rounded-lg border border-slate-300 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200">

                    <span className="flex items-center bg-slate-50 px-3 text-sm font-medium text-slate-500">
                      LKR
                    </span>

                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.cost_price}
                      onChange={(event) =>
                        updateForm(
                          "cost_price",
                          event.target.value
                        )
                      }
                      className="min-w-0 flex-1 border-0 px-4 py-2.5 text-sm outline-none focus:ring-0"
                    />

                  </div>

                </div>

                {/* SELLING */}
                <div>

                  <label className="mb-2 block text-sm font-semibold">
                    Selling Price *
                  </label>

                  <div className="flex overflow-hidden rounded-lg border border-slate-300 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200">

                    <span className="flex items-center bg-slate-50 px-3 text-sm font-medium text-slate-500">
                      LKR
                    </span>

                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.selling_price}
                      onChange={(event) =>
                        updateForm(
                          "selling_price",
                          event.target.value
                        )
                      }
                      className="min-w-0 flex-1 border-0 px-4 py-2.5 text-sm outline-none focus:ring-0"
                    />

                  </div>

                </div>

                {/* DESCRIPTION */}
                <div className="md:col-span-2">

                  <label className="mb-2 block text-sm font-semibold">
                    Description
                  </label>

                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(event) =>
                      updateForm(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Optional product description..."
                    className="w-full resize-none rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />

                </div>

              </div>

              {error && (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-7 flex justify-end gap-3 border-t border-slate-200 pt-5">

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingProduct
                      ? "Update Product"
                      : "Create Product"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </main>
  );
}