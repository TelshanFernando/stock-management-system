"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const mainNavigation = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/products", label: "Products", icon: "▣" },
 // { href: "/categories", label: "Categories", icon: "◇" },
  { href: "/inventory", label: "Inventory", icon: "▤" },
 // { href: "/suppliers", label: "Suppliers", icon: "♧" },
];

const transactionNavigation = [
  //{ href: "/purchases", label: "Purchases", icon: "↓" },
  { href: "/sales", label: "Sales", icon: "↑" },
  { href: "/stock-movements", label: "Stock Movements", icon: "↕" },
];

const managementNavigation = [
  { href: "/reports", label: "Reports", icon: "▥" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

function NavigationLink({
  href,
  label,
  pathname,
  icon,
}: {
  href: string;
  label: string;
  pathname: string;
  icon: string;
}) {
  const active =
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
          active
            ? "bg-white/10 text-white"
            : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-700"
        }`}
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-6 py-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-extrabold tracking-tight text-white shadow-sm">
              SM
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-extrabold tracking-tight text-slate-950">
                Stock Management
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-400">
                Inventory Management System
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Workspace
          </p>
          <div className="space-y-1">
            {mainNavigation.map((item) => (
              <NavigationLink
                key={item.href}
                href={item.href}
                label={item.label}
                pathname={pathname}
                icon={item.icon}
              />
            ))}
          </div>

          <div className="mt-7">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Transactions
            </p>
            <div className="space-y-1">
              {transactionNavigation.map((item) => (
                <NavigationLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  pathname={pathname}
                  icon={item.icon}
                />
              ))}
            </div>
          </div>

          <div className="mt-7">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Management
            </p>
            <div className="space-y-1">
              {managementNavigation.map((item) => (
                <NavigationLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  pathname={pathname}
                  icon={item.icon}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
              <p className="text-xs font-bold text-slate-600">System operational</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              AI Powered Stock-Management System
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <span>Logout</span>
            <span aria-hidden="true">↪</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              {pathname !== "/dashboard" && (
                <button
                  type="button"
                  onClick={() => router.back()}
                  aria-label="Go back"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                >
                  ←
                </button>
              )}

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Stock Management System
                </p>
                <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                  {pathname === "/dashboard"
                    ? "Dashboard"
                    : pathname
                        .split("/")
                        .filter(Boolean)
                        .map((part) =>
                          part
                            .replaceAll("-", " ")
                            .replace(/\b\w/g, (letter) => letter.toUpperCase()),
                        )
                        .join(" / ")}
                </h1>
              </div>
            </div>

         
          </div>
        </header>

        <div className="min-h-[calc(100vh-5rem)]">{children}</div>
      </main>
    </div>
  );
}