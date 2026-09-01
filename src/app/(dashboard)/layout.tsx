import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/dashboard-shell";
import DashboardShell1 from "@/components/dashboard-shell1";

const CASH_REGISTER_EMAIL = "cash.register.user@gmail.com";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isCashRegister =
    user?.email?.trim().toLowerCase() === CASH_REGISTER_EMAIL;

  if (isCashRegister) {
    return <DashboardShell1>{children}</DashboardShell1>;
  }

  return <DashboardShell>{children}</DashboardShell>;
}