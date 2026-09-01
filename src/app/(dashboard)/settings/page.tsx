"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("LKR");
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 3000);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="mb-2 text-sm text-slate-500">
            Dashboard / Settings
          </p>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure your inventory management system.
          </p>
        </div>

        {saved && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Settings saved successfully.
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-lg font-semibold">Business Settings</h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure basic business information.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <div>
              <label
                htmlFor="companyName"
                className="mb-2 block text-sm font-semibold"
              >
                Company Name
              </label>

              <input
                id="companyName"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Your company name"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label
                htmlFor="currency"
                className="mb-2 block text-sm font-semibold"
              >
                Currency
              </label>

              <select
                id="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="LKR">LKR - Sri Lankan Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 p-6">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}