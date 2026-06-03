import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCamera from '../../src/hooks/useCamera';

interface IMockTrack {
	getSettings: ReturnType<typeof vi.fn>;
	getCapabilities: ReturnType<typeof vi.fn>;
	applyConstraints: ReturnType<typeof vi.fn>;
	stop: ReturnType<typeof vi.fn>;
	kind: 'video';
}

interface IMockStream {
	id: string;
	tracks: IMockTrack[];
	getTracks: () => IMockTrack[];
	getVideoTracks: () => IMockTrack[];
	removeTrack: (track: IMockTrack) => void;
}

function makeTrack(): IMockTrack {
	return {
		getSettings: vi.fn(() => ({})),
		getCapabilities: vi.fn(() => ({})),
		applyConstraints: vi.fn(async () => undefined),
		stop: vi.fn(),
		kind: 'video',
	};
}

function makeStream(track: IMockTrack): IMockStream {
	const tracks = [track];
	return {
		id: 'mock-stream',
		tracks,
		getTracks: () => tracks,
		getVideoTracks: () => tracks,
		removeTrack: (t) => {
			const idx = tracks.indexOf(t);
			if (idx >= 0) tracks.splice(idx, 1);
		},
	};
}

function makeVideoEl(): HTMLVideoElement {
	const el = document.createElement('video');
	let srcObjectStore: unknown = null;

	// happy-dom validates srcObject is a real MediaStream; bypass for the mock.
	Object.defineProperty(el, 'srcObject', {
		configurable: true,
		get() {
			return srcObjectStore;
		},
		set(v) {
			srcObjectStore = v;
		},
	});

	Object.defineProperty(el, 'play', {
		configurable: true,
		writable: true,
		value: vi.fn(async () => undefined),
	});

	Object.defineProperty(el, 'load', {
		configurable: true,
		writable: true,
		value: vi.fn(),
	});

	return el;
}

describe('useCamera', () => {
	let track: IMockTrack;
	let stream: IMockStream;

	beforeEach(() => {
		track = makeTrack();
		stream = makeStream(track);

		Object.defineProperty(window, 'isSecureContext', {
			configurable: true,
			value: true,
		});

		Object.defineProperty(navigator, 'mediaDevices', {
			configurable: true,
			value: {
				getUserMedia: vi.fn(async () => stream as unknown as MediaStream),
			},
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('still stops a live stream after a failed updateConstraints', async () => {
		const { result } = renderHook(() =>
			useCamera({ startTimeoutMs: 500, settleDelayMs: 0 }),
		);

		const videoEl = makeVideoEl();
		await result.current.startCamera(videoEl, { constraints: {} });

		// Make applyConstraints reject — simulates an overconstrained/hardware
		// failure path during a zoom or torch toggle.
		track.applyConstraints.mockRejectedValueOnce(
			new DOMException('boom', 'OverconstrainedError'),
		);

		await expect(
			result.current.updateConstraints({ advanced: [{ zoom: 5 }] }),
		).rejects.toThrow();

		// The stream must still be live (we didn't actually stop it).
		expect(track.stop).not.toHaveBeenCalled();

		// stopCamera() must actually tear down the track, not silently no-op
		// because the queue lied about being in `stop` state.
		await result.current.stopCamera();

		expect(track.stop).toHaveBeenCalledTimes(1);
	});

	it('routes torch + zoom mixing workaround through the queue', async () => {
		const { result } = renderHook(() =>
			useCamera({ startTimeoutMs: 500, settleDelayMs: 0 }),
		);

		const videoEl = makeVideoEl();
		await result.current.startCamera(videoEl, { constraints: {} });

		track.getCapabilities.mockReturnValue({ torch: true });
		track.getSettings.mockReturnValue({ torch: true });

		await result.current.updateConstraints({ advanced: [{ zoom: 3 }] });

		// First applyConstraints disables the torch, second applies the zoom.
		expect(track.applyConstraints).toHaveBeenNthCalledWith(1, {
			advanced: [{ torch: false }],
		});
		expect(track.applyConstraints).toHaveBeenNthCalledWith(2, {
			advanced: [{ zoom: 3 }],
		});
	});
});
