"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { UserRoleSwitch } from "@/components/users/user-role-switch";
import { updateUserSchema } from "@/lib/users/schema";
import {
  userRoleLabels,
  type EditUserRow,
  type UpdateUserApiResponse,
  type UpdateUserFieldName,
  type UpdateUserFormValues,
  type UserBranchOption,
  type UserRole,
} from "@/lib/users/types";
import { formatDateTime } from "@/lib/utils/format";

type UserDetailApiResponse =
  | {
      success: true;
      data: { user: EditUserRow; branchOptions: UserBranchOption[]; canSelectBranch: boolean };
    }
  | { success: false; message: string };

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      userId: string;
      user: EditUserRow;
      branchOptions: UserBranchOption[];
      canSelectBranch: boolean;
    };

function FieldLabel({
  htmlFor,
  children,
  optional = false,
}: {
  htmlFor: string;
  children: string;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]"
    >
      {children}
      {optional ? (
        <span className="ml-1 font-normal normal-case tracking-normal opacity-70">Optional</span>
      ) : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-[rgb(var(--danger))]">{message}</p> : null;
}

function getFieldError(
  errors: ReturnType<typeof useForm<UpdateUserFormValues>>["formState"]["errors"],
  field: UpdateUserFieldName,
): string | undefined {
  const err = errors[field];
  if (!err || typeof err !== "object" || !("message" in err)) return undefined;
  return typeof err.message === "string" ? err.message : undefined;
}

function LoadingShimmer() {
  return (
    <div
      className="space-y-6 px-5 pb-6 pt-4"
      aria-busy="true"
      aria-label="Loading user details"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[88px] animate-pulse rounded-[22px] bg-[rgb(var(--muted)/0.5)]"
          />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3.5 w-20 animate-pulse rounded-md bg-[rgb(var(--muted)/0.7)]" />
            <div className="h-11 animate-pulse rounded-xl bg-[rgb(var(--muted)/0.5)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

type UserEditDialogProps = {
  userId: string | null;
  onClose: () => void;
  onSuccess: (id: string) => void;
};

export function UserEditDialog({ userId, onClose, onSuccess }: UserEditDialogProps) {
  const isOpen = userId !== null;
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("staff");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema) as unknown as Resolver<UpdateUserFormValues>,
    defaultValues: {
      fullName: "",
      phone: "",
      alternatePhone: "",
      email: "",
      address: "",
      role: "staff",
      branchId: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!userId) {
      abortRef.current?.abort();
      abortRef.current = null;
      setLoadState({ status: "idle" });
      setServerError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState({ status: "loading" });
    setServerError(null);

    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as UserDetailApiResponse;
        if (!data.success) {
          setLoadState({ status: "error", message: data.message });
          return;
        }
        const { user, branchOptions, canSelectBranch } = data.data;

        reset({
          fullName: user.fullName,
          phone: user.phone,
          alternatePhone: user.alternatePhone,
          email: user.email,
          address: user.address,
          role: user.role,
          branchId: user.branchId,
          isActive: user.isActive,
        });
        setSelectedRole(user.role);
        setSelectedBranchId(user.branchId);
        setLoadState({ status: "ready", userId, user, branchOptions, canSelectBranch });
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setLoadState({ status: "error", message: "Unable to load user details right now." });
      });

    return () => {
      controller.abort();
    };
  }, [userId, reset]);

  const handleRoleChange = (nextRole: UserRole) => {
    setSelectedRole(nextRole);
    setValue("role", nextRole, { shouldValidate: true });
  };

  const handleBranchChange = (nextBranchId: string) => {
    setSelectedBranchId(nextBranchId);
    setValue("branchId", nextBranchId, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    if (loadState.status !== "ready") return;
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch(`/api/users/${loadState.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-profile", ...values }),
      });
      const data = (await res.json().catch(() => null)) as UpdateUserApiResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<
            [UpdateUserFieldName, string]
          >) {
            if (message) setError(field, { type: "server", message });
          }
        }
        setServerError(
          data && !data.success ? data.message : "Unable to save changes right now.",
        );
        return;
      }

      onSuccess(loadState.userId);
    } catch {
      setServerError("Unable to save changes right now.");
    }
  });

  const readyState = loadState.status === "ready" ? loadState : null;
  const branchOptions = readyState?.branchOptions ?? [];
  const canSelectBranch = readyState?.canSelectBranch ?? false;
  const branchRequired = selectedRole !== "admin";
  const isActiveValue = watch("isActive");

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit user account"
      description="Changes are saved immediately and will appear in the list."
      size="lg"
    >
      {loadState.status === "loading" || loadState.status === "idle" ? (
        <LoadingShimmer />
      ) : loadState.status === "error" ? (
        <div className="px-5 py-8 text-center text-sm text-[rgb(var(--muted-foreground))]">
          {loadState.message}
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <input type="hidden" {...register("role")} value={selectedRole} />
          <input type="hidden" {...register("branchId")} value={selectedBranchId} />

          <div className="space-y-6 px-5 pb-2 pt-4">
            {serverError ? (
              <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
                {serverError}
              </div>
            ) : null}

            {/* Role */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]">
                Account role
              </p>
              <UserRoleSwitch
                value={selectedRole}
                disabled={isSubmitting}
                onChange={handleRoleChange}
              />
              <FieldError message={getFieldError(errors, "role")} />
            </div>

            {/* Profile details */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]">
                Profile details
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel htmlFor="ued-full-name">Full name</FieldLabel>
                  <Input
                    id="ued-full-name"
                    placeholder="Arjun Mehta"
                    disabled={isSubmitting}
                    {...register("fullName")}
                  />
                  <FieldError message={getFieldError(errors, "fullName")} />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="ued-phone">Phone</FieldLabel>
                  <Input
                    id="ued-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+91 98765 43210"
                    disabled={isSubmitting}
                    {...register("phone")}
                  />
                  <FieldError message={getFieldError(errors, "phone")} />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="ued-alt-phone" optional>
                    Alternate phone
                  </FieldLabel>
                  <Input
                    id="ued-alt-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+91 91234 56789"
                    disabled={isSubmitting}
                    {...register("alternatePhone")}
                  />
                  <FieldError message={getFieldError(errors, "alternatePhone")} />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="ued-email" optional>
                    Email
                  </FieldLabel>
                  <Input
                    id="ued-email"
                    type="email"
                    inputMode="email"
                    placeholder="arjun@example.com"
                    disabled={isSubmitting}
                    {...register("email")}
                  />
                  <FieldError message={getFieldError(errors, "email")} />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel htmlFor="ued-address" optional>
                    Address
                  </FieldLabel>
                  <Textarea
                    id="ued-address"
                    placeholder="Home or work address"
                    disabled={isSubmitting}
                    {...register("address")}
                  />
                  <FieldError message={getFieldError(errors, "address")} />
                </div>
              </div>
            </div>

            {/* Access details */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]">
                Access details
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={branchRequired ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                  <FieldLabel htmlFor="ued-branch">Branch</FieldLabel>
                  {branchOptions.length === 0 ? (
                    <p className="text-sm text-[rgb(var(--muted-foreground))]">
                      No branches available.
                    </p>
                  ) : (
                    <Select
                      id="ued-branch"
                      value={selectedBranchId}
                      disabled={isSubmitting || !canSelectBranch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                    >
                      {!branchRequired && <option value="">No branch</option>}
                      {branchOptions.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </Select>
                  )}
                  {!branchRequired ? (
                    <p className="text-xs text-[rgb(var(--muted-foreground))]">
                      Admin accounts can operate without a branch assignment.
                    </p>
                  ) : null}
                  <FieldError message={getFieldError(errors, "branchId")} />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="ued-status">Account status</FieldLabel>
                  <Select
                    id="ued-status"
                    disabled={isSubmitting}
                    value={isActiveValue ? "active" : "inactive"}
                    onChange={(e) =>
                      setValue("isActive", e.target.value === "active", { shouldValidate: true })
                    }
                  >
                    <option value="active">Active — can log in</option>
                    <option value="inactive">Inactive — account disabled</option>
                  </Select>
                  <FieldError message={getFieldError(errors, "isActive")} />
                </div>
              </div>

              <div className="rounded-[22px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] p-4">
                <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                  Username and password
                </p>
                <p className="mt-0.5 text-sm text-[rgb(var(--muted-foreground))]">
                  Username:{" "}
                  <span className="font-medium text-[rgb(var(--foreground))]">
                    {readyState?.user.username}
                  </span>
                  . Use the Reset password action in the users list to change the password.
                </p>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-5 py-4">
            {readyState?.user.updatedAt ? (
              <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
                Last updated on {formatDateTime(readyState.user.updatedAt)}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4 shadow-none"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10 min-w-28 rounded-2xl px-5"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="xs" ariaHidden className="mr-2" />
                    Saving...
                  </>
                ) : (
                  `Save ${userRoleLabels[selectedRole]} account`
                )}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  );
}
