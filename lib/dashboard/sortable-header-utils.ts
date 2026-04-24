export type SortDirection = "asc" | "desc";

export type HeaderSortConfig<TSortValue extends string = string> = {
  asc: TSortValue;
  desc: TSortValue;
  defaultDirection: SortDirection;
};

export function getSortDirection<TSortValue extends string>(
  currentSort: TSortValue,
  sortConfig: HeaderSortConfig<TSortValue>,
): SortDirection | null {
  if (currentSort === sortConfig.asc) return "asc";
  if (currentSort === sortConfig.desc) return "desc";
  return null;
}

export function getNextSortValue<TSortValue extends string>(
  currentSort: TSortValue,
  sortConfig: HeaderSortConfig<TSortValue>,
): TSortValue {
  const activeDirection = getSortDirection(currentSort, sortConfig);

  if (activeDirection === "asc") return sortConfig.desc;
  if (activeDirection === "desc") return sortConfig.asc;

  return sortConfig.defaultDirection === "desc" ? sortConfig.desc : sortConfig.asc;
}

export function getNextSortDirectionLabel<TSortValue extends string>(
  currentSort: TSortValue,
  sortConfig: HeaderSortConfig<TSortValue>,
): string {
  const nextSortValue = getNextSortValue(currentSort, sortConfig);

  return nextSortValue === sortConfig.asc ? "ascending" : "descending";
}
