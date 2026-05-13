import { describe, expect, it, vi } from 'vitest';

describe('isBarcodeDetectorSupported', () => {
	it('returns true when BarcodeDetector is on window at module-load time', async () => {
		vi.resetModules();
		(globalThis as { BarcodeDetector?: unknown }).BarcodeDetector = class {};

		const { isBarcodeDetectorSupported } = await import(
			'./isBarcodeDetectorSupported'
		);

		expect(isBarcodeDetectorSupported()).toBe(true);

		delete (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
	});

	it('returns false when BarcodeDetector is missing at module-load time', async () => {
		vi.resetModules();
		delete (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;

		const { isBarcodeDetectorSupported } = await import(
			'./isBarcodeDetectorSupported'
		);

		expect(isBarcodeDetectorSupported()).toBe(false);
	});

	it('ignores polyfills installed after module-load time', async () => {
		vi.resetModules();
		delete (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;

		const { isBarcodeDetectorSupported } = await import(
			'./isBarcodeDetectorSupported'
		);

		// Simulate a consumer (or a side-effect import) installing the polyfill
		// after our snapshot was taken. The helper must still report that no
		// native implementation was available when we initialized.
		(globalThis as { BarcodeDetector?: unknown }).BarcodeDetector = class {};

		expect(isBarcodeDetectorSupported()).toBe(false);

		delete (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
	});
});
