"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { UserRoleSwitch } from "@/components/users/user-role-switch";
import { updateUserSchema } from "@/lib/users/schema";
import {
  userRoleLabels,
  type EditUserFormPageData,
  type UpdateUserApiResponse,
  type UpdateUserFieldName,
  type UpdateUserFormValues,
  type UserRole,
} from "@/lib/users/types";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

type EditUserFormProps = EditUserFormPageData & {
  userId: string;
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
      className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--foreground))]"
      htmlFor={htmlFor}
    >
      {children}
      {optional ? (
        <span className="text-xs font-normal text-[rgb(var(--muted-foreground))]">Optional</span>
      ) : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-[rgb(var(--danger))]">{message}</p> : null;
}

function getFieldError(
  errors: ReturnType<typeof useForm<UpdateUserFormValues>>["formState"]["errors"],
  field: UpdateUserFieldName,
): string | undefined {
  const err = errors[field];
  if (!err || typeof err !== "object" || !("message" in err)) return undefined;
  return typeof err.message === "string" ? err.message : undefined;
}

function buildDefaultValues(user: EditUserFormPageData["user"]): UpdateUserFormValues {
  return {
    fullName: user.fullName,
    phone: user.phone,
    alternatePhone: user.alternatePhone,
    email: user.email,
    address: user.address,
    role: user.role,
    branchId: user.branchId,
    isActive: user.isActive,
  };
}

export function EditUserForm({ userId, user, branchOptions, canSelectBranch }: EditUserFormProps) {
  const router = useRouter();
  const { showBlockingLoader, hideBlockingLoader } = useGlobalLoader();
  const [, startNavTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(user.branchId);

  const defaultValues = useMemo(() => buildDefaultValues(user), [user]);

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
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
    setServerError(null);
    setSelectedRole(user.role);
    setSelectedBranchId(user.branchId);
  }, [defaultValues, reset, user.role, user.branchId]);

  const handleRoleChange = (nextRole: UserRole) => {
    setSelectedRole(nextRole);
    setValue("role", nextRole, { shouldValidate: true });
  };

  const handleBranchChange = (nextBranchId: string) => {
    setSelectedBranchId(nextBranchId);
    setValue("branchId", nextBranchId, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();
    showBlockingLoader("Saving changes...", { autoHideOnRouteChange: true });

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-profile", ...values }),
      });
      const data = (await response.json().catch(() => null)) as UpdateUserApiResponse | null;

      if (!response.ok || !data || !("success" in data) || !data.success) {
        if (data && "fieldErrors" in data && data.fieldErrors) {
          for (const [fieldName, message] of Object.entries(data.fieldErrors) as Array<
            [UpdateUserFieldName, string]
          >) {
            if (!message) continue;
            setError(fieldName, { type: "server", message });
          }
        }
        setServerError(
          data && "message" in data ? data.message : "Unable to save changes right now.",
        );
        hideBlockingLoader();
        return;
      }

      startNavTransition(() => {
        router.push("/dashboard/users?updated=1");
      });
    } catch {
      setServerError("Unable to save changes right now.");
      hideBlockingLoader();
    }
  });

  const isActiveValue = watch("isActive");
  const branchRequired = selectedRole !== "admin";

  return (
    <form className="space-y-8" onSubmit={onSubmit} noValidate>
      <input type="hidden" {...register("role")} value={selectedRole} />
      <input type="hidden" {...register("branchId")} value={selectedBranchId} />

      {serverError ? (
        <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {serverError}
        </div>
      ) : null}

      {/* Section A — Role */}
      <section className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[rgb(var(--foreground))]">Account role</p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Change the access level for this account.
          </p>
        </div>
        <UserRoleSwitch value={selectedRole} disabled={isSubmitting} onChange={handleRoleChange} />
        <FieldError message={getFieldError(errors, "role")} />
      </section>

      {/* Section B — Profile details */}
      <section className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
            Profile details
          </p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Basic information about the person.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="edit-user-full-name">Full name</FieldLabel>
            <Input
              id="edit-user-full-name"
              placeholder="Arjun Mehta"
              disabled={isSubmitting}
              {...register("fullName")}
            />
            <FieldError message={getFieldError(errors, "fullName")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="edit-user-phone">Phone</FieldLabel>
            <Input
              id="edit-user-phone"
              type="tel"
              inputMode="tel"
              placeholder="98765 43210"
              disabled={isSubmitting}
              {...register("phone")}
            />
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              10-digit Indian mobile number.
            </p>
            <FieldError message={getFieldError(errors, "phone")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="edit-user-alt-phone" optional>
              Alternate phone
            </FieldLabel>
            <Input
              id="edit-user-alt-phone"
              type="tel"
              inputMode="tel"
              placeholder="91234 56789"
              disabled={isSubmitting}
              {...register("alternatePhone")}
            />
            <FieldError message={getFieldError(errors, "alternatePhone")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="edit-user-email" optional>
              Email
            </FieldLabel>
            <Input
              id="edit-user-email"
              type="email"
              inputMode="email"
              placeholder="arjun@example.com"
              disabled={isSubmitting}
              {...register("email")}
            />
            <FieldError message={getFieldError(errors, "email")} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="edit-user-address" optional>
              Address
            </FieldLabel>
            <Textarea
              id="edit-user-address"
              placeholder="Home or work address"
              disabled={isSubmitting}
              {...register("address")}
            />
            <FieldError message={getFieldError(errors, "address")} />
          </div>
        </div>
      </section>

      {/* Section C — Access details */}
      <section className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Access details</p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            {branchRequired
              ? "Branch assignment and account status."
              : "Account status. Branch is optional for admin accounts."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className={branchRequired ? "space-y-2 md:col-span-2" : "space-y-2"}>
            <FieldLabel htmlFor="edit-user-branch">Branch</FieldLabel>
            {branchOptions.length === 0 ? (
              <p className="text-sm text-[rgb(var(--muted-foreground))]">No branches available.</p>
            ) : (
              <Select
                id="edit-user-branch"
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

          <div className="space-y-2">
            <FieldLabel htmlFor="edit-user-status">Account status</FieldLabel>
            <Select
              id="edit-user-status"
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
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
              Username and password
            </p>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Username cannot be changed here. To reset the password, use the Reset password action
              in the users list.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          className="rounded-2xl px-4"
          disabled={isSubmitting}
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="rounded-2xl px-5">
          {isSubmitting ? (
            <>
              <Spinner size="xs" ariaHidden className="mr-2" />
              Saving...
            </>
          ) : (
            `Save ${userRoleLabels[selectedRole]} Account`
          )}
        </Button>
      </div>
    </form>
  );
}
