"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { ExpenseTypeSwitch } from "@/components/expenses/expense-type-switch";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CreateExpenseFormValues } from "@/lib/expenses/schema";
import {
  paymentModeLabels,
  paymentModeValues,
  type CreateExpenseFieldName,
  type ExpenseFormPageData,
  type ExpenseType,
} from "@/lib/expenses/types";

type ExpenseFormFieldsProps = Pick<
  ExpenseFormPageData,
  | "branchOptions"
  | "selectedBranchId"
  | "selectedType"
  | "canSelectBranch"
  | "categoryOptions"
  | "employeeOptions"
  | "vendorOptions"
  | "orderOptions"
  | "orderVendorOptions"
> & {
  errors: FieldErrors<CreateExpenseFormValues>;
  isSubmitting: boolean;
  register: UseFormRegister<CreateExpenseFormValues>;
  control: Control<CreateExpenseFormValues>;
  selectedVendorId: string;
  onTypeChange: (nextType: ExpenseType) => void;
  onBranchChange: (nextBranchId: string) => void;
};

function getFieldErrorMessage(
  errors: FieldErrors<CreateExpenseFormValues>,
  fieldName: CreateExpenseFieldName,
) {
  const fieldError = errors[fieldName];

  if (!fieldError || typeof fieldError !== "object" || !("message" in fieldError)) {
    return undefined;
  }

  return typeof fieldError.message === "string" ? fieldError.message : undefined;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-[rgb(var(--danger))]">{message}</p> : null;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label className="block text-sm font-medium text-[rgb(var(--foreground))]" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function ExpenseFormFields({
  branchOptions,
  selectedBranchId,
  selectedType,
  canSelectBranch,
  categoryOptions,
  employeeOptions,
  vendorOptions,
  orderOptions,
  orderVendorOptions,
  errors,
  isSubmitting,
  register,
  control,
  selectedVendorId,
  onTypeChange,
  onBranchChange,
}: ExpenseFormFieldsProps) {
  const branchError = getFieldErrorMessage(errors, "branchId");
  const filteredOrderVendorOptions =
    selectedVendorId.length > 0
      ? orderVendorOptions.filter((option) => option.vendorId === selectedVendorId)
      : orderVendorOptions;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[rgb(var(--foreground))]">Expense type</p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Pick the expense flow before filling the details.
          </p>
        </div>
        <ExpenseTypeSwitch value={selectedType} disabled={isSubmitting} onChange={onTypeChange} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel htmlFor="expense-branch">Branch</FieldLabel>
          <Select
            id="expense-branch"
            value={selectedBranchId}
            disabled={isSubmitting || !canSelectBranch}
            onChange={(event) => onBranchChange(event.target.value)}
          >
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <FieldError message={branchError} />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="expense-title">Title</FieldLabel>
          <Input
            id="expense-title"
            placeholder={selectedType === "business" ? "Electricity bill" : "Local delivery travel"}
            disabled={isSubmitting}
            {...register("title")}
          />
          <p className="text-sm text-[rgb(var(--muted-foreground))]">2–120 characters.</p>
          <FieldError message={getFieldErrorMessage(errors, "title")} />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="expense-category">Category</FieldLabel>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <CategoryCombobox
                id="expense-category"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={categoryOptions}
                disabled={isSubmitting}
              />
            )}
          />
          <FieldError message={getFieldErrorMessage(errors, "categoryId")} />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="expense-amount">Amount</FieldLabel>
          <Input
            id="expense-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            disabled={isSubmitting}
            {...register("amount")}
          />
          <FieldError message={getFieldErrorMessage(errors, "amount")} />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="expense-payment-mode">Payment mode</FieldLabel>
          <Select id="expense-payment-mode" disabled={isSubmitting} {...register("paymentMode")}>
            {paymentModeValues.map((mode) => (
              <option key={mode} value={mode}>
                {paymentModeLabels[mode]}
              </option>
            ))}
          </Select>
          <FieldError message={getFieldErrorMessage(errors, "paymentMode")} />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="expense-date">Expense date</FieldLabel>
          <Input
            id="expense-date"
            type="date"
            disabled={isSubmitting}
            {...register("expenseDate")}
          />
          <FieldError message={getFieldErrorMessage(errors, "expenseDate")} />
        </div>
      </section>

      {selectedType === "business" ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="expense-vendor">Vendor</FieldLabel>
            <Select
              id="expense-vendor"
              disabled={isSubmitting || vendorOptions.length === 0}
              defaultValue=""
              {...register("vendorId")}
            >
              <option value="">No vendor</option>
              {vendorOptions.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </Select>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Use vendor to narrow linked order-vendor records when needed.
            </p>
            <FieldError message={getFieldErrorMessage(errors, "vendorId")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="expense-order-vendor">Linked order vendor</FieldLabel>
            <Select
              id="expense-order-vendor"
              disabled={isSubmitting || filteredOrderVendorOptions.length === 0}
              defaultValue=""
              {...register("orderVendorId")}
            >
              <option value="">
                {filteredOrderVendorOptions.length === 0
                  ? selectedVendorId
                    ? "No linked order vendors for this vendor"
                    : "No linked order vendors"
                  : "No linked order vendor"}
              </option>
              {filteredOrderVendorOptions.map((orderVendor) => (
                <option key={orderVendor.id} value={orderVendor.id}>
                  {orderVendor.vendorName} - {orderVendor.orderCode}
                </option>
              ))}
            </Select>
            <FieldError message={getFieldErrorMessage(errors, "orderVendorId")} />
          </div>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="expense-employee">Employee</FieldLabel>
            <Select
              id="expense-employee"
              disabled={isSubmitting || employeeOptions.length === 0}
              defaultValue=""
              {...register("employeeId")}
            >
              <option value="" disabled>
                {employeeOptions.length === 0 ? "No employees available" : "Select an employee"}
              </option>
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} ({employee.role})
                </option>
              ))}
            </Select>
            <FieldError message={getFieldErrorMessage(errors, "employeeId")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="expense-order">Related order</FieldLabel>
            <Select
              id="expense-order"
              disabled={isSubmitting || orderOptions.length === 0}
              defaultValue=""
              {...register("orderId")}
            >
              <option value="">
                {orderOptions.length === 0 ? "No recent orders available" : "No linked order"}
              </option>
              {orderOptions.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderCode} - {order.customerName}
                </option>
              ))}
            </Select>
            <FieldError message={getFieldErrorMessage(errors, "orderId")} />
          </div>
        </section>
      )}

      <section className="space-y-2">
        <FieldLabel htmlFor="expense-remarks">Remarks</FieldLabel>
        <Textarea
          id="expense-remarks"
          placeholder="Add context or notes if needed"
          disabled={isSubmitting}
          {...register("remarks")}
        />
        <FieldError message={getFieldErrorMessage(errors, "remarks")} />
      </section>

      <section className="rounded-[22px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
            Receipts coming next
          </p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Attachment uploads are intentionally left out until the real storage flow is ready.
          </p>
        </div>
      </section>
    </div>
  );
}
