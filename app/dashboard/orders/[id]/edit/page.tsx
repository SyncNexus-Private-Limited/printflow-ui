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
  if (
    !canEditOrder(currentUser, {
      branchId: data.detail.order.branchId,
      status: data.detail.order.status,
    })
  ) {
    notFound();
  }

  return (
    <main className="min-h-screen px-7 pt-8 pb-16">
      <div className="mx-auto max-w-330">
        <OrderEditForm {...data} />
      </div>
    </main>
  );
}
