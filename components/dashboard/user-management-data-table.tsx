"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, Pencil, RotateCcw, UserCheck, UserX } from "lucide-react";
import { DataPill, getActiveUserRoleTone } from "@/components/dashboard/data-pill";
import { RowActionMenu, type RowAction } from "@/components/dashboard/row-action-menu";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import { UserEditDialog } from "@/components/users/user-edit-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  buildUsersPageHref,
  type UserManagementPageFilterState,
  type UserManagementSortValue,
} from "@/lib/dashboard/users-page-filters";
import { TABLE_BODY_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "@/lib/dashboard/list-page-classes";
import { type HeaderSortConfig } from "@/lib/dashboard/sortable-header-utils";
import {
  type ColumnStickyDef,
  computeStickySpecs,
  getStickyBodyCellClass,
  getStickyBodyCellStyle,
  getStickyEdgeTotalWidth,
  getStickyHeaderCellClass,
  getStickyHeaderCellStyle,
} from "@/lib/dashboard/sticky-column-utils";
import type { DashboardPaginationState, UserManagementRow } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

type UserManagementDataTableProps = {
  items: UserManagementRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: UserManagementPageFilterState;
  pagination: DashboardPaginationState;
  showBranch?: boolean;
  currentUserId: string;
};

type PendingAction =
  | { type: "deactivate"; user: UserManagementRow }
  | { type: "activate"; user: UserManagementRow }
  | { type: "lock"; user: UserManagementRow }
  | { type: "unlock"; user: UserManagementRow }
  | { type: "reset-password"; user: UserManagementRow };

type HeaderConfig = {
  key: string;
  label: string;
  sort?: HeaderSortConfig<UserManagementSortValue>;
} & ColumnStickyDef;

const baseHeaderConfigs: HeaderConfig[] = [
  {
    key: "name",
    label: "Full name",
    sticky: "left",
    width: 192,
    sort: { asc: "name-asc", desc: "name-desc", defaultDirection: "asc" },
  },
  { key: "username", label: "Username" },
  {
    key: "role",
    label: "Role",
    sort: { asc: "role-asc", desc: "role-desc", defaultDirection: "asc" },
  },
  { key: "branch", label: "Branch" },
  { key: "status", label: "Status" },
  {
    key: "created",
    label: "Created",
    sort: { asc: "created-asc", desc: "created-desc", defaultDirection: "desc" },
  },
  { key: "actions", label: "", sticky: "right", width: 56 },
];

function getHeaderConfigs(showBranch: boolean): HeaderConfig[] {
  return showBranch ? baseHeaderConfigs : baseHeaderConfigs.filter((h) => h.key !== "branch");
}

function renderStatusPill(isActive: boolean, isLocked: boolean) {
  if (isLocked) {
    return (
      <DataPill tone="rose" appearance="outline" className="max-w-full">
        Locked
      </DataPill>
    );
  }

  return (
    <DataPill tone={isActive ? "emerald" : "neutral"} appearance="outline" className="max-w-full">
      {isActive ? "Active" : "Inactive"}
    </DataPill>
  );
}

function ResetPasswordDialog({
  user,
  isOpen,
  onClose,
  onConfirm,
  isPending,
}: {
  user: UserManagementRow | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newPassword: string) => void;
  isPending: boolean;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleClose() {
    setNewPassword("");
    setShowPassword(false);
    onClose();
  }

  function handleSubmit() {
    if (newPassword.length >= 8 && !isPending) {
      onConfirm(newPassword);
    }
  }

  const canSubmit = newPassword.length >= 8 && !isPending;

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Reset password" size="sm">
      <div className="px-5 pb-5 pt-4">
        {user ? (
          <p className="mb-4 text-sm text-[rgb(var(--muted-foreground))]">
            Set a new password for <span className="font-semibold text-[rgb(var(--foreground))]">{user.fullName}</span>. The
            existing password will be replaced immediately.
          </p>
        ) : null}

        <div className="mb-5 space-y-2">
          <label
            htmlFor="reset-password-input"
            className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]"
          >
            New password
          </label>
          <div className="relative">
            <Input
              id="reset-password-input"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              disabled={isPending}
              className="pr-16"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {newPassword.length > 0 && newPassword.length < 8 ? (
            <p className="text-sm text-[rgb(var(--danger))]">Password must be at least 8 characters.</p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            className="h-10 rounded-2xl px-4 shadow-none"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 rounded-2xl px-5 shadow-none"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-busy={isPending}
          >
            {isPending ? (
              <>
                <Spinner size="xs" ariaHidden className="mr-2" />
                Resetting...
              </>
            ) : (
              "Reset password"
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function UserManagementDataTable({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  showBranch = false,
  currentUserId,
}: UserManagementDataTableProps) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState<UserManagementRow[]>(items);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isActionPending, startActionTransition] = useTransition();

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const headerConfigs = getHeaderConfigs(showBranch);
  const stickySpecs = computeStickySpecs(headerConfigs);
  const stickyLeftWidth = getStickyEdgeTotalWidth(headerConfigs, "left") || undefined;
  const actionsStickySpec = stickySpecs[stickySpecs.length - 1];

  if (localItems.length === 0) {
    return <TableEmptyState message={emptyMessage} />;
  }

  const handleSortChange = (sortValue: UserManagementSortValue) => {
    const nextHref = buildUsersPageHref(currentPath, currentFilters, {
      page: 1,
      sort: sortValue,
    });

    router.replace(nextHref, { scroll: false });
  };

  async function executeAction(action: PendingAction, extraData?: { newPassword: string }) {
    setErrorMessage(null);

    try {
      let response: Response;

      if (action.type === "reset-password") {
        response = await fetch(`/api/users/${action.user.id}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: extraData?.newPassword ?? "" }),
        });
      } else {
        const body =
          action.type === "activate" || action.type === "deactivate"
            ? { action: "toggle-status", isActive: action.type === "activate" }
            : { action: "toggle-lock", isLocked: action.type === "lock" };

        response = await fetch(`/api/users/${action.user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = (await response.json().catch(() => null)) as { success: boolean; message?: string } | null;

      if (!response.ok || !data?.success) {
        setErrorMessage(data?.message ?? "Unable to complete the action right now.");
        return;
      }

      // Optimistically patch the affected row so the status pill updates
      // immediately, before the background server re-render commits.
      const userId = action.user.id;
      if (
        action.type === "activate" ||
        action.type === "deactivate" ||
        action.type === "lock" ||
        action.type === "unlock"
      ) {
        setLocalItems((prev) =>
          prev.map((item) => {
            if (item.id !== userId) return item;
            if (action.type === "activate") return { ...item, isActive: true };
            if (action.type === "deactivate") return { ...item, isActive: false };
            if (action.type === "lock") return { ...item, isLocked: true };
            return { ...item, isLocked: false };
          }),
        );
      }

      setPendingAction(null);
      startActionTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("Unable to complete the action right now.");
    }
  }

  function buildRowActions(user: UserManagementRow): RowAction[] {
    const isSelf = user.id === currentUserId;

    const actions: RowAction[] = [
      {
        key: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" strokeWidth={1.9} />,
        onClick: () => setEditingUserId(user.id),
      },
    ];

    if (!isSelf) {
      actions.push(
        user.isActive
          ? {
              key: "deactivate",
              label: "Deactivate",
              icon: <UserX className="h-4 w-4" strokeWidth={1.9} />,
              destructive: true,
              onClick: () => setPendingAction({ type: "deactivate", user }),
            }
          : {
              key: "activate",
              label: "Reactivate",
              icon: <UserCheck className="h-4 w-4" strokeWidth={1.9} />,
              onClick: () => setPendingAction({ type: "activate", user }),
            },
        {
          key: "reset-password",
          label: "Reset password",
          icon: <RotateCcw className="h-4 w-4" strokeWidth={1.9} />,
          onClick: () => setPendingAction({ type: "reset-password", user }),
        },
        user.isLocked
          ? {
              key: "unlock",
              label: "Unlock account",
              icon: <LockOpen className="h-4 w-4" strokeWidth={1.9} />,
              onClick: () => setPendingAction({ type: "unlock", user }),
            }
          : {
              key: "lock",
              label: "Lock account",
              icon: <Lock className="h-4 w-4" strokeWidth={1.9} />,
              destructive: true,
              onClick: () => setPendingAction({ type: "lock", user }),
            },
      );
    }

    return actions;
  }

  const confirmingUser = pendingAction?.type !== "reset-password" ? pendingAction?.user ?? null : null;
  const confirmTitle =
    pendingAction?.type === "deactivate"
      ? "Deactivate account"
      : pendingAction?.type === "activate"
        ? "Reactivate account"
        : pendingAction?.type === "lock"
          ? "Lock account"
          : pendingAction?.type === "unlock"
            ? "Unlock account"
            : "";
  const confirmDescription =
    pendingAction?.type === "deactivate"
      ? `${confirmingUser?.fullName} will be unable to log in until the account is reactivated.`
      : pendingAction?.type === "activate"
        ? `${confirmingUser?.fullName} will be able to log in again.`
        : pendingAction?.type === "lock"
          ? `${confirmingUser?.fullName}'s account will be locked and they will be unable to log in.`
          : pendingAction?.type === "unlock"
            ? `${confirmingUser?.fullName}'s account will be unlocked.`
            : "";
  const confirmKeyword =
    pendingAction?.type === "deactivate" || pendingAction?.type === "lock"
      ? "confirm"
      : "confirm";
  const confirmLabel =
    pendingAction?.type === "deactivate"
      ? "Deactivate"
      : pendingAction?.type === "activate"
        ? "Reactivate"
        : pendingAction?.type === "lock"
          ? "Lock"
          : "Unlock";

  return (
    <>
      <DataTableContainer>
        <TableScrollArea
          className="bg-[rgb(var(--card)/0.98)]"
          viewportClassName="pb-0"
          stickyLeftWidth={stickyLeftWidth}
        >
          <table
            className={cn(
              "w-max min-w-full border-collapse text-left text-sm",
              showBranch ? "min-w-6xl" : "min-w-4xl",
            )}
          >
            <colgroup>
              <col className="w-48" />
              <col className="w-36" />
              <col className="w-28" />
              {showBranch && <col className="w-40" />}
              <col className="w-28" />
              <col className="w-36" />
              <col className="w-14" />
            </colgroup>

            <thead>
              <tr>
                {headerConfigs.map((headerConfig, index) =>
                  headerConfig.sort ? (
                    <SortableHeaderCell
                      key={headerConfig.key}
                      label={headerConfig.label}
                      sortConfig={headerConfig.sort}
                      currentSort={currentFilters.sort}
                      onSort={handleSortChange}
                      stickySpec={stickySpecs[index] ?? undefined}
                    />
                  ) : (
                    <th
                      key={headerConfig.key}
                      scope="col"
                      className={cn(
                        TABLE_HEADER_CELL_CLASS,
                        getStickyHeaderCellClass(stickySpecs[index]),
                      )}
                      style={getStickyHeaderCellStyle(stickySpecs[index])}
                    >
                      {headerConfig.label || <span className="sr-only">Actions</span>}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {localItems.map((user) => (
                <tr
                  key={user.id}
                  className="group border-b border-[rgb(var(--border)/0.58)] transition-colors hover:bg-[rgb(var(--muted)/0.28)] last:border-b-0"
                >
                  <td
                    className={cn(TABLE_BODY_CELL_CLASS, getStickyBodyCellClass(stickySpecs[0]))}
                    style={getStickyBodyCellStyle(stickySpecs[0])}
                  >
                    <p className="wrap-break-word font-semibold leading-6 text-[rgb(var(--card-foreground))]">
                      {user.fullName}
                    </p>
                  </td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    <p className="whitespace-nowrap text-[rgb(var(--foreground)/0.76)]">{user.username}</p>
                  </td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    <DataPill tone={getActiveUserRoleTone(user.role)} appearance="outline" className="max-w-full">
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </DataPill>
                  </td>
                  {showBranch && (
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="max-w-40 wrap-break-word font-medium leading-6 text-[rgb(var(--foreground)/0.76)]">
                        {user.branchName ?? "—"}
                      </p>
                    </td>
                  )}
                  <td className={TABLE_BODY_CELL_CLASS}>
                    {renderStatusPill(user.isActive, user.isLocked)}
                  </td>
                  <td className={TABLE_BODY_CELL_CLASS}>
                    <p className="whitespace-nowrap font-medium text-[rgb(var(--foreground)/0.68)]">
                      {formatDate(user.createdAt)}
                    </p>
                  </td>
                  <td
                    className={cn(TABLE_BODY_CELL_CLASS, "px-2", getStickyBodyCellClass(actionsStickySpec))}
                    style={getStickyBodyCellStyle(actionsStickySpec)}
                  >
                    <RowActionMenu
                      label={`Actions for ${user.fullName}`}
                      actions={buildRowActions(user)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollArea>

        <DashboardPagination
          currentPath={currentPath}
          currentFilters={currentFilters}
          pagination={pagination}
          variant="users"
        />
      </DataTableContainer>

      {/* Confirm dialog for deactivate / activate / lock / unlock */}
      <ConfirmDialog
        isOpen={
          pendingAction !== null &&
          pendingAction.type !== "reset-password" &&
          !isActionPending
            ? true
            : pendingAction !== null && pendingAction.type !== "reset-password"
        }
        onClose={() => {
          setPendingAction(null);
          setErrorMessage(null);
        }}
        onConfirm={() => {
          if (pendingAction && pendingAction.type !== "reset-password") {
            executeAction(pendingAction);
          }
        }}
        title={confirmTitle}
        description={confirmDescription}
        confirmKeyword={confirmKeyword}
        confirmLabel={confirmLabel}
        isPending={isActionPending}
      >
        {errorMessage ? (
          <p className="text-sm text-[rgb(var(--danger))]">{errorMessage}</p>
        ) : null}
      </ConfirmDialog>

      {/* Reset password dialog */}
      <ResetPasswordDialog
        user={pendingAction?.type === "reset-password" ? pendingAction.user : null}
        isOpen={pendingAction?.type === "reset-password"}
        onClose={() => {
          setPendingAction(null);
          setErrorMessage(null);
        }}
        onConfirm={(newPassword) => {
          if (pendingAction?.type === "reset-password") {
            executeAction(pendingAction, { newPassword });
          }
        }}
        isPending={isActionPending}
      />

      {/* Edit user dialog */}
      <UserEditDialog
        userId={editingUserId}
        onClose={() => setEditingUserId(null)}
        onSuccess={() => {
          setEditingUserId(null);
          startActionTransition(() => router.refresh());
        }}
      />
    </>
  );
}
