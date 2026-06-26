function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function clampRefundAmount(amount: number, basisAmount: number) {
  if (!Number.isFinite(amount)) return 0;
  return Math.min(Math.max(amount, 0), Math.max(basisAmount, 0));
}

export function clampRefundPercent(percent: number) {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(Math.max(percent, 0), 100);
}

export function percentToAmount(percent: number, basisAmount: number) {
  return roundMoney((clampRefundPercent(percent) / 100) * Math.max(basisAmount, 0));
}

export function amountToPercent(amount: number, basisAmount: number) {
  if (basisAmount <= 0) return 0;
  return roundMoney((clampRefundAmount(amount, basisAmount) / basisAmount) * 100);
}
