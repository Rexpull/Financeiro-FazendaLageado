/**
 * OFX duplicate detection must be scoped by bank account.
 * Same FITID on another ContaCorrente is a different movement — never reuse cross-account.
 */
export function shouldReuseOfxMovimento(args: {
	existingIdContaCorrente: number | null | undefined;
	incomingIdContaCorrente: number | null | undefined;
}): boolean {
	const existing = Number(args.existingIdContaCorrente);
	const incoming = Number(args.incomingIdContaCorrente);
	if (!Number.isFinite(existing) || existing <= 0) return false;
	if (!Number.isFinite(incoming) || incoming <= 0) return false;
	return existing === incoming;
}
