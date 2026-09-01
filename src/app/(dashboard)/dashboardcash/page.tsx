import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type InventoryRow = {
  quantity: number | string;
  reserved_quantity: number | string;
};

type SaleRow = {
  id: string;
  sale_number: string;
  status: string;
  total_amount: number | string;
  sold_at: string | null;
};

type MovementRow = {
  id: string;
  movement_type: string;
  quantity: number | string;
  created_at: string;
  reference_number: string | null;
};

type QueryError = {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getMovementLabel(type: string) {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getMovementSign(type: string) {
  return ["purchase", "transfer_in", "return_in"].includes(type)
    ? "+"
    : "-";
}

function getMovementTone(type: string) {
  return ["purchase", "transfer_in", "return_in"].includes(type)
    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
    : "bg-rose-50 text-rose-700 ring-rose-600/10";
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>

          <h1 className="mt-5 text-xl font-bold text-slate-950">
            Session required
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your dashboard session is no longer available. Please sign in
            again to continue.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  let inventoryResult: {
    data: InventoryRow[] | null;
    error: QueryError | null;
  } = {
    data: [],
    error: null,
  };

  let salesResult: {
    data: SaleRow[] | null;
    error: QueryError | null;
  } = {
    data: [],
    error: null,
  };

  let movementResult: {
    data: MovementRow[] | null;
    error: QueryError | null;
  } = {
    data: [],
    error: null,
  };

  // Inventory
  try {
    const result = await supabase
      .from("inventory")
      .select("quantity, reserved_quantity");

    if (result.error) {
      console.error("[Cash Dashboard] inventory query failed:", result.error);

      inventoryResult = {
        data: [],
        error: result.error,
      };
    } else {
      inventoryResult = {
        data: (result.data ?? []) as InventoryRow[],
        error: null,
      };
    }
  } catch (err) {
    console.error("[Cash Dashboard] inventory query failed:", err);

    inventoryResult = {
      data: [],
      error:
        err instanceof Error
          ? { message: err.message }
          : { message: String(err) },
    };
  }

  // Sales
  try {
    const result = await supabase
      .from("sales")
      .select("id, sale_number, status, total_amount, sold_at")
      .eq("status", "completed")
      .order("sold_at", { ascending: false })
      .limit(5);

    if (result.error) {
      console.error("[Cash Dashboard] sales query failed:", result.error);

      salesResult = {
        data: [],
        error: result.error,
      };
    } else {
      salesResult = {
        data: (result.data ?? []) as SaleRow[],
        error: null,
      };
    }
  } catch (err) {
    console.error("[Cash Dashboard] sales query failed:", err);

    salesResult = {
      data: [],
      error:
        err instanceof Error
          ? { message: err.message }
          : { message: String(err) },
    };
  }

  // Stock movements
  try {
    const result = await supabase
      .from("stock_movements")
      .select(
        "id, movement_type, quantity, created_at, reference_number",
      )
      .order("created_at", { ascending: false })
      .limit(8);

    if (result.error) {
      console.error(
        "[Cash Dashboard] stock_movements query failed:",
        result.error,
      );

      movementResult = {
        data: [],
        error: result.error,
      };
    } else {
      movementResult = {
        data: (result.data ?? []) as MovementRow[],
        error: null,
      };
    }
  } catch (err) {
    console.error(
      "[Cash Dashboard] stock_movements query failed:",
      err,
    );

    movementResult = {
      data: [],
      error:
        err instanceof Error
          ? { message: err.message }
          : { message: String(err) },
    };
  }

  const inventoryRows = inventoryResult.data ?? [];
  const saleRows = salesResult.data ?? [];
  const movementRows = movementResult.data ?? [];

  const totalStock = inventoryRows.reduce(
    (total, row) => total + Number(row.quantity || 0),
    0,
  );

  const reservedStock = inventoryRows.reduce(
    (total, row) => total + Number(row.reserved_quantity || 0),
    0,
  );

  const availableStock = Math.max(
    0,
    totalStock - reservedStock,
  );

  const recentSalesValue = saleRows.reduce(
    (total, row) => total + Number(row.total_amount || 0),
    0,
  );

  const stockUtilization =
    totalStock > 0
      ? Math.min(
          100,
          Math.round((reservedStock / totalStock) * 100),
        )
      : 0;

  const dataWarnings = [
    inventoryResult.error,
    salesResult.error,
    movementResult.error,
  ].filter(Boolean);

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Cash register
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Dashboard
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Welcome back. Manage stock and record customer sales from your
            cash register.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          System operational
        </div>
      </header>

      {/* Data warnings */}
      {dataWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some dashboard data could not be loaded. The available sections
          are still shown.
        </div>
      )}

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Register status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Z" />
                <path d="M4 7.5 12 11l8-3.5M12 11v9" />
              </svg>
            </div>

            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Ready
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Register status
          </p>

          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Open
          </p>

          <p className="mt-2 text-xs text-slate-400">
            Cash register is ready for customer transactions
          </p>
        </div>

        {/* Total stock */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 7h18M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
                <path d="M7 11h4M7 15h7" />
              </svg>
            </div>

            <span className="text-xs font-medium text-slate-400">
              All locations
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Total stock
          </p>

          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {formatNumber(totalStock)}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            Units currently recorded across inventory
          </p>
        </div>

        {/* Available stock */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12 3v18M7 7h7a3 3 0 0 1 0 6H8a3 3 0 0 1 0 6h9" />
              </svg>
            </div>

            <span className="text-xs font-medium text-slate-400">
              {stockUtilization}% reserved
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Available stock
          </p>

          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {formatNumber(availableStock)}
          </p>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${stockUtilization}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-400">
            {formatNumber(reservedStock)} units reserved
          </p>
        </div>

        {/* Recent sales */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 5h16v14H4z" />
                <path d="M8 15V11M12 15V8M16 15v-3" />
              </svg>
            </div>

            <span className="text-xs font-medium text-slate-400">
              Last 5 sales
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Recent sales
          </p>

          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {formatCurrency(recentSalesValue)}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            Value of the latest completed transactions
          </p>
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-950">Quick actions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Jump directly into your most-used workflows.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
          <Link
            href="/inventory"
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-700">
                ↗
              </span>
              <span className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-600">
                →
              </span>
            </div>
            <p className="mt-4 font-semibold text-slate-900">Inventory</p>
            <p className="mt-1 text-sm text-slate-500">
              Monitor stock and availability
            </p>
          </Link>

          <Link
            href="/sales"
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-700">
                ↗
              </span>
              <span className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-600">
                →
              </span>
            </div>
            <p className="mt-4 font-semibold text-slate-900">New sale</p>
            <p className="mt-1 text-sm text-slate-500">
              Record a customer transaction
            </p>
          </Link>
        </div>
      </section>

      {/* Recent sales */}
      <section>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
            <div>
              <h2 className="font-bold text-slate-950">
                Recent sales
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Latest completed transactions
              </p>
            </div>

            <Link
              href="/sales"
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              View all →
            </Link>
          </div>

          {saleRows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                No completed sales yet
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Completed transactions will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {saleRows.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {sale.sale_number}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDate(sale.sold_at)}
                    </p>
                  </div>

                  <p className="shrink-0 text-sm font-bold text-slate-900">
                    {formatCurrency(
                      Number(sale.total_amount || 0),
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent stock movements */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
          <div>
            <h2 className="font-bold text-slate-950">
              Recent stock movements
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Latest inventory activity across your system
            </p>
          </div>

          <Link
            href="/stock-movements"
            className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            View all →
          </Link>
        </div>

        {movementRows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              No stock movements recorded yet
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Inventory activity will appear here as stock changes.
            </p>
          </div>
        ) : (
          <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0 md:divide-x">
            {movementRows.map((movement) => {
              const sign = getMovementSign(
                movement.movement_type,
              );

              return (
                <div
                  key={movement.id}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ring-1 ring-inset ${getMovementTone(
                        movement.movement_type,
                      )}`}
                    >
                      {sign}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {getMovementLabel(
                          movement.movement_type,
                        )}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {movement.reference_number
                          ? `Ref: ${movement.reference_number} · `
                          : ""}
                        {formatDate(movement.created_at)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 text-sm font-bold ${
                      sign === "+"
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }`}
                  >
                    {sign}
                    {formatNumber(
                      Number(movement.quantity || 0),
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}