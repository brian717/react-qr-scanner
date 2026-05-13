import {
	BarcodeDetector,
	type BarcodeFormat,
	type DetectedBarcode,
} from 'barcode-detector/ponyfill';
import { type RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { base64Beep } from '../assets/base64Beep';
import type { IScannerError, IUseScannerState } from '../types';
import { createScannerError } from '../utilities/createScannerError';

interface IUseScannerProps {
	videoElementRef: RefObject<HTMLVideoElement | null>;
	onScan: (result: DetectedBarcode[]) => void;
	onFound: (result: DetectedBarcode[]) => void;
	onError?: (error: IScannerError) => void;
	formats?: BarcodeFormat[];
	sound?: boolean | string;
	allowMultiple?: boolean;
	retryDelay?: number;
	scanDelay?: number;
}

const EMPTY_FORMATS: BarcodeFormat[] = [];

export default function useScanner(props: IUseScannerProps) {
	const {
		videoElementRef,
		onScan,
		onFound,
		onError,
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
	const animationFrameIdRef = useRef<number | null>(null);

	if (typeof window !== 'undefined' && barcodeDetectorRef.current === null) {
		barcodeDetectorRef.current = new BarcodeDetector({ formats });
	}

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

		audioRef.current = new Audio(
			typeof sound === 'string' ? sound : base64Beep,
		);

		return () => {
			audioRef.current?.pause();
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

			const { lastScan, contentBefore, lastScanHadContent } = state;

			if (timeNow - lastScan < retryDelay) {
				animationFrameIdRef.current = window.requestAnimationFrame(
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

			animationFrameIdRef.current = window.requestAnimationFrame(
				processFrame(newState),
			);
		},
		[onScan, onFound, onError, retryDelay, allowMultiple, scanDelay, sound],
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

		animationFrameIdRef.current = window.requestAnimationFrame(
			processFrame(initialState),
		);
	}, [processFrame]);

	const stopScanning = useCallback(() => {
		if (animationFrameIdRef.current !== null) {
			window.cancelAnimationFrame(animationFrameIdRef.current);
			animationFrameIdRef.current = null;
		}
	}, []);

	return {
		startScanning,
		stopScanning,
	};
}
