import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function LoginPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[28px] border border-[rgb(var(--border))] bg-[linear-gradient(180deg,rgb(var(--card))_0%,rgb(var(--primary-soft))_145%)] p-8 shadow-[0_30px_80px_-42px_rgb(var(--shadow)/0.45)]">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-[rgb(var(--primary-soft))] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[rgb(var(--primary-soft-foreground))]">
            Owner portal
          </span>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--card-foreground))]">Sign in</h1>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Enter your username and password to continue.
            </p>
          </div>
          <p className="text-xs text-[rgb(var(--muted-foreground))]">Theme shortcut: Ctrl/Cmd + J</p>
        </div>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
