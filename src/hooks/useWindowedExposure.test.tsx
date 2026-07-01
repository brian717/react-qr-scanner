import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWindowedExposure } from './useWindowedExposure';

interface MockTrackOptions {
	exposureTime?: { min: number; max: number; step: number };
	exposureMode?: string[];
	currentExposureTime?: number;
}

function makeMockTrack(options: MockTrackOptions = {}) {
	const {
		exposureTime = { min: 10, max: 10000, step: 1 },
		exposureMode = ['continuous', 'manual'],
		currentExposureTime = 300,
	} = options;

	return {
		getCapabilities: vi.fn(() => ({ exposureTime, exposureMode })),
		getSettings: vi.fn(() => ({ exposureTime: currentExposureTime })),
		applyConstraints: vi.fn(async () => {}),
	};
}

function makeMockVideo() {
	return {
		readyState: 4,
		HAVE_ENOUGH_DATA: 4,
		videoWidth: 640,
		videoHeight: 480,
	} as unknown as HTMLVideoElement;
}

function makeImageData(width: number, height: number, luma: number) {
	const data = new Uint8ClampedArray(width * height * 4);

	for (let i = 0; i < data.length; i += 4) {
		data[i] = luma;
		data[i + 1] = luma;
		data[i + 2] = luma;
		data[i + 3] = 255;
	}

	return { data, width, height } as ImageData;
}

describe('useWindowedExposure', () => {
	let rafCallbacks: Map<number, FrameRequestCallback>;
	let frameLuma: number;

	beforeEach(() => {
		rafCallbacks = new Map();
		frameLuma = 50;

		let nextRafId = 1;

		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			const id = nextRafId++;

			rafCallbacks.set(id, cb);

			return id;
		});
		vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
			rafCallbacks.delete(id);
		});

		// happy-dom has no 2D canvas; hand the hook a fake whose getImageData
		// returns a uniform frame at `frameLuma` (r = g = b, so APL === luma).
		const originalCreateElement = document.createElement.bind(document);

		vi.spyOn(document, 'createElement').mockImplementation(
			(tagName: string, elementOptions?: ElementCreationOptions) => {
				if (tagName !== 'canvas') {
					return originalCreateElement(tagName, elementOptions);
				}

				const ctx = {
					drawImage: vi.fn(),
					getImageData: vi.fn((_x: number, _y: number, w: number, h: number) =>
						makeImageData(w, h, frameLuma),
					),
				};

				return {
					width: 0,
					height: 0,
					getContext: vi.fn(() => ctx),
				} as unknown as HTMLCanvasElement;
			},
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function fireFrame(timeNow: number) {
		const callbacks = [...rafCallbacks.values()];

		rafCallbacks.clear();

		await act(async () => {
			for (const cb of callbacks) cb(timeNow);
		});
	}

	function renderWired(
		track: ReturnType<typeof makeMockTrack>,
		options?: Parameters<typeof useWindowedExposure>[0],
	) {
		const rendered = renderHook(() => useWindowedExposure(options));

		act(() => {
			rendered.result.current.setVideoElement(makeMockVideo());
			rendered.result.current.setVideoTrack(
				track as unknown as MediaStreamTrack,
			);
		});

		return rendered;
	}

	it('scales the reported exposure time toward the target APL', async () => {
		const track = makeMockTrack({ currentExposureTime: 300 });

		renderWired(track);
		await fireFrame(1000);

		// APL 50 vs target 100 doubles the current exposure time.
		expect(track.applyConstraints).toHaveBeenCalledWith({
			advanced: [{ exposureMode: 'manual', exposureTime: 600 }],
		});
	});

	it('clamps the exposure time to the capability range', async () => {
		const track = makeMockTrack({
			exposureTime: { min: 10, max: 500, step: 1 },
			currentExposureTime: 300,
		});

		renderWired(track);
		await fireFrame(1000);

		expect(track.applyConstraints).toHaveBeenCalledWith({
			advanced: [{ exposureMode: 'manual', exposureTime: 500 }],
		});
	});

	it('skips adjustment when the APL is within the target range', async () => {
		const track = makeMockTrack();

		frameLuma = 102;

		renderWired(track);
		await fireFrame(1000);

		expect(track.applyConstraints).not.toHaveBeenCalled();
	});

	it('reports an error and stays idle when manual exposure is unsupported', async () => {
		const track = makeMockTrack({ exposureMode: ['continuous'] });
		const onError = vi.fn();

		renderWired(track, { onError });
		await fireFrame(1000);

		expect(onError).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringContaining('manual exposure'),
			}),
		);
		expect(track.applyConstraints).not.toHaveBeenCalled();
	});

	it('keeps adjusting after a failed constraint update', async () => {
		const track = makeMockTrack();
		const onError = vi.fn();

		track.applyConstraints.mockRejectedValueOnce(new Error('boom'));

		renderWired(track, { onError });
		await fireFrame(1000);

		expect(track.applyConstraints).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledTimes(1);

		// Within updateInterval of the failure: rate-limited, no retry.
		await fireFrame(1100);
		expect(track.applyConstraints).toHaveBeenCalledTimes(1);

		// Past updateInterval: the failure must not wedge the controller.
		await fireFrame(1300);
		expect(track.applyConstraints).toHaveBeenCalledTimes(2);
	});

	it('rate-limits adjustments to updateInterval', async () => {
		const track = makeMockTrack();

		renderWired(track);
		await fireFrame(1000);
		await fireFrame(1100);

		expect(track.applyConstraints).toHaveBeenCalledTimes(1);
	});

	it('stops metering while paused and keeps the manual exposure', async () => {
		const track = makeMockTrack();

		const { result } = renderWired(track);

		await fireFrame(1000);
		expect(track.applyConstraints).toHaveBeenCalledTimes(1);

		act(() => {
			result.current.setPaused(true);
		});

		await fireFrame(2000);

		expect(result.current.paused).toBe(true);
		expect(track.applyConstraints).toHaveBeenCalledTimes(1);
	});

	it('restores continuous auto-exposure on unmount after applying manual', async () => {
		const track = makeMockTrack();

		const { unmount } = renderWired(track);

		await fireFrame(1000);
		unmount();

		expect(track.applyConstraints).toHaveBeenLastCalledWith({
			advanced: [{ exposureMode: 'continuous' }],
		});
	});

	it('does not touch the exposure mode on unmount when manual was never applied', async () => {
		const track = makeMockTrack();

		frameLuma = 100;

		const { unmount } = renderWired(track);

		await fireFrame(1000);
		unmount();

		expect(track.applyConstraints).not.toHaveBeenCalled();
	});
});
