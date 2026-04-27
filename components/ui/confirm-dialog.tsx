"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmKeyword?: string;
  confirmLabel?: string;
  isPending?: boolean;
  children?: React.ReactNode;
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmKeyword = "delete",
  confirmLabel = "Delete",
  isPending = false,
  children,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canConfirm = typed === confirmKeyword && !isPending;

  useEffect(() => {
    if (!isOpen) {
      setTyped("");
      return;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  async function handleConfirm() {
    if (!canConfirm) return;
    await onConfirm();
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="px-5 pb-5 pt-4">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgb(var(--destructive)/0.1)]">
          <AlertTriangle
            className="h-5 w-5 text-[rgb(var(--destructive))]"
            aria-hidden="true"
            strokeWidth={1.9}
          />
        </div>

        {description ? (
          <p className="mb-4 text-sm text-[rgb(var(--muted-foreground))]">{description}</p>
        ) : null}

        {children ? <div className="mb-4">{children}</div> : null}

        <div className="mb-5">
          <label
            htmlFor="confirm-keyword-input"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]"
          >
            Type&nbsp;
            <span className="font-mono normal-case tracking-normal text-[rgb(var(--foreground))]">
              {confirmKeyword}
            </span>
            &nbsp;to confirm
          </label>
          <Input
            ref={inputRef}
            id="confirm-keyword-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
            placeholder={confirmKeyword}
            autoComplete="off"
            spellCheck={false}
            disabled={isPending}
            className="font-mono"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            className="h-10 rounded-2xl px-4 shadow-none"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 rounded-2xl bg-[rgb(var(--destructive))] px-5 shadow-none hover:bg-[rgb(var(--destructive)/0.9)]"
            onClick={handleConfirm}
            disabled={!canConfirm}
            aria-busy={isPending}
          >
            {isPending ? (
              <>
                <Spinner size="xs" ariaHidden className="mr-2" />
                Deleting...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
