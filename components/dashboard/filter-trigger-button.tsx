import { forwardRef } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type FilterTriggerButtonProps = {
  activeCount: number;
  isOpen: boolean;
  isPending: boolean;
  panelId: string;
  onClick: () => void;
};

export const FilterTriggerButton = forwardRef<HTMLButtonElement, FilterTriggerButtonProps>(
  function FilterTriggerButton({ activeCount, isOpen, isPending, panelId, onClick }, ref) {
    return (
      <Button
        ref={ref}
        type="button"
        variant="secondary"
        className="h-11 min-w-28 rounded-2xl px-4"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onClick}
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? (
          <Spinner size="xs" ariaHidden className="mr-2" />
        ) : (
          <Filter className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
        )}
        Filter
        {activeCount > 0 ? (
          <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[rgb(var(--primary-soft))] px-2 text-xs font-semibold text-[rgb(var(--primary-soft-foreground))]">
            {activeCount}
          </span>
        ) : null}
      </Button>
    );
  },
);
