import {
	BarcodeDetector,
	type BarcodeFormat,
	type DetectedBarcode,
} from 'barcode-detector/ponyfill';
import { type RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { base64Beep } from '../assets/base64Beep';
import type { IScannerError } from '../types';
import type { IUseScannerState } from '../types/internal';
import { createScannerError } from '../utilities/createScannerError';

export interface IUseScannerProps {
	videoElementRef: RefObject<HTMLVideoElement | null>;
	onScan: (result: DetectedBarcode[]) => void;
	onFound: (result: DetectedBarcode[]) => void;
	onError?: (error: IScannerError) => void;
	/** Fires on every frame that contains at least one code, before the
	 * duplicate/`scanDelay` filtering that gates `onScan`. */
	onDetected?: (result: DetectedBarcode[]) => void;
	formats?: BarcodeFormat[];
	sound?: boolean | string;
	allowMultiple?: boolean;
	retryDelay?: number;
	scanDelay?: number;
}

const EMPTY_FORMATS: BarcodeFormat[] = [];

interface IFrameHandle {
	cancel: () => void;
}

/**
 * Schedules a detection callback on the next *video* frame using
 * `requestVideoFrameCallback` when available — it fires only when a new frame is
 * actually presented, so we don't run the detector on duplicate frames (fewer
 * WASM calls, less battery). Falls back to `requestAnimationFrame` otherwise.
 */
function scheduleFrame(
	video: HTMLVideoElement | null,
	callback: (time: number) => void,
): IFrameHandle | null {
	if (typeof window === 'undefined') return null;

	if (video && typeof video.requestVideoFrameCallback === 'function') {
		const id = video.requestVideoFrameCallback(callback);

		return { cancel: () => video.cancelVideoFrameCallback(id) };
	}

	const id = window.requestAnimationFrame(callback);

	return { cancel: () => window.cancelAnimationFrame(id) };
}

export default function useScanner(props: IUseScannerProps) {
	const {
		videoElementRef,
		onScan,
		onFound,
		onError,
		onDetected,
		retryDelay = 100,
		scanDelay = 0,
		formats = EMPTY_FORMATS,
		allowMultiple = false,
		sound = true,
	}: IUseScannerProps = props;

	// Stable key so a new array reference with identical contents doesn't
	// rebuild the detector every render.
	const formatsKey = useMemo(() => [...formats].sort().join('|'), [formats]);

	const barcodeDetectorRef = useRef<BarcodeDetector | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const frameHandleRef = useRef<IFrameHandle | null>(null);

	// The detector is (re)built only in this effect — never during render — so a
	// transient render (Suspense/StrictMode/error boundary) can't spawn stray
	// instances. It is created before scanning starts, since startScanning only
	// runs once the camera is active, well after mount effects have flushed.
	// biome-ignore lint/correctness/useExhaustiveDependencies: formatsKey is the stable identity for `formats`
	useEffect(() => {
		if (typeof window === 'undefined') return;

		barcodeDetectorRef.current = new BarcodeDetector({ formats });
	}, [formatsKey]);

	useEffect(() => {
		if (typeof window === 'undefined' || !sound) {
			audioRef.current = null;

			return;
		}

		const audio = new Audio(typeof sound === 'string' ? sound : base64Beep);
		audioRef.current = audio;

		// iOS/Safari block audio until a user gesture. Prime the element silently
		// on the first interaction so the first successful scan isn't muted.
		const gestureEvents = ['pointerdown', 'keydown', 'touchstart'] as const;

		const removeUnlock = () => {
			for (const event of gestureEvents) {
				window.removeEventListener(event, unlock);
			}
		};

		const unlock = () => {
			const wasMuted = audio.muted;
			audio.muted = true;

			audio
				.play()
				.then(() => {
					audio.pause();
					audio.currentTime = 0;
					audio.muted = wasMuted;
				})
				.catch(() => {
					audio.muted = wasMuted;
				});

			removeUnlock();
		};

		for (const event of gestureEvents) {
			window.addEventListener(event, unlock);
		}

		return () => {
			removeUnlock();
			audio.pause();
			audioRef.current = null;
		};
	}, [sound]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: videoElementRef is a stable ref object; we intentionally read .current at execution time
	const processFrame = useCallback(
		(state: IUseScannerState) => async (timeNow: number) => {
			const detector = barcodeDetectorRef.current;
			if (
				videoElementRef.current === null ||
				videoElementRef.current.readyState <= 1 ||
				detector === null
			) {
				return;
			}

			// Pause detection while the page is hidden. The reschedule won't fire
			// until the page is visible again (rAF/rVFC are paused in background
			// tabs), so this idles cleanly instead of detecting off-screen.
			if (typeof document !== 'undefined' && document.hidden) {
				frameHandleRef.current = scheduleFrame(
					videoElementRef.current,
					processFrame(state),
				);

				return;
			}

			const { lastScan, contentBefore, lastScanHadContent } = state;

			if (timeNow - lastScan < retryDelay) {
				frameHandleRef.current = scheduleFrame(
					videoElementRef.current,
					processFrame(state),
				);

				return;
			}

			let detectedCodes: DetectedBarcode[];

			try {
				detectedCodes = await detector.detect(videoElementRef.current);
			} catch (err) {
				// Detector rejections (polyfill WASM init failures, OOM, corrupt
				// frames, etc.) would otherwise kill the RAF loop silently. Surface
				// the failure via onError and stop scanning so the caller can
				// remount or recover deliberately.
				onError?.(createScannerError(err));

				return;
			}

			const anyNewCodesDetected = detectedCodes.some(
				(code: DetectedBarcode) => !contentBefore.has(code.rawValue),
			);

			const currentScanHasContent = detectedCodes.length > 0;

			// Raw per-frame stream: fires whenever codes are present, ahead of the
			// duplicate/scanDelay gating applied to onScan below.
			if (currentScanHasContent) {
				onDetected?.(detectedCodes);
			}

			let lastOnScan = state.lastOnScan;
			const scanDelayPassed = timeNow - lastOnScan >= scanDelay;

			if (
				anyNewCodesDetected ||
				(allowMultiple && currentScanHasContent && scanDelayPassed)
			) {
				if (sound && audioRef.current?.paused) {
					audioRef.current
						.play()
						.catch((error) => console.error('Error playing the sound', error));
				}

				lastOnScan = timeNow;
				onScan(detectedCodes);
			}

			if (currentScanHasContent || lastScanHadContent) {
				onFound(detectedCodes);
			}

			const newContentBefore = anyNewCodesDetected
				? new Set(detectedCodes.map((code: DetectedBarcode) => code.rawValue))
				: contentBefore;

			const newState: IUseScannerState = {
				lastScan: timeNow,
				lastOnScan,
				lastScanHadContent: currentScanHasContent,
				contentBefore: newContentBefore,
			};

			frameHandleRef.current = scheduleFrame(
				videoElementRef.current,
				processFrame(newState),
			);
		},
		[
			onScan,
			onFound,
			onError,
			onDetected,
			retryDelay,
			allowMultiple,
			scanDelay,
			sound,
		],
	);

	const startScanning = useCallback(() => {
		if (typeof window === 'undefined') return;

		const current = performance.now();

		const initialState: IUseScannerState = {
			lastScan: current,
			lastOnScan: current,
			contentBefore: new Set<string>(),
			lastScanHadContent: false,
		};

		frameHandleRef.current = scheduleFrame(
			videoElementRef.current,
			processFrame(initialState),
		);
	}, [processFrame, videoElementRef]);

	const stopScanning = useCallback(() => {
		frameHandleRef.current?.cancel();
		frameHandleRef.current = null;
	}, []);

	return {
		startScanning,
		stopScanning,
	};
}
