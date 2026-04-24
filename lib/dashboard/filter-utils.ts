export function normalizeAmountRange(
  min: string | null,
  max: string | null,
): { min: string | null; max: string | null } {
  if (!min || !max) {
    return { min, max };
  }

  const parsedMin = Number.parseFloat(min);
  const parsedMax = Number.parseFloat(max);

  if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax) || parsedMin <= parsedMax) {
    return { min, max };
  }

  return { min: max, max: min };
}
