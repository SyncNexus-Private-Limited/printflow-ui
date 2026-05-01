import { notFound, redirect } from "next/navigation";
import { OrderEditForm } from "@/components/orders/order-edit-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/permissions";
import { canEditOrder } from "@/lib/orders/guards";
import { getEditOrderPageData } from "@/lib/orders/queries";

type EditOrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditOrderPage({ params }: EditOrderPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });
  if (!currentUser) redirect("/login");

  assertPermission(currentUser, "orders:edit");

  const { id } = await params;
  const data = await getEditOrderPageData(currentUser, id);
  if (!data) notFound();
  if (!canEditOrder(currentUser, { branchId: data.detail.order.branchId, status: data.detail.order.status })) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">Edit Order</p>
          <h1 className="text-3xl font-semibold text-[rgb(var(--foreground))]">
            {data.detail.order.orderCode}
          </h1>
        </div>
        <OrderEditForm {...data} />
      </div>
    </main>
  );
}
