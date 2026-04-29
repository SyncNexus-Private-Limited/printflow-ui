"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { UserRoleSwitch } from "@/components/users/user-role-switch";
import { createUserSchema } from "@/lib/users/schema";
import { userRoleLabels, type CreateUserApiResponse, type CreateUserFieldName, type CreateUserFormValues, type UserFormPageData, type UserRole } from "@/lib/users/types";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

type UserFormProps = UserFormPageData & {
  showSuccess?: boolean;
};

function buildDefaultValues(selectedBranchId: string, selectedRole: UserRole): CreateUserFormValues {
  return {
    role: selectedRole,
    branchId: selectedBranchId,
    fullName: "",
    phone: "",
    alternatePhone: "",
    email: "",
    address: "",
    username: "",
    password: "",
    confirmPassword: "",
    isActive: true,
  };
}

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
    <label className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--foreground))]" htmlFor={htmlFor}>
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
  errors: ReturnType<typeof useForm<CreateUserFormValues>>["formState"]["errors"],
  field: CreateUserFieldName,
): string | undefined {
  const err = errors[field];
  if (!err || typeof err !== "object" || !("message" in err)) return undefined;
  return typeof err.message === "string" ? err.message : undefined;
}

export function UserForm({
  branchOptions,
  selectedBranchId,
  selectedRole,
  canSelectBranch,
  showSuccess = false,
}: UserFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showBlockingLoader, hideBlockingLoader } = useGlobalLoader();
  const [, startNavTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const defaultValues = useMemo(
    () => buildDefaultValues(selectedBranchId, selectedRole),
    [selectedBranchId, selectedRole],
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema) as unknown as Resolver<CreateUserFormValues>,
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
    setServerError(null);
  }, [defaultValues, reset]);

  const navigateToContext = (nextBranchId: string, nextRole: UserRole) => {
    const next = new URLSearchParams();
    if (nextBranchId) next.set("branchId", nextBranchId);
    next.set("role", nextRole);
    next.delete("created");
    const nextHref = `${pathname}?${next.toString()}`;
    const currentHref = `${pathname}?${searchParams.toString()}`;
    if (nextHref === currentHref) return;
    startNavTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();
    showBlockingLoader("Creating user account...", { autoHideOnRouteChange: true });

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json().catch(() => null)) as CreateUserApiResponse | null;

      if (!response.ok || !data || !("success" in data) || !data.success) {
        if (data && "fieldErrors" in data && data.fieldErrors) {
          for (const [fieldName, message] of Object.entries(data.fieldErrors) as Array<
            [CreateUserFieldName, string]
          >) {
            if (!message) continue;
            setError(fieldName, { type: "server", message });
          }
        }
        setServerError(
          data && "message" in data ? data.message : "Unable to create the user account right now.",
        );
        hideBlockingLoader();
        return;
      }

      router.push(data.data.redirectTo);
    } catch {
      setServerError("Unable to create the user account right now.");
      hideBlockingLoader();
    }
  });

  const isActiveValue = watch("isActive");
  const branchRequired = selectedRole !== "admin";

  return (
    <form className="space-y-8" onSubmit={onSubmit} noValidate>
      <input type="hidden" {...register("role")} value={selectedRole} />
      <input type="hidden" {...register("branchId")} value={selectedBranchId} />

      {/* Success banner */}
      {showSuccess ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[rgb(34_197_94/0.24)] bg-[rgb(34_197_94/0.08)] px-4 py-3">
          <ShieldCheck
            className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[rgb(34_197_94)]"
            aria-hidden="true"
            strokeWidth={1.9}
          />
          <p className="text-sm text-[rgb(34_197_94)]">
            {userRoleLabels[selectedRole]} account created successfully. You can create another one below.
          </p>
        </div>
      ) : null}

      {/* Server error */}
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
            Choose the access level for this account.
          </p>
        </div>
        <UserRoleSwitch
          value={selectedRole}
          disabled={isSubmitting}
          onChange={(nextRole) => navigateToContext(selectedBranchId, nextRole)}
        />
        <FieldError message={getFieldError(errors, "role")} />
      </section>

      {/* Section B — Profile details */}
      <section className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Profile details</p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Basic information about the person.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="user-full-name">Full name</FieldLabel>
            <Input
              id="user-full-name"
              placeholder="Arjun Mehta"
              disabled={isSubmitting}
              {...register("fullName")}
            />
            <FieldError message={getFieldError(errors, "fullName")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="user-phone">Phone</FieldLabel>
            <Input
              id="user-phone"
              type="tel"
              inputMode="tel"
              placeholder="+91 98765 43210"
              disabled={isSubmitting}
              {...register("phone")}
            />
            <FieldError message={getFieldError(errors, "phone")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="user-alt-phone" optional>
              Alternate phone
            </FieldLabel>
            <Input
              id="user-alt-phone"
              type="tel"
              inputMode="tel"
              placeholder="+91 91234 56789"
              disabled={isSubmitting}
              {...register("alternatePhone")}
            />
            <FieldError message={getFieldError(errors, "alternatePhone")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="user-email" optional>
              Email
            </FieldLabel>
            <Input
              id="user-email"
              type="email"
              inputMode="email"
              placeholder="arjun@example.com"
              disabled={isSubmitting}
              {...register("email")}
            />
            <FieldError message={getFieldError(errors, "email")} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="user-address" optional>
              Address
            </FieldLabel>
            <Textarea
              id="user-address"
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
              ? "Branch assignment, login credentials, and account status."
              : "Login credentials and account status. Branch is optional for admin accounts."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className={branchRequired ? "space-y-2 md:col-span-2" : "space-y-2"}>
            <FieldLabel htmlFor="user-branch">
              {branchRequired ? "Branch" : "Branch"}
            </FieldLabel>
            {branchOptions.length === 0 ? (
              <p className="text-sm text-[rgb(var(--muted-foreground))]">No branches available.</p>
            ) : (
              <Select
                id="user-branch"
                value={selectedBranchId}
                disabled={isSubmitting || !canSelectBranch}
                onChange={(e) => navigateToContext(e.target.value, selectedRole)}
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
            <FieldLabel htmlFor="user-status">Account status</FieldLabel>
            <Select
              id="user-status"
              disabled={isSubmitting}
              value={isActiveValue ? "active" : "inactive"}
              onChange={(e) =>
                setValue("isActive", e.target.value === "active", { shouldValidate: true })
              }
            >
              <option value="active">Active — can log in immediately</option>
              <option value="inactive">Inactive — account disabled</option>
            </Select>
            <FieldError message={getFieldError(errors, "isActive")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="user-username">Username</FieldLabel>
            <Input
              id="user-username"
              autoComplete="off"
              placeholder="arjun_mehta"
              disabled={isSubmitting}
              {...register("username")}
            />
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Used to log in. Letters, numbers, underscores, hyphens, and dots only.
            </p>
            <FieldError message={getFieldError(errors, "username")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="user-password">Password</FieldLabel>
            <div className="relative">
              <Input
                id="user-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                disabled={isSubmitting}
                className="pr-16"
                {...register("password")}
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
            <FieldError message={getFieldError(errors, "password")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="user-confirm-password">Confirm password</FieldLabel>
            <div className="relative">
              <Input
                id="user-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat password"
                disabled={isSubmitting}
                className="pr-16"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
            <FieldError message={getFieldError(errors, "confirmPassword")} />
          </div>
        </div>

        <div className="rounded-[22px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
              Password stored securely
            </p>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Passwords are hashed with bcrypt before storage. They are never visible after creation.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={isSubmitting} className="rounded-2xl px-5">
          {isSubmitting ? (
            <>
              <Spinner size="xs" ariaHidden className="mr-2" />
              Creating account...
            </>
          ) : (
            `Create ${userRoleLabels[selectedRole]} Account`
          )}
        </Button>
      </div>
    </form>
  );
}

// Keep old name exported for any import that wasn't updated yet.
export { UserForm as StaffAccountForm };
