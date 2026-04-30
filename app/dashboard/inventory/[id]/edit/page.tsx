import { redirect, notFound } from "next/navigation";
import { EditInventoryForm } from "@/components/inventory/edit-inventory-form";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getInventoryById, getVendorOptions } from "@/lib/inventory/queries";

type EditInventoryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditInventoryPage({ params }: EditInventoryPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  if (!hasPermission(currentUser, "inventory:edit")) {
    redirect("/dashboard?forbidden=1");
  }

  const { id } = await params;

  const item = await getInventoryById(id).catch(() => null);

  if (!item) {
    notFound();
  }

  if (
    !hasPermission(currentUser, "branches:select_all") &&
    currentUser.branchId !== item.branchId
  ) {
    redirect("/dashboard?forbidden=1");
  }

  const vendorOptions = await getVendorOptions().catch(() => []);

  const headerBranchOptions = [{ label: item.branchName, value: item.branchId }];

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <DashboardHeader
          title="Edit Inventory Item"
          branchOptions={headerBranchOptions}
          selectedBranchValue={item.branchId}
          branchFilterDisabled
        />

        <SectionCard
          title={item.name}
          description={`Edit inventory item details for ${item.branchName}.`}
        >
          <EditInventoryForm inventoryId={id} item={item} vendorOptions={vendorOptions} />
        </SectionCard>
      </div>
    </main>
  );
}
