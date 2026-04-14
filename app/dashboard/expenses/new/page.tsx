import { redirect } from "next/navigation";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { coerceExpenseType, getExpenseBranchesForUser, getExpenseFormPageData, normalizeExpenseSearchParam } from "@/lib/expenses/queries";

type AddExpensePageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
    type?: string | string[];
  }>;
};

export default async function AddExpensePage({ searchParams }: AddExpensePageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedBranchId = normalizeExpenseSearchParam(resolvedSearchParams?.branchId);
  const requestedType = normalizeExpenseSearchParam(resolvedSearchParams?.type);
  const branchOptions = await getExpenseBranchesForUser(currentUser);

  if (branchOptions.length === 0) {
    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Expense"
            branchOptions={[{ label: currentUser.branchName ?? "No branch available", value: currentUser.branchId ?? "unavailable" }]}
            selectedBranchValue={currentUser.branchId ?? "unavailable"}
            branchFilterDisabled
          />
          <SectionCard title="No branch available" description="A branch assignment is required before you can create expenses.">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Please contact an administrator to restore your branch access.</p>
          </SectionCard>
        </div>
      </main>
    );
  }

  const selectedBranch = branchOptions.find((branch) => branch.id === requestedBranchId) ?? branchOptions[0];
  const selectedType = coerceExpenseType(requestedType);
  const canonicalHref = `/dashboard/expenses/new?branchId=${encodeURIComponent(selectedBranch.id)}&type=${encodeURIComponent(selectedType)}`;
  const hasCanonicalBranch = requestedBranchId === selectedBranch.id;
  const hasCanonicalType = requestedType === selectedType;

  if (!hasCanonicalBranch || !hasCanonicalType) {
    redirect(canonicalHref);
  }

  try {
    const pageData = await getExpenseFormPageData(currentUser, selectedBranch.id, selectedType);
    const headerBranchOptions = pageData.branchOptions.map((branch) => ({
      label: branch.name,
      value: branch.id,
    }));

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Expense"
            branchOptions={headerBranchOptions}
            selectedBranchValue={pageData.selectedBranchId}
            branchFilterDisabled={!pageData.canSelectBranch}
          />

          <SectionCard
            title={pageData.selectedType === "business" ? "Business expense details" : "Employee expense details"}
            description={`Create a ${pageData.selectedType} expense for ${pageData.selectedBranchName}.`}
          >
            <ExpenseForm {...pageData} />
          </SectionCard>
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load expense creation page", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Expense"
            branchOptions={[{ label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "unavailable" }]}
            selectedBranchValue={currentUser.branchId ?? "unavailable"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load expense form right now.">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
