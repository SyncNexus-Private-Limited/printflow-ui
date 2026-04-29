import { DataTableContainer } from "@/components/dashboard/data-table-container";

type TableEmptyStateProps = {
  message: string;
  className?: string;
};

export function TableEmptyState({ message, className }: TableEmptyStateProps) {
  return (
    <DataTableContainer className={className}>
      <div className="px-6 py-12 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
        {message}
      </div>
    </DataTableContainer>
  );
}
