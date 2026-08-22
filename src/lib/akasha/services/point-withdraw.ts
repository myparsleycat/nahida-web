export const POINT_WITHDRAW_FEE_BASE_PERCENT = 22;

export function effectiveWithdrawFeePercent(surchargePercent: number) {
    return surchargePercent + POINT_WITHDRAW_FEE_BASE_PERCENT;
}

export function quoteWithdrawal(amount: number, feePercent: number) {
    const fee = Math.floor((amount * feePercent) / 100);
    return { fee, payout: amount - fee };
}

export function parseWithdrawAmountInput(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const amount = Number(trimmed);
    if (!Number.isInteger(amount) || amount <= 0) return null;
    return amount;
}
