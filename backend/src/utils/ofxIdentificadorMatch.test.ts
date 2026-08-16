import { describe, it, expect } from 'vitest';
import { shouldReuseOfxMovimento } from './ofxIdentificadorMatch';

describe('shouldReuseOfxMovimento', () => {
	it('reuses only when FITID match is on the same account', () => {
		expect(
			shouldReuseOfxMovimento({
				existingIdContaCorrente: 26,
				incomingIdContaCorrente: 26,
			}),
		).toBe(true);
	});

	it('does not reuse BB movement when importing into SICOOB', () => {
		// Regression: R$ 793.319,71 showed as BB RLF in Fluxo detail for SICOOB GJN
		expect(
			shouldReuseOfxMovimento({
				existingIdContaCorrente: 26, // BB RLF
				incomingIdContaCorrente: 27, // SICOOB GJN
			}),
		).toBe(false);
	});

	it('rejects missing account ids', () => {
		expect(
			shouldReuseOfxMovimento({
				existingIdContaCorrente: null,
				incomingIdContaCorrente: 27,
			}),
		).toBe(false);
	});
});
