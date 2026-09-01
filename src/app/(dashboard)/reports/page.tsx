"use client";

import { useCallback, useEffect, useState } from "react";

type ReportSnapshot = {
  generatedAt: string;
  sales: {
    count: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    averageOrderValue: number;
  };
  purchases: {
    count: number;
    total: number;
    pending: number;
    received: number;
  };
  inventory: {
    totalProducts: number;
    totalUnits: number;
    inventoryValue: number;
    lowStockProducts: number;
    outOfStockProducts: number;
  };
  topProducts: Array<{
    productId: string;
    name: string;
    sku: string;
    quantitySold: number;
    revenue: number;
    grossProfit: number;
  }>;
  lowStockProducts: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    reorderLevel: number;
    reorderQuantity: number;
  }>;
};

type AIReport = {
  summary: string;
  highlights: string[];
  risks: string[];
  recommendations: string[];
  priorities: string[];
};

type ReportResponse = {
  snapshot: ReportSnapshot;
  ai: AIReport;
};

function money(value: number | null | undefined) {
  const amount = Number(value ?? 0);

  return `LKR ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Card({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
    </div>
  );
}

function InsightCard({
  title,
  items,
}: {
  title: string;
  items?:
    | string[]
    | Array<{
        priority?: string;
        action?: string;
        reason?: string;
      }>
    | null;
}) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>

      {safeItems.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No significant findings.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {safeItems.map((item, index) => {
            if (typeof item === "string") {
              return (
                <li
                  key={`${item}-${index}`}
                  className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"
                >
                  {item}
                </li>
              );
            }

            return (
              <li
                key={`${item.action ?? "recommendation"}-${index}`}
                className="rounded-lg bg-slate-50 p-4"
              >
                {item.priority && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {item.priority}
                  </p>
                )}

                {item.action && (
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {item.action}
                  </p>
                )}

                {item.reason && (
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    {item.reason}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setError("");

    const response = await fetch("/api/reports/ai", {
      method: "GET",
      cache: "no-store",
    });

    const data = (await response.json()) as
      | ReportResponse
      | { error?: string };

    if (!response.ok) {
      throw new Error(
        "error" in data && data.error
          ? data.error
          : "Failed to load AI report."
      );
    }

    setReport(data as ReportResponse);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport()
        .catch((err: unknown) => {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load AI report."
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadReport]);

  async function regenerate() {
    setRegenerating(true);
    setError("");

    try {
      await loadReport();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to regenerate report."
      );
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="text-4xl">🤖</div>
            <h1 className="mt-4 text-xl font-semibold">
              AI is analyzing your inventory...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Calculating sales, profitability, inventory and purchasing
              insights.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h1 className="font-semibold text-red-800">
              Unable to generate AI report
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error || "An unexpected error occurred."}
            </p>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadReport()
                  .catch((err: unknown) => {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Failed to load AI report."
                    );
                  })
                  .finally(() => setLoading(false));
              }}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const { snapshot, ai } = report;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm text-slate-500">
              Dashboard / AI Reports
            </p>

            <h1 className="text-3xl font-bold">
              AI Business Intelligence
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              AI-powered analysis of your sales, inventory and purchasing
              data.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={regenerating}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {regenerating ? "Analyzing..." : "Regenerate AI Report"}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-2xl">
              🤖
            </div>

            <div>
              <h2 className="text-lg font-semibold">
                AI Executive Summary
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {ai.summary}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            title="Sales Revenue"
            value={money(snapshot.sales.revenue)}
            description={`${snapshot.sales.count} completed sales`}
          />

          <Card
            title="Gross Profit"
            value={money(snapshot.sales.grossProfit)}
            description={`COGS ${money(snapshot.sales.cogs)}`}
          />

          <Card
            title="Inventory Value"
            value={money(snapshot.inventory.inventoryValue)}
            description={`${snapshot.inventory.totalProducts} products`}
          />

          <Card
            title="Low Stock"
            value={String(snapshot.inventory.lowStockProducts)}
            description={`${snapshot.inventory.outOfStockProducts} out of stock`}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <InsightCard
            title="Key Highlights"
            items={ai.highlights}
          />

          <InsightCard
            title="Business Risks"
            items={ai.risks}
          />

          <InsightCard
            title="AI Recommendations"
            items={ai.recommendations}
          />

          <InsightCard
            title="Priority Actions"
            items={ai.priorities}
          />
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold">Sales Performance</h2>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Card
              title="Average Order Value"
              value={money(snapshot.sales.averageOrderValue)}
            />

            <Card
              title="COGS"
              value={money(snapshot.sales.cogs)}
            />

            <Card
              title="Gross Margin"
              value={
                snapshot.sales.revenue > 0
                  ? `${(
                      (snapshot.sales.grossProfit /
                        snapshot.sales.revenue) *
                      100
                    ).toFixed(1)}%`
                  : "0.0%"
              }
            />
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold">Top Products</h2>
          </div>

          {snapshot.topProducts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No completed sales yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Qty Sold</th>
                    <th className="px-5 py-3">Revenue</th>
                    <th className="px-5 py-3">Profit</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {snapshot.topProducts.map((product) => (
                    <tr key={product.productId}>
                      <td className="px-5 py-4 font-medium">
                        {product.name}
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {product.sku}
                      </td>

                      <td className="px-5 py-4">
                        {product.quantitySold}
                      </td>

                      <td className="px-5 py-4">
                        {money(product.revenue)}
                      </td>

                      <td className="px-5 py-4 font-semibold text-emerald-700">
                        {money(product.grossProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold">Inventory Alerts</h2>
          </div>

          {snapshot.lowStockProducts.length === 0 &&
          snapshot.inventory.outOfStockProducts === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No low-stock products detected.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Current</th>
                    <th className="px-5 py-3">Reorder Level</th>
                    <th className="px-5 py-3">Suggested Order</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {snapshot.lowStockProducts.map((product) => (
                    <tr key={product.productId}>
                      <td className="px-5 py-4 font-medium">
                        {product.name}
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {product.sku}
                      </td>

                      <td className="px-5 py-4 font-semibold text-red-600">
                        {product.quantity}
                      </td>

                      <td className="px-5 py-4">
                        {product.reorderLevel}
                      </td>

                      <td className="px-5 py-4">
                        {product.reorderQuantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-6 text-xs text-slate-400">
          Report generated{" "}
          {new Date(snapshot.generatedAt).toLocaleString()}
        </p>
      </div>
    </main>
  );
}