import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { CustomerForm } from "@/components/customers/customer-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";

export default async function AddCustomerPage() {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) redirect("/login");
  if (!hasPermission(currentUser, "customers:create")) {
    redirect("/dashboard?forbidden=1");
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <DashboardHeader
          title="Add Customer"
          branchOptions={[
            { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
          ]}
          selectedBranchValue={currentUser.branchId ?? "all"}
          branchFilterDisabled
        />

        <SectionCard
          title="New customer"
          description="Add a new customer to the system. They can be linked to orders after creation."
        >
          <CustomerForm redirectTo="/dashboard/customers" />
        </SectionCard>
      </div>
    </main>
  );
}
