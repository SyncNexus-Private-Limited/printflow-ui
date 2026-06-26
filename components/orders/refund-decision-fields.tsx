"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { paymentModeLabels, paymentModeValues, type PaymentMode } from "@/lib/expenses/types";
import { formatCurrency } from "@/lib/utils/format";

type RefundDecisionFieldsProps = {
  reason: string;
  onReasonChange: (value: string) => void;
  reasonPlaceholder: string;
  amount: string;
  onAmountChange: (value: string) => void;
  percent: string;
  onPercentChange: (value: string) => void;
  refundMode: PaymentMode | "";
  onRefundModeChange: (value: PaymentMode) => void;
  txnReference: string;
  onTxnReferenceChange: (value: string) => void;
  basisAmount: number;
  basisLabel: string;
  disabled?: boolean;
};

export function RefundDecisionFields({
  reason,
  onReasonChange,
  reasonPlaceholder,
  amount,
  onAmountChange,
  percent,
  onPercentChange,
  refundMode,
  onRefundModeChange,
  txnReference,
  onTxnReferenceChange,
  basisAmount,
  basisLabel,
  disabled,
}: RefundDecisionFieldsProps) {
  return (
    <div className="space-y-4">
      <Textarea
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        placeholder={reasonPlaceholder}
        disabled={disabled}
        rows={3}
      />

      <p className="text-sm text-[rgb(var(--muted-foreground))]">
        {basisLabel}:{" "}
        <span className="font-medium text-[rgb(var(--card-foreground))]">
          {formatCurrency(basisAmount)}
        </span>
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted-foreground))]">
            Refund %
          </label>
          <Input
            value={percent}
            onChange={(event) => onPercentChange(event.target.value)}
            inputMode="decimal"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted-foreground))]">
            Refund amount (₹)
          </label>
          <Input
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            inputMode="decimal"
            disabled={disabled}
          />
        </div>
      </div>

      <Select
        value={refundMode}
        onChange={(event) => onRefundModeChange(event.target.value as PaymentMode)}
        disabled={disabled}
      >
        <option value="">Refund mode</option>
        {paymentModeValues.map((mode) => (
          <option key={mode} value={mode}>
            {mode === "credit" ? "Add to customer credits" : paymentModeLabels[mode]}
          </option>
        ))}
      </Select>

      {refundMode && refundMode !== "credit" ? (
        <Input
          value={txnReference}
          onChange={(event) => onTxnReferenceChange(event.target.value)}
          placeholder="Transaction reference (optional)"
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}
