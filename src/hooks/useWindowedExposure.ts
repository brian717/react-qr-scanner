import { useEffect, useRef, useState } from 'react';
import type { IAPLWindow, IScannerError } from '../types';
import { createScannerError } from '../utilities/createScannerError';

export interface IUseWindowedExposureOptions {
	/** Average picture level (0-255 luma) the controller drives toward. Default 100. */
	targetAPL?: number;
	/**
	 * Returns the region of the video frame to meter, in video pixel
	 * coordinates. Defaults to a centered square sized to 20% of the smaller
	 * video dimension. Must be referentially stable (module-level or memoized);
	 * an inline function restarts the metering loop on every render.
	 */
	getWindow?: (videoWidth: number, videoHeight: number) => IAPLWindow;
	/** Minimum time (ms) between exposure adjustments. Default 200. */
	updateInterval?: number;
	/** Called when the track doesn't support manual exposure or a constraint update fails. */
	onError?: (error: IScannerError) => void;
}

export interface IUseWindowedExposureReturn {
	/** Provide the video element rendering the camera stream. Usable as a JSX `ref`. */
	setVideoElement: (element: HTMLVideoElement | null) => void;
	/** Provide the camera's video track. Pass `null` when the track stops. */
	setVideoTrack: (track: MediaStreamTrack | null) => void;
	/** Pause or resume metering. Pausing keeps the last manual exposure applied. */
	setPaused: (paused: boolean) => void;
	/** Whether metering is currently paused. */
	paused: boolean;
}

const DEFAULT_TARGET_APL = 100;
const MIN_APL_DIFFERENCE = 5;
const DEFAULT_UPDATE_INTERVAL_MS = 200;
// Starting exposure time (in the track's exposureTime units) when the track
// doesn't report its current value via getSettings().
const FALLBACK_EXPOSURE_TIME = 500;
const WINDOW_RATIO = 0.2;
// For a ~200x200 window, 1000 random samples land within a few percentage
// points of the exact APL.
const APL_SAMPLE_COUNT = 1000;

function defaultExposureWindow(
	videoWidth: number,
	videoHeight: number,
): IAPLWindow {
	const windowSize = Math.min(videoWidth, videoHeight) * WINDOW_RATIO;

	return {
		startX: (videoWidth - windowSize) / 2,
		startY: (videoHeight - windowSize) / 2,
		width: windowSize,
		height: windowSize,
	};
}

function approxAPL(
	imageData: ImageData,
	numSamples = APL_SAMPLE_COUNT,
): number {
	const { data, width, height } = imageData;
	const totalPixels = width * height;
	const samples = Math.min(totalPixels, numSamples);

	if (samples === 0) return 0;

	let sum = 0;

	for (let i = 0; i < samples; i++) {
		// RGBA has 4 components per pixel
		const index = Math.floor(Math.random() * totalPixels) * 4;

		sum +=
			0.2126 * data[index] +
			0.7152 * data[index + 1] +
			0.0722 * data[index + 2];
	}

	return sum / samples;
}

function clampExposureTime(
	value: number,
	range: { min: number; max: number },
): number {
	return Math.min(range.max, Math.max(range.min, value));
}

/**
 * Continuously meters the average picture level (APL) of a window within the
 * video frame and drives the camera's manual exposure time toward
 * `targetAPL`. Useful when the subject (e.g. a QR code on a backlit screen)
 * occupies a small region of the frame that continuous auto-exposure meters
 * poorly.
 *
 * Requires a camera whose track reports the `exposureTime` capability and a
 * `manual` exposure mode; otherwise `onError` is called and the hook stays
 * idle. Continuous auto-exposure is restored when the track is replaced or
 * the component unmounts.
 */
export function useWindowedExposure(
	options?: IUseWindowedExposureOptions,
): IUseWindowedExposureReturn {
	const {
		targetAPL = DEFAULT_TARGET_APL,
		getWindow = defaultExposureWindow,
		updateInterval = DEFAULT_UPDATE_INTERVAL_MS,
		onError,
	} = options ?? {};

	const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
		null,
	);
	const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
	const [paused, setPaused] = useState(false);

	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const exposureTimeRef = useRef<number | null>(null);
	const lastExposureUpdateRef = useRef(0);
	const adjustingExposureRef = useRef(false);
	const appliedManualExposureRef = useRef(false);
	const trackGenerationRef = useRef(0);
	const onErrorRef = useRef(onError);

	useEffect(() => {
		onErrorRef.current = onError;
	}, [onError]);

	// Reset the controller when the track changes and restore continuous
	// auto-exposure when it goes away. Keyed on the track only, so pause
	// toggles and option changes don't reset the camera's exposure mode.
	useEffect(() => {
		if (videoTrack === null) return;

		trackGenerationRef.current += 1;
		exposureTimeRef.current = null;
		lastExposureUpdateRef.current = 0;
		adjustingExposureRef.current = false;

		return () => {
			if (!appliedManualExposureRef.current) return;

			appliedManualExposureRef.current = false;
			videoTrack
				.applyConstraints({ advanced: [{ exposureMode: 'continuous' }] })
				.catch((error) => onErrorRef.current?.(createScannerError(error)));
		};
	}, [videoTrack]);

	useEffect(() => {
		if (videoElement === null || videoTrack === null || paused) return;

		const capabilities = videoTrack.getCapabilities?.() ?? {};
		const exposureTimeRange = capabilities.exposureTime;

		if (
			exposureTimeRange === undefined ||
			!capabilities.exposureMode?.includes('manual')
		) {
			onErrorRef.current?.(
				createScannerError(
					new Error(
						'The provided video track does not support manual exposure',
					),
				),
			);

			return;
		}

		// Seed the controller from the camera's actual exposure time so the
		// first adjustment scales a real value instead of a guess.
		if (exposureTimeRef.current === null) {
			exposureTimeRef.current = clampExposureTime(
				videoTrack.getSettings().exposureTime ?? FALLBACK_EXPOSURE_TIME,
				exposureTimeRange,
			);
		}

		let animationFrameId = 0;

		const adjustExposure = (apl: number, timeNow: number) => {
			if (Math.abs(apl - targetAPL) < MIN_APL_DIFFERENCE) return;

			const currentExposureTime = exposureTimeRef.current;
			if (currentExposureTime === null) return;

			// Proportional controller: a frame darker than the target scales the
			// exposure time up, a brighter one scales it down. Clamped because
			// browsers misbehave when given out-of-range exposure times.
			const newExposureTime = clampExposureTime(
				currentExposureTime * (targetAPL / apl),
				exposureTimeRange,
			);

			if (newExposureTime === currentExposureTime) return;

			const generation = trackGenerationRef.current;

			adjustingExposureRef.current = true;
			videoTrack
				.applyConstraints({
					advanced: [{ exposureMode: 'manual', exposureTime: newExposureTime }],
				})
				.then(() => {
					if (trackGenerationRef.current !== generation) return;

					appliedManualExposureRef.current = true;
					exposureTimeRef.current = newExposureTime;
				})
				.catch((error) => onErrorRef.current?.(createScannerError(error)))
				.finally(() => {
					if (trackGenerationRef.current !== generation) return;

					// Updated even on failure so a rejecting track is retried at most
					// once per updateInterval instead of every frame.
					lastExposureUpdateRef.current = timeNow;
					adjustingExposureRef.current = false;
				});
		};

		const processFrame = (timeNow: number) => {
			const exposureIsStale =
				!adjustingExposureRef.current &&
				timeNow - lastExposureUpdateRef.current > updateInterval;

			if (
				exposureIsStale &&
				videoElement.readyState >= videoElement.HAVE_ENOUGH_DATA &&
				videoElement.videoWidth > 0
			) {
				if (canvasRef.current === null) {
					canvasRef.current = document.createElement('canvas');
				}

				const canvas = canvasRef.current;
				const ctx = canvas.getContext('2d', { willReadFrequently: true });

				if (ctx !== null) {
					const meteringWindow = getWindow(
						videoElement.videoWidth,
						videoElement.videoHeight,
					);

					canvas.width = Math.max(1, Math.round(meteringWindow.width));
					canvas.height = Math.max(1, Math.round(meteringWindow.height));
					ctx.drawImage(
						videoElement,
						meteringWindow.startX,
						meteringWindow.startY,
						meteringWindow.width,
						meteringWindow.height,
						0,
						0,
						canvas.width,
						canvas.height,
					);

					const apl = approxAPL(
						ctx.getImageData(0, 0, canvas.width, canvas.height),
					);

					adjustExposure(apl, timeNow);
				}
			}

			animationFrameId = window.requestAnimationFrame(processFrame);
		};

		animationFrameId = window.requestAnimationFrame(processFrame);

		return () => {
			window.cancelAnimationFrame(animationFrameId);
		};
	}, [videoElement, videoTrack, paused, targetAPL, getWindow, updateInterval]);

	return {
		setVideoElement,
		setVideoTrack,
		setPaused,
		paused,
	};
}
