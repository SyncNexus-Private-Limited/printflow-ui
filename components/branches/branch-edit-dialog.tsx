"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { branchSchema } from "@/lib/branches/schema";
import type {
  BranchFieldName,
  BranchFormValues,
  BranchMutationResponse,
  EditBranchRow,
} from "@/lib/branches/types";
import { formatDateTime } from "@/lib/utils/format";

type BranchDetailApiResponse =
  | { success: true; data: { branch: EditBranchRow } }
  | { success: false; message: string };

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; branch: EditBranchRow };

type BranchEditDialogProps = {
  branchId: string | null;
  onClose: () => void;
  onSuccess: () => void;
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
      className="block text-[11px] font-semibold tracking-[0.16em] text-[rgb(var(--muted-foreground))] uppercase"
    >
      {children}
      {optional ? (
        <span className="ml-1.5 font-normal tracking-normal normal-case">Optional</span>
      ) : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-[rgb(var(--danger))]">{message}</p> : null;
}

function buildDefaultValues(branch: EditBranchRow): BranchFormValues {
  return {
    code: branch.code,
    name: branch.name,
    phone: branch.phone,
    alternatePhone: branch.alternatePhone ?? "",
    email: branch.email ?? "",
    address: branch.address ?? "",
    logo: branch.logo ?? "",
    banner: branch.banner ?? "",
    description: branch.description ?? "",
    isActive: branch.isActive,
  };
}

export function BranchEditDialog({ branchId, onClose, onSuccess }: BranchEditDialogProps) {
  const isOpen = branchId !== null;
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [serverError, setServerError] = useState<string | null>(null);
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
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema) as unknown as Resolver<BranchFormValues>,
    defaultValues: {
      code: "",
      name: "",
      phone: "",
      alternatePhone: "",
      email: "",
      address: "",
      logo: "",
      banner: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!branchId) {
      abortRef.current?.abort();
      setLoadState({ status: "idle" });
      setServerError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState({ status: "loading" });
    setServerError(null);

    fetch(`/api/branches/${branchId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as BranchDetailApiResponse;
        if (!data.success) {
          setLoadState({ status: "error", message: data.message });
          return;
        }
        reset(buildDefaultValues(data.data.branch));
        setLoadState({ status: "ready", branch: data.data.branch });
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadState({ status: "error", message: "Unable to load branch details right now." });
      });

    return () => controller.abort();
  }, [branchId, reset]);

  const isActive = watch("isActive");

  function getFieldError(field: BranchFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const onSubmit = handleSubmit(async (values) => {
    if (loadState.status !== "ready") return;
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch(`/api/branches/${loadState.branch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...values }),
      });
      const data = (await res.json().catch(() => null)) as BranchMutationResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<
            [BranchFieldName, string]
          >) {
            if (message) setError(field, { type: "server", message });
          }
        }
        setServerError(data && !data.success ? data.message : "Unable to save changes right now.");
        return;
      }

      onSuccess();
    } catch {
      setServerError("Unable to save changes right now.");
    }
  });

  const readyBranch = loadState.status === "ready" ? loadState.branch : null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit branch"
      description="Changes are saved immediately and existing references remain linked."
      size="lg"
    >
      {loadState.status === "loading" || loadState.status === "idle" ? (
        <div className="space-y-4 px-5 pt-4 pb-6" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="grid gap-4 sm:grid-cols-2">
              <div className="h-11 animate-pulse rounded-xl bg-[rgb(var(--muted)/0.5)]" />
              <div className="h-11 animate-pulse rounded-xl bg-[rgb(var(--muted)/0.5)]" />
            </div>
          ))}
        </div>
      ) : loadState.status === "error" ? (
        <div className="px-5 py-8 text-center text-sm text-[rgb(var(--muted-foreground))]">
          {loadState.message}
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-5 px-5 pt-4 pb-2">
            {serverError ? (
              <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
                {serverError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-branch-code">Code</FieldLabel>
                <Input
                  id="edit-branch-code"
                  disabled={isSubmitting}
                  {...register("code")}
                  onChange={(e) =>
                    setValue("code", e.target.value.toUpperCase(), { shouldDirty: true })
                  }
                />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  4–25 characters. Uppercase letters, numbers, and hyphens only.
                </p>
                <FieldError message={getFieldError("code")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-branch-name">Name</FieldLabel>
                <Input id="edit-branch-name" disabled={isSubmitting} {...register("name")} />
                <FieldError message={getFieldError("name")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-branch-phone">Phone</FieldLabel>
                <Input
                  id="edit-branch-phone"
                  inputMode="tel"
                  disabled={isSubmitting}
                  {...register("phone")}
                />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  10-digit Indian mobile number (starts with 6–9).
                </p>
                <FieldError message={getFieldError("phone")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-branch-alternate-phone" optional>
                  Alternate phone
                </FieldLabel>
                <Input
                  id="edit-branch-alternate-phone"
                  inputMode="tel"
                  disabled={isSubmitting}
                  {...register("alternatePhone")}
                />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  10-digit Indian mobile number (starts with 6–9).
                </p>
                <FieldError message={getFieldError("alternatePhone")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-branch-email" optional>
                  Email
                </FieldLabel>
                <Input
                  id="edit-branch-email"
                  type="email"
                  disabled={isSubmitting}
                  {...register("email")}
                />
                <FieldError message={getFieldError("email")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-branch-status">Status</FieldLabel>
                <Select
                  id="edit-branch-status"
                  value={isActive ? "active" : "inactive"}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setValue("isActive", event.target.value === "active", {
                      shouldValidate: true,
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
                <FieldError message={getFieldError("isActive")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-branch-logo" optional>
                  Logo URL
                </FieldLabel>
                <Input id="edit-branch-logo" disabled={isSubmitting} {...register("logo")} />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  Enter a full http or https URL.
                </p>
                <FieldError message={getFieldError("logo")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-branch-banner" optional>
                  Banner URL
                </FieldLabel>
                <Input id="edit-branch-banner" disabled={isSubmitting} {...register("banner")} />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  Enter a full http or https URL.
                </p>
                <FieldError message={getFieldError("banner")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel htmlFor="edit-branch-address" optional>
                  Address
                </FieldLabel>
                <Textarea
                  id="edit-branch-address"
                  disabled={isSubmitting}
                  {...register("address")}
                />
                <FieldError message={getFieldError("address")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel htmlFor="edit-branch-description" optional>
                  Description
                </FieldLabel>
                <Textarea
                  id="edit-branch-description"
                  disabled={isSubmitting}
                  {...register("description")}
                />
                <FieldError message={getFieldError("description")} />
              </div>
            </div>

            {readyBranch ? (
              <div className="rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] px-4 py-3 text-xs text-[rgb(var(--muted-foreground))]">
                Created {formatDateTime(readyBranch.createdAt)}
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-5 py-4">
            {readyBranch ? (
              <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
                Last modified by{" "}
                <span className="font-medium text-[rgb(var(--foreground))]">
                  {readyBranch.updatedByName ?? "Unknown user"}
                </span>{" "}
                on {formatDateTime(readyBranch.updatedAt)}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4 shadow-none"
                disabled={isSubmitting}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10 min-w-28 rounded-2xl px-5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="xs" ariaHidden className="mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  );
}
