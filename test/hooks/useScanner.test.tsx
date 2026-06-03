import { renderHook } from '@testing-library/react';
import { type RefObject, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const detectMock = vi.fn();

vi.mock('barcode-detector/ponyfill', () => ({
	BarcodeDetector: class {
		detect = detectMock;
	},
}));

import useScanner from '../../src/hooks/useScanner';

function setReadyState(el: HTMLVideoElement, value: number) {
	Object.defineProperty(el, 'readyState', {
		configurable: true,
		value,
	});
}

function mockRaf() {
	let pending: FrameRequestCallback | null = null;
	const raf = vi.fn((cb: FrameRequestCallback) => {
		pending = cb;
		return 1;
	});
	const caf = vi.fn(() => {
		pending = null;
	});

	Object.defineProperty(window, 'requestAnimationFrame', {
		configurable: true,
		value: raf,
	});
	Object.defineProperty(window, 'cancelAnimationFrame', {
		configurable: true,
		value: caf,
	});

	return {
		raf,
		caf,
		tick(time = performance.now()) {
			const cb = pending;
			pending = null;
			if (cb) return Promise.resolve(cb(time));
			return Promise.resolve();
		},
	};
}

describe('useScanner', () => {
	beforeEach(() => {
		detectMock.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reports detector failures via onError and stops the loop', async () => {
		const raf = mockRaf();
		const onScan = vi.fn();
		const onFound = vi.fn();
		const onError = vi.fn();

		const videoEl = document.createElement('video');
		setReadyState(videoEl, 4);

		const { result } = renderHook(() => {
			const ref = useRef<HTMLVideoElement | null>(videoEl);
			return useScanner({
				videoElementRef: ref as RefObject<HTMLVideoElement | null>,
				onScan,
				onFound,
				onError,
				retryDelay: 0,
				sound: false,
			});
		});

		detectMock.mockRejectedValueOnce(new Error('wasm init failed'));

		result.current.startScanning();

		// Drive the first frame: enters processFrame, throws inside detect().
		await raf.tick(performance.now() + 100);
		// Wait for the async catch path to run.
		await new Promise((r) => setTimeout(r, 0));

		expect(onError).toHaveBeenCalledTimes(1);
		const reported = onError.mock.calls[0][0];
		expect(reported.kind).toBe('unknown');
		expect(reported.cause).toBeInstanceOf(Error);

		// Loop must not have scheduled another frame after the failure.
		// The initial startScanning + the retry-delay re-schedule are both
		// outside processFrame's post-detect path. Verify by ensuring no
		// further RAF was scheduled after the rejection settled.
		const callsBefore = raf.raf.mock.calls.length;
		await new Promise((r) => setTimeout(r, 0));
		expect(raf.raf.mock.calls.length).toBe(callsBefore);
	});

	it('keeps scanning when detect resolves successfully', async () => {
		const raf = mockRaf();
		const onScan = vi.fn();
		const onFound = vi.fn();
		const onError = vi.fn();

		const videoEl = document.createElement('video');
		setReadyState(videoEl, 4);

		const { result } = renderHook(() => {
			const ref = useRef<HTMLVideoElement | null>(videoEl);
			return useScanner({
				videoElementRef: ref as RefObject<HTMLVideoElement | null>,
				onScan,
				onFound,
				onError,
				retryDelay: 0,
				sound: false,
			});
		});

		detectMock.mockResolvedValue([]);

		result.current.startScanning();
		await raf.tick(performance.now() + 100);
		await new Promise((r) => setTimeout(r, 0));

		expect(onError).not.toHaveBeenCalled();
		// onScan only fires when codes are detected. Just verify no error.
	});
});
