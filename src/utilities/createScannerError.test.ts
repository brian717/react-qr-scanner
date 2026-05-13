import { describe, expect, it } from 'vitest';
import { createScannerError } from './createScannerError';

function makeDomException(name: string, message = ''): DOMException {
	const err = new Error(message) as Error & { name: string };
	err.name = name;
	return err as unknown as DOMException;
}

describe('createScannerError', () => {
	it('maps NotAllowedError to permission-denied', () => {
		const e = createScannerError(makeDomException('NotAllowedError', 'no'));
		expect(e.kind).toBe('permission-denied');
	});

	it('maps NotFoundError to no-camera', () => {
		const e = createScannerError(makeDomException('NotFoundError', 'none'));
		expect(e.kind).toBe('no-camera');
	});

	it('maps NotReadableError to in-use', () => {
		const e = createScannerError(makeDomException('NotReadableError', 'used'));
		expect(e.kind).toBe('in-use');
	});

	it('maps OverconstrainedError to overconstrained', () => {
		const e = createScannerError(
			makeDomException('OverconstrainedError', 'bad'),
		);
		expect(e.kind).toBe('overconstrained');
	});

	it('maps AbortError to aborted', () => {
		const e = createScannerError(makeDomException('AbortError'));
		expect(e.kind).toBe('aborted');
	});

	it('detects secure-context message as insecure-context', () => {
		const e = createScannerError(
			new Error('camera access is only permitted in secure context.'),
		);
		expect(e.kind).toBe('insecure-context');
	});

	it('detects Stream API message as unsupported', () => {
		const e = createScannerError(
			new Error('this browser has no Stream API support'),
		);
		expect(e.kind).toBe('unsupported');
	});

	it('falls back to unknown for strings', () => {
		const e = createScannerError('weird');
		expect(e.kind).toBe('unknown');
		expect(e.message).toBe('weird');
		expect(e.cause).toBe('weird');
	});

	it('falls back to unknown for unmapped names', () => {
		const e = createScannerError(makeDomException('MysteryError', 'huh'));
		expect(e.kind).toBe('unknown');
	});
});
