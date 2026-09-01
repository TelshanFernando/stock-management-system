import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const modules = [
    ["Products", "Manage your product catalogue", "/products"],
    ["Inventory", "Track stock across warehouses", "/inventory"],
    ["Purchases", "Manage purchase orders", "/purchases"],
    ["Sales", "Track sales and payments", "/sales"],
  ] as const;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Stock Management System
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Inventory Dashboard
            </h1>
            <p className="mt-2 text-slate-600">
              Manage products, inventory, purchases, sales, suppliers, and customers.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            {user ? `Signed in as ${user.email ?? "user"}` : "Not signed in"}
          </div>
        </header>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map(([title, description, href]) => (
            <article
              key={title}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              <Link
                href={href}
                className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Open
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Phase 1 database connected</h2>
          <p className="mt-2 text-slate-600">
            Supabase authentication and the core database schema are configured.
            The next step is to build the authenticated application modules on top of this foundation.
          </p>
        </section>
      </div>
    </main>
  );
}
