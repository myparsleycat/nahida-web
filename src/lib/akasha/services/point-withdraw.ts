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
