"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { DataPill, getExpenseCategoryStatusTone } from "@/components/dashboard/data-pill";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { RowActionMenu, type RowAction } from "@/components/dashboard/row-action-menu";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OfferEditDialog } from "@/components/offers/offer-edit-dialog";
import {
  buildOffersPageHref,
  type OfferSortDirection,
  type OfferSortField,
  type OffersPageFilterState,
} from "@/lib/dashboard/offers-page-filters";
import { TABLE_BODY_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "@/lib/dashboard/list-page-classes";
import type { HeaderSortConfig } from "@/lib/dashboard/sortable-header-utils";
import {
  type ColumnStickyDef,
  computeStickySpecs,
  getStickyBodyCellClass,
  getStickyBodyCellStyle,
  getStickyEdgeTotalWidth,
  getStickyHeaderCellClass,
  getStickyHeaderCellStyle,
} from "@/lib/dashboard/sticky-column-utils";
import type {
  BranchOption,
  DashboardPaginationState,
  OfferManagementRow,
} from "@/lib/dashboard/types";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate, formatEnumLabel } from "@/lib/utils/format";

type OffersDataTableProps = {
  items: OfferManagementRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: OffersPageFilterState;
  pagination: DashboardPaginationState;
  branchOptions: BranchOption[];
  showBranchColumn: boolean;
  canSelectBranch: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canRestore: boolean;
};

type HeaderConfig = {
  key: string;
  label: string;
  sortField?: OfferSortField;
  sort?: HeaderSortConfig<string>;
} & ColumnStickyDef;

const headerConfigs: HeaderConfig[] = [
  { key: "offer", label: "Offer", sticky: "left", width: 260, sortField: "name" },
  { key: "type", label: "Type", sortField: "type" },
  { key: "value", label: "Value" },
  { key: "customer", label: "Customer" },
  { key: "dates", label: "Dates", sortField: "starts-at" },
  { key: "timing", label: "Timing", sortField: "ends-at" },
  { key: "status", label: "Status", sortField: "status" },
  { key: "branch", label: "Branch" },
  { key: "updated-at", label: "Last updated", sortField: "updated-at" },
  { key: "actions", label: "", sticky: "right", width: 56 },
];

function getSortValue(field: OfferSortField, direction: OfferSortDirection) {
  return `${field}:${direction}`;
}

function getSortConfig(field: OfferSortField): HeaderSortConfig<string> {
  return {
    asc: getSortValue(field, "asc"),
    desc: getSortValue(field, "desc"),
    defaultDirection: field === "updated-at" || field === "starts-at" ? "desc" : "asc",
  };
}

function parseSortValue(value: string) {
  const [field, direction] = value.split(":");
  return {
    sortField: field as OfferSortField,
    sortDirection: direction === "desc" ? "desc" : ("asc" as OfferSortDirection),
  };
}

function getTimingTone(timing: string) {
  if (timing === "current") return "emerald";
  if (timing === "upcoming") return "amber";
  return "rose";
}

function getOfferValue(offer: OfferManagementRow) {
  if (offer.offerType === "percentage") return `${offer.discountValue ?? 0}%`;
  if (offer.offerType === "flat") return formatCurrency(offer.discountValue ?? 0);
  return `Buy ${offer.buyQuantity ?? 0}, get ${offer.getQuantity ?? 0}`;
}

export function OffersDataTable({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  branchOptions,
  showBranchColumn,
  canSelectBranch,
  canEdit,
  canDeactivate,
  canRestore,
}: OffersDataTableProps) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<OfferManagementRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setLocalItems(items), [items]);

  const resolvedHeaders = headerConfigs
    .filter((header) => showBranchColumn || header.key !== "branch")
    .map((header) =>
      header.sortField ? { ...header, sort: getSortConfig(header.sortField) } : header,
    );
  const stickySpecs = computeStickySpecs(resolvedHeaders);
  const stickyLeftWidth = getStickyEdgeTotalWidth(resolvedHeaders, "left") || undefined;
  const actionsStickySpec = stickySpecs[stickySpecs.length - 1];

  if (localItems.length === 0) return <TableEmptyState message={emptyMessage} />;

  const currentSort = getSortValue(currentFilters.sortField, currentFilters.sortDirection);

  function handleSortChange(sortValue: string) {
    router.replace(
      buildOffersPageHref(currentPath, currentFilters, { ...parseSortValue(sortValue), page: 1 }),
      {
        scroll: false,
      },
    );
  }

  async function executeAction(offer: OfferManagementRow, action: "deactivate" | "restore") {
    setActionError(null);
    try {
      const res = await fetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => null)) as {
        success: boolean;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        setActionError(data?.message ?? "Unable to update offer right now.");
        return;
      }
      setLocalItems((current) =>
        current.map((item) =>
          item.id === offer.id ? { ...item, isActive: action === "restore" } : item,
        ),
      );
      setPendingDeactivate(null);
      startTransition(() => router.refresh());
    } catch {
      setActionError("Unable to update offer right now.");
    }
  }

  function buildRowActions(offer: OfferManagementRow): RowAction[] {
    const actions: RowAction[] = [];
    if (canEdit) {
      actions.push({
        key: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" strokeWidth={1.9} />,
        onClick: () => setEditingId(offer.id),
      });
    }
    if (offer.isActive && canDeactivate) {
      actions.push({
        key: "deactivate",
        label: "Deactivate",
        icon: <Trash2 className="h-4 w-4" strokeWidth={1.9} />,
        destructive: true,
        onClick: () => setPendingDeactivate(offer),
      });
    }
    if (!offer.isActive && canRestore) {
      actions.push({
        key: "restore",
        label: "Restore",
        icon: <RotateCcw className="h-4 w-4" strokeWidth={1.9} />,
        onClick: () => executeAction(offer, "restore"),
      });
    }
    return actions;
  }

  return (
    <>
      {actionError ? (
        <div className="mb-3 rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {actionError}
        </div>
      ) : null}
      <DataTableContainer>
        <TableScrollArea
          className="bg-[rgb(var(--card)/0.98)]"
          viewportClassName="pb-0"
          stickyLeftWidth={stickyLeftWidth}
        >
          <table className="w-max min-w-7xl border-collapse text-left text-sm">
            <thead>
              <tr>
                {resolvedHeaders.map((header, index) =>
                  header.sort ? (
                    <SortableHeaderCell
                      key={header.key}
                      label={header.label}
                      sortConfig={header.sort}
                      currentSort={currentSort}
                      onSort={handleSortChange}
                      stickySpec={stickySpecs[index] ?? undefined}
                    />
                  ) : (
                    <th
                      key={header.key}
                      scope="col"
                      className={cn(
                        TABLE_HEADER_CELL_CLASS,
                        getStickyHeaderCellClass(stickySpecs[index]),
                      )}
                      style={getStickyHeaderCellStyle(stickySpecs[index])}
                    >
                      {header.label || <span className="sr-only">Actions</span>}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {localItems.map((offer) => {
                const rowActions = buildRowActions(offer);
                const status = offer.isActive ? "active" : "inactive";
                return (
                  <tr
                    key={offer.id}
                    className="group border-b border-[rgb(var(--border)/0.58)] transition-colors last:border-b-0 hover:bg-[rgb(var(--muted)/0.28)]"
                  >
                    <td
                      className={cn(TABLE_BODY_CELL_CLASS, getStickyBodyCellClass(stickySpecs[0]))}
                      style={getStickyBodyCellStyle(stickySpecs[0])}
                    >
                      <p className="font-semibold wrap-break-word text-[rgb(var(--card-foreground))]">
                        {offer.name}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[rgb(var(--muted-foreground))]">
                        {offer.code}
                      </p>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <DataPill tone="blue" appearance="outline">
                        {formatEnumLabel(offer.offerType)}
                      </DataPill>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="font-semibold text-[rgb(var(--foreground))]">
                        {getOfferValue(offer)}
                      </p>
                      <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                        Min{" "}
                        {offer.minimumOrderValue === null
                          ? "none"
                          : formatCurrency(offer.minimumOrderValue)}
                      </p>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      {offer.customerTypes && offer.customerTypes.length > 0
                        ? offer.customerTypes.map((t) => formatEnumLabel(t)).join(", ")
                        : "All"}
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="whitespace-nowrap text-[rgb(var(--foreground)/0.72)]">
                        {formatDate(offer.startsAt)}
                      </p>
                      <p className="mt-1 text-xs whitespace-nowrap text-[rgb(var(--muted-foreground))]">
                        Ends {offer.endsAt ? formatDate(offer.endsAt) : "never"}
                      </p>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <DataPill tone={getTimingTone(offer.timingState)} appearance="outline">
                        {formatEnumLabel(offer.timingState)}
                      </DataPill>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <DataPill tone={getExpenseCategoryStatusTone(status)} appearance="outline">
                        {formatEnumLabel(status)}
                      </DataPill>
                    </td>
                    {showBranchColumn ? (
                      <td className={TABLE_BODY_CELL_CLASS}>{offer.branchName}</td>
                    ) : null}
                    <td className={TABLE_BODY_CELL_CLASS}>{formatDate(offer.updatedAt)}</td>
                    <td
                      className={cn(
                        TABLE_BODY_CELL_CLASS,
                        "px-2",
                        getStickyBodyCellClass(actionsStickySpec),
                      )}
                      style={getStickyBodyCellStyle(actionsStickySpec)}
                    >
                      {rowActions.length > 0 ? (
                        <RowActionMenu label={`Actions for ${offer.name}`} actions={rowActions} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScrollArea>
        <DashboardPagination
          currentPath={currentPath}
          currentFilters={currentFilters}
          pagination={pagination}
          variant="offers"
        />
      </DataTableContainer>

      <ConfirmDialog
        isOpen={pendingDeactivate !== null}
        onClose={() => {
          setPendingDeactivate(null);
          setActionError(null);
        }}
        onConfirm={() => {
          if (pendingDeactivate) executeAction(pendingDeactivate, "deactivate");
        }}
        title="Deactivate offer"
        description="This will deactivate the offer so it can no longer be used for new orders. Existing order records stay unchanged. This is not a permanent delete."
        confirmKeyword="delete"
        confirmLabel="Deactivate offer"
        isPending={isPending}
      >
        {pendingDeactivate ? (
          <div className="rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.4)] px-4 py-3">
            <p className="text-sm font-medium text-[rgb(var(--foreground))]">
              {pendingDeactivate.name}
            </p>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">
              Code: {pendingDeactivate.code}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>

      <OfferEditDialog
        offerId={editingId}
        branchOptions={branchOptions}
        canSelectBranch={canSelectBranch}
        onClose={() => setEditingId(null)}
        onSuccess={() => {
          setEditingId(null);
          startTransition(() => router.refresh());
        }}
      />
    </>
  );
}
