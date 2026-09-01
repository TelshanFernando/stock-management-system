'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Product = {
  id: string;
  name: string;
  sku: string;
  selling_price: number | string | null;
  description: string | null;
  unit: string;
};

type Inventory = {
  product_id: string;
  warehouse_id: string | null;
  quantity: number;
  reserved_quantity: number;
  created_at: string | null;
  updated_at: string | null;
};

type StockSummary = {
  quantity: number;
  reserved: number;
  available: number;
};

type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';

const EMPTY_STOCK: StockSummary = { quantity: 0, reserved: 0, available: 0 };

const InventoryPage = () => {
  const supabaseClient = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    const [productsResult, inventoryResult] = await Promise.all([
      supabaseClient
        .from('products')
        .select('id, name, sku, selling_price, description, unit')
        .order('name'),
      supabaseClient
        .from('inventory')
        .select('product_id, warehouse_id, quantity, reserved_quantity, created_at, updated_at'),
    ]);

    if (productsResult.error) {
      console.error('Failed to load products:', productsResult.error);
      setProducts([]);
      setInventory([]);
      setError(productsResult.error.message || 'Failed to load products.');
      setLoading(false);
      return;
    }

    const mappedProducts: Product[] = (productsResult.data ?? []).map((item) => ({
      id: String(item.id),
      name: String(item.name ?? ''),
      sku: String(item.sku ?? ''),
      selling_price: item.selling_price ?? null,
      description: item.description ?? null,
      unit: String(item.unit ?? 'pcs'),
    }));
    setProducts(mappedProducts);

    if (inventoryResult.error) {
      console.error('Failed to load inventory:', inventoryResult.error);
      setInventory([]);
      setError(inventoryResult.error.message || 'Inventory stock could not be loaded.');
      setLoading(false);
      return;
    }

    const inventoryRows: Inventory[] = (inventoryResult.data ?? []).map((item) => ({
      product_id: String(item.product_id),
      warehouse_id: item.warehouse_id ? String(item.warehouse_id) : null,
      quantity: Number(item.quantity ?? 0),
      reserved_quantity: Number(item.reserved_quantity ?? 0),
      created_at: item.created_at ?? null,
      updated_at: item.updated_at ?? null,
    }));

    setInventory(inventoryRows);
    setLoading(false);
  }, [supabaseClient]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);

    const channel = supabaseClient
      .channel('inventory-page-stock-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => {
          void fetchData();
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(timer);
      void supabaseClient.removeChannel(channel);
    };
  }, [fetchData, supabaseClient]);

  const stockByProductId = useMemo<Record<string, StockSummary>>(() => {
    const map: Record<string, StockSummary> = {};

    for (const item of inventory) {
      const productId = String(item.product_id);
      const quantity = Number(item.quantity ?? 0);
      const reserved = Number(item.reserved_quantity ?? 0);

      if (!Number.isFinite(quantity) || !Number.isFinite(reserved)) continue;

      if (!map[productId]) {
        map[productId] = { ...EMPTY_STOCK };
      }

      map[productId].quantity += quantity;
      map[productId].reserved += reserved;
    }

    for (const stock of Object.values(map)) {
      stock.available = Math.max(0, stock.quantity - stock.reserved);
    }

    return map;
  }, [inventory]);

  const totals = useMemo(() => {
    return products.reduce(
      (summary, product) => {
        const stock = stockByProductId[product.id] ?? EMPTY_STOCK;
        summary.units += stock.quantity;
        summary.available += stock.available;
        summary.reserved += stock.reserved;
        return summary;
      },
      { units: 0, available: 0, reserved: 0 },
    );
  }, [products, stockByProductId]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      const stock = stockByProductId[product.id] ?? EMPTY_STOCK;

      switch (stockFilter) {
        case 'in-stock':
          return stock.available > 0;
        case 'low-stock':
          return stock.available > 0 && stock.available <= 10;
        case 'out-of-stock':
          return stock.available <= 0;
        case 'all':
        default:
          return true;
      }
    });
  }, [products, search, stockByProductId, stockFilter]);

  const getStockStatus = (available: number) => {
    if (available <= 0) return { label: 'Out of stock', className: 'bg-red-50 text-red-700 ring-red-600/10', dotClassName: 'bg-red-500' };
    if (available <= 10) return { label: 'Low stock', className: 'bg-amber-50 text-amber-700 ring-amber-600/10', dotClassName: 'bg-amber-500' };
    return { label: 'In stock', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10', dotClassName: 'bg-emerald-500' };
  };

  const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const formatCurrency = (value: number | string | null) =>
    `LKR ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filterOptions: Array<{ value: StockFilter; label: string }> = [
    { value: 'all', label: 'All products' },
    { value: 'in-stock', label: 'In stock' },
    { value: 'low-stock', label: 'Low stock' },
    { value: 'out-of-stock', label: 'Out of stock' },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">Inventory Management</div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Inventory</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">Monitor your product catalogue, stock availability, and inventory health from one place.</p>
            </div>
            <button type="button" onClick={() => void fetchData()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </header>

        <section aria-label="Inventory overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Total products</p><p className="mt-2 text-2xl font-bold text-slate-950">{products.length}</p><p className="mt-3 text-xs text-slate-400">Products in your catalogue</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Total units</p><p className="mt-2 text-2xl font-bold text-slate-950">{formatNumber(totals.units)}</p><p className="mt-3 text-xs text-slate-400">Across all warehouses</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Available units</p><p className="mt-2 text-2xl font-bold text-slate-950">{formatNumber(totals.available)}</p><p className="mt-3 text-xs text-slate-400">Ready to be allocated</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Reserved units</p><p className="mt-2 text-2xl font-bold text-slate-950">{formatNumber(totals.reserved)}</p><p className="mt-3 text-xs text-slate-400">Allocated to pending activity</p></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="text-lg font-semibold text-slate-950">Product catalogue</h2><p className="mt-1 text-sm text-slate-500">Search and monitor current stock levels.</p></div>
              <div className="w-full lg:max-w-sm"><label htmlFor="inventory-search" className="sr-only">Search products</label><input id="inventory-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by product or SKU..." className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter products by stock status">
              {filterOptions.map((option) => <button key={option.value} type="button" onClick={() => setStockFilter(option.value)} className={`rounded-lg px-3.5 py-2 text-sm font-medium ${stockFilter === option.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} aria-pressed={stockFilter === option.value}>{option.label}</button>)}
            </div>
          </div>

          {loading && products.length === 0 ? <div className="px-6 py-16 text-center text-sm text-slate-500">Loading inventory...</div> : error ? <div className="px-6 py-14 text-center"><p className="font-semibold text-slate-900">Unable to load inventory</p><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{error}</p><button type="button" onClick={() => void fetchData()} className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Try again</button></div> : filteredProducts.length === 0 ? <div className="px-6 py-16 text-center"><p className="font-semibold text-slate-900">No matching products</p><p className="mt-1 text-sm text-slate-500">Try changing your search or stock filter.</p></div> : <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80"><tr><th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th><th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">SKU</th><th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Selling price</th><th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Stock</th><th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProducts.map((product) => {
                  const stock = stockByProductId[product.id] ?? EMPTY_STOCK;
                  const status = getStockStatus(stock.available);
                  return <tr key={product.id} className="hover:bg-slate-50/70">
                    <td className="min-w-[250px] px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">{product.name.trim().charAt(0).toUpperCase() || 'P'}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{product.name}</p><p className="mt-0.5 max-w-xs truncate text-xs text-slate-500">{product.description || 'No description'}</p></div></div></td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-600">{product.sku}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-slate-900">{formatCurrency(product.selling_price)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right"><p className="text-sm font-semibold text-slate-900">{formatNumber(stock.quantity)} <span className="font-normal text-slate-500">in stock</span></p><p className="mt-0.5 text-xs text-slate-500">{formatNumber(stock.available)} available{stock.reserved > 0 ? ` · ${formatNumber(stock.reserved)} reserved` : ''}</p></td>
                    <td className="whitespace-nowrap px-5 py-4 text-right"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${status.className}`}><span className={`h-1.5 w-1.5 rounded-full ${status.dotClassName}`} />{status.label}</span></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>}

          {!loading && !error && filteredProducts.length > 0 && <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Showing {filteredProducts.length} of {products.length} products</span><span>Stock quantity is read directly from inventory.quantity.</span></div>}
        </section>
      </div>
    </main>
  );
};
export default InventoryPage;