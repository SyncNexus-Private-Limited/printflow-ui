import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { VendorForm } from "@/components/vendors/vendor-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";

export default async function AddVendorPage() {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) redirect("/login");
  if (!hasPermission(currentUser, "vendors:create")) {
    redirect("/dashboard?forbidden=1");
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <DashboardHeader
          title="Add Vendor"
          branchOptions={[
            { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
          ]}
          selectedBranchValue={currentUser.branchId ?? "all"}
          branchFilterDisabled
        />

        <SectionCard
          title="New vendor"
          description="Create an outside supplier record for order, expense, and inventory workflows."
        >
          <VendorForm redirectTo="/dashboard/vendors" />
        </SectionCard>
      </div>
    </main>
  );
}
