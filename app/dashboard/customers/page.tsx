import { redirect } from "next/navigation";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { DashboardPageToolbar } from "@/components/dashboard/dashboard-page-toolbar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { parseDashboardPageFilters } from "@/lib/dashboard/page-filters";
import { getCustomersPageData, getDashboardContext } from "@/lib/dashboard/queries";
import { formatCompactNumber, formatDate, formatDateRangeLabel } from "@/lib/utils/format";

type CustomersPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
    from?: string | string[];
    to?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
  }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const filters = parseDashboardPageFilters(resolvedSearchParams);
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const pageData = await getCustomersPageData(context.selectedBranchId, currentFilters);
    const branchOptions = buildBranchFilterOptions(context);
    const dateRangeLabel = formatDateRangeLabel(currentFilters.from, currentFilters.to);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Customers"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <DashboardPageToolbar
            currentPath="/dashboard/customers"
            currentFilters={currentFilters}
            selectedFrom={currentFilters.from}
            selectedTo={currentFilters.to}
            exportAction={{
              label: "Export",
              disabled: true,
              disabledReason: "Customer export is coming soon.",
            }}
            moreActions={[
              {
                key: "customer-segments",
                label: "Segments",
                disabled: true,
                disabledReason: "Customer segments are coming soon.",
              },
            ]}
            createAction={{
              label: "Add Customer",
              disabled: true,
              disabledReason: "Customer creation is coming soon.",
            }}
          />

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">Customers added in range</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(pageData.summary.totalCustomersInRange)}
              </p>
            </div>
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">Studios added in range</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(pageData.summary.studioCustomersInRange)}
              </p>
            </div>
          </section>

          <SectionCard
            title="Customer list"
            description={`Showing customers for ${context.selectedBranchName.toLowerCase()} across ${dateRangeLabel}.`}
          >
            {pageData.result.items.length === 0 ? (
              <p className="text-sm text-slate-600">No customers found for the selected branch and date range.</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="pb-3 font-medium">Name</th>
                        <th className="pb-3 font-medium">Phone</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Studio name</th>
                        <th className="pb-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pageData.result.items.map((customer) => (
                        <tr key={customer.id}>
                          <td className="py-3 font-medium text-slate-900">{customer.name}</td>
                          <td className="py-3 text-slate-700">{customer.phone}</td>
                          <td className="py-3 capitalize text-slate-700">{customer.type}</td>
                          <td className="py-3 text-slate-700">{customer.studioName ?? "-"}</td>
                          <td className="py-3 text-slate-700">{formatDate(customer.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DashboardPagination
                  currentPath="/dashboard/customers"
                  currentFilters={currentFilters}
                  pagination={pageData.result.pagination}
                />
              </div>
            )}
          </SectionCard>
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load customers data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Customers"
            branchOptions={[{ label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" }]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load dashboard data right now.">
            <p className="text-sm text-slate-600">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
