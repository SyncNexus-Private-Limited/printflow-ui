import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-950">Dashboard</h1>
          <p className="text-sm text-slate-600">You are signed in.</p>
        </div>
        <LogoutButton />
      </div>
    </main>
  );
}

