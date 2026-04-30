import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ExpenseCategoryForm } from "@/components/expense-categories/expense-category-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";

export default async function AddExpenseCategoryPage() {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) redirect("/login");
  if (!hasPermission(currentUser, "expense-categories:create")) {
    redirect("/dashboard?forbidden=1");
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <DashboardHeader
          title="Add Expense Category"
          branchOptions={[
            { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
          ]}
          selectedBranchValue={currentUser.branchId ?? "all"}
          branchFilterDisabled
        />

        <SectionCard
          title="New expense category"
          description="Create a category for branch expenses, employee expenses, or both flows."
        >
          <ExpenseCategoryForm redirectTo="/dashboard/expenses/categories" />
        </SectionCard>
      </div>
    </main>
  );
}
