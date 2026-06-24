import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { OfferForm } from "@/components/offers/offer-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getOfferFormPageData } from "@/lib/offers/queries";

type AddOfferPageProps = {
  searchParams?: Promise<{ branchId?: string | string[] }>;
};

function normalizeSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AddOfferPage({ searchParams }: AddOfferPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) redirect("/login");
  if (!hasPermission(currentUser, "offers:create")) redirect("/dashboard?forbidden=1");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedBranchId = normalizeSingleParam(resolvedSearchParams?.branchId);

  try {
    const pageData = await getOfferFormPageData(currentUser, requestedBranchId);

    if (pageData.branchOptions.length === 0) {
      return (
        <main className="min-h-screen px-4 py-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <DashboardHeader
              title="Add Offer"
              branchOptions={[{ label: pageData.selectedBranchName, value: "none" }]}
              selectedBranchValue="none"
              branchFilterDisabled
            />
            <SectionCard
              title="No branch available"
              description={
                pageData.noBranchAssigned
                  ? "You don't have a branch assigned yet."
                  : "A branch must exist before you can add offers."
              }
            >
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                {pageData.noBranchAssigned
                  ? "Please contact your system administrator to get a branch assigned."
                  : "Please create a branch first or contact your system administrator."}
              </p>
            </SectionCard>
          </div>
        </main>
      );
    }

    const headerBranchOptions = pageData.branchOptions.map((branch) => ({
      label: branch.name,
      value: branch.id,
    }));

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Offer"
            branchOptions={headerBranchOptions}
            selectedBranchValue={pageData.selectedBranchId}
            branchFilterDisabled={!pageData.canSelectBranch}
          />

          <SectionCard
            title="New offer"
            description={`Create a promotion rule for ${pageData.selectedBranchName}.`}
          >
            <OfferForm {...pageData} />
          </SectionCard>
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load Add Offer page", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Offer"
            branchOptions={[
              {
                label: currentUser.branchName ?? "Unavailable",
                value: currentUser.branchId ?? "unavailable",
              },
            ]}
            selectedBranchValue={currentUser.branchId ?? "unavailable"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load this page right now.">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
