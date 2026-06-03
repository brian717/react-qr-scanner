import type { BarcodeFormat } from 'barcode-detector';
import {
	type CSSProperties,
	forwardRef,
	type ReactNode,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
import useCamera from '../hooks/useCamera';
import useScanner from '../hooks/useScanner';
import { defaultComponents, defaultConstraints, defaultStyles } from '../misc';
import type {
	ICameraCapabilities,
	ICameraSettings,
	IDetectedBarcode,
	IScannerClassNames,
	IScannerComponents,
	IScannerError,
	IScannerHandle,
	IScannerStyles,
	TrackFunction,
} from '../types';
import {
	adjustBarcodeCoordinates,
	computeTransform,
} from '../utilities/coordinateTransform';
import { createScannerError } from '../utilities/createScannerError';
import deepEqual from '../utilities/deepEqual';
import Finder from './Finder';
import StatusOverlay from './StatusOverlay';

export interface IScannerProps {
	/** Called when one or more barcodes are detected. */
	onScan: (detectedCodes: IDetectedBarcode[]) => void;
	/** Called when the scanner can't start the camera or detection fails. */
	onError?: (error: IScannerError) => void;
	/**
	 * Fires on every frame that contains at least one code, before the
	 * duplicate/`scanDelay` filtering that gates `onScan`. Useful for live
	 * tracking, velocity metrics, or custom result filtering.
	 */
	onDetected?: (detectedCodes: IDetectedBarcode[]) => void;
	/** Fires when the camera becomes active (`true`) or stops (`false`). */
	onCameraActive?: (active: boolean) => void;
	/** Fires when the active track's capabilities or settings change. */
	onCapabilitiesChange?: (
		capabilities: ICameraCapabilities,
		settings: ICameraSettings,
	) => void;
	/** Media track constraints applied to the camera stream. */
	constraints?: MediaTrackConstraints;
	/** Barcode formats to detect. Defaults to all supported formats. */
	formats?: BarcodeFormat[];
	/** Pause the scanner and display a frozen frame of the last video frame. */
	paused?: boolean;
	/** Custom content to render over the scanner. */
	children?: ReactNode;
	/** Built-in UI components and tracker. Top-level `tracker` overrides `components.tracker`. */
	components?: IScannerComponents;
	/** Custom tracker overlay function. Convenience alias for `components.tracker`. */
	tracker?: TrackFunction;
	/** Inline CSS for the container and video. */
	styles?: IScannerStyles;
	/** Class names for the container and video. */
	classNames?: IScannerClassNames;
	/** Allow the same barcode to trigger `onScan` repeatedly. */
	allowMultiple?: boolean;
	/** Minimum delay (ms) between `onScan` calls when `allowMultiple` is true. */
	scanDelay?: number;
	/** Minimum delay (ms) between detection attempts. */
	retryDelay?: number;
	/** Play a beep on a successful scan, or a custom sound URL/data URI. */
	sound?: boolean | string;
	/** Max time (ms) to wait for the camera to start. Default 3000. */
	startTimeoutMs?: number;
	/** Delay (ms) after `play()` before reading capabilities. Default 500. */
	settleDelayMs?: number;
}

/**
 * Default format list: the `barcode-detector` meta-format `'any'` matches every
 * supported 1D/2D symbology. A module-level constant keeps the reference stable
 * across renders when no `formats` prop is provided.
 */
const ALL_FORMATS: BarcodeFormat[] = ['any'];

const ABSOLUTE_OVERLAY: CSSProperties = {
	position: 'absolute',
	width: '100%',
	height: '100%',
};

const trackingLayerStyle = ABSOLUTE_OVERLAY;

/** Off-screen but readable by assistive technology (screen-reader only). */
const visuallyHiddenStyle: CSSProperties = {
	position: 'absolute',
	width: 1,
	height: 1,
	padding: 0,
	margin: -1,
	overflow: 'hidden',
	clip: 'rect(0, 0, 0, 0)',
	whiteSpace: 'nowrap',
	border: 0,
};

function clearCanvas(canvas: HTMLCanvasElement | null) {
	if (canvas === null) return;

	const ctx = canvas.getContext('2d');

	if (ctx === null) return;

	ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawTracking(
	detectedCodes: IDetectedBarcode[],
	videoEl: HTMLVideoElement | null,
	trackingEl: HTMLCanvasElement | null,
	tracker: TrackFunction | undefined,
) {
	if (trackingEl === null || videoEl === null) return;

	if (detectedCodes.length === 0 || tracker === undefined) {
		clearCanvas(trackingEl);

		return;
	}

	const displayWidth = videoEl.offsetWidth;
	const displayHeight = videoEl.offsetHeight;
	const resolutionWidth = videoEl.videoWidth;
	const resolutionHeight = videoEl.videoHeight;

	if (resolutionWidth === 0 || resolutionHeight === 0) {
		clearCanvas(trackingEl);

		return;
	}

	const transform = computeTransform({
		displayWidth,
		displayHeight,
		resolutionWidth,
		resolutionHeight,
	});

	const adjustedCodes = detectedCodes.map((detectedCode) =>
		adjustBarcodeCoordinates(detectedCode, transform),
	);

	trackingEl.width = displayWidth;
	trackingEl.height = displayHeight;

	const ctx = trackingEl.getContext('2d');
	if (ctx === null) return;

	tracker(adjustedCodes, ctx);
}

export const Scanner = forwardRef<IScannerHandle, IScannerProps>(
	function Scanner(props, ref) {
		const {
			onScan,
			constraints,
			formats = ALL_FORMATS,
			paused = false,
			components,
			tracker: trackerProp,
			children,
			styles,
			classNames,
			allowMultiple,
			scanDelay,
			retryDelay,
			onError,
			onDetected,
			onCameraActive,
			onCapabilitiesChange,
			sound,
			startTimeoutMs,
			settleDelayMs,
		} = props;

		const videoRef = useRef<HTMLVideoElement>(null);
		const pauseFrameRef = useRef<HTMLCanvasElement>(null);
		const trackingLayerRef = useRef<HTMLCanvasElement>(null);
		const liveRegionRef = useRef<HTMLDivElement>(null);

		// Normalize once: when a deviceId is present, the default `facingMode`
		// is stripped so the comparison below has a stable shape. Doing this
		// in the memo (instead of after-the-fact inside the effect) keeps
		// `normalizedConstraints` and `constraintsCached` referentially in sync
		// and prevents an infinite render loop when the parent flips
		// `constraints` from undefined to `{ deviceId }` after mount.
		const normalizedConstraints = useMemo(() => {
			const merged: MediaTrackConstraints = {
				...defaultConstraints,
				...constraints,
			};

			if (constraints?.deviceId) {
				delete merged.facingMode;
			}

			return merged;
		}, [constraints]);

		const mergedComponents = useMemo(
			() => ({ ...defaultComponents, ...components }),
			[components],
		);

		const effectiveTracker = trackerProp ?? mergedComponents.tracker;

		// `finder` may be a boolean or a theming config; normalize both.
		const showFinder = Boolean(mergedComponents.finder);
		const finderConfig =
			typeof mergedComponents.finder === 'object'
				? mergedComponents.finder
				: undefined;

		const [isMounted, setIsMounted] = useState(false);
		const [isCameraActive, setIsCameraActive] = useState(false);
		const [scannerError, setScannerError] = useState<IScannerError | null>(
			null,
		);
		const [constraintsCached, setConstraintsCached] = useState(
			normalizedConstraints,
		);

		const camera = useCamera({ startTimeoutMs, settleDelayMs });

		const cameraRef = useRef(camera);
		const onScanRef = useRef(onScan);
		const onErrorRef = useRef(onError);
		const onDetectedRef = useRef(onDetected);
		const trackerRef = useRef<TrackFunction | undefined>(effectiveTracker);
		// Mirrors of state/derived values the imperative handle reads at call time.
		const constraintsCachedRef = useRef(constraintsCached);
		const isCameraActiveRef = useRef(isCameraActive);

		useEffect(() => {
			cameraRef.current = camera;
		}, [camera]);

		useEffect(() => {
			onScanRef.current = onScan;
		}, [onScan]);

		useEffect(() => {
			onErrorRef.current = onError;
		}, [onError]);

		useEffect(() => {
			onDetectedRef.current = onDetected;
		}, [onDetected]);

		useEffect(() => {
			trackerRef.current = effectiveTracker;
		}, [effectiveTracker]);

		useEffect(() => {
			constraintsCachedRef.current = constraintsCached;
		}, [constraintsCached]);

		useEffect(() => {
			isCameraActiveRef.current = isCameraActive;
		}, [isCameraActive]);

		// Observability callbacks are read through refs (depending only on the
		// observed value) so passing inline handlers doesn't re-fire them.
		const onCameraActiveRef = useRef(onCameraActive);
		const onCapabilitiesChangeRef = useRef(onCapabilitiesChange);

		useEffect(() => {
			onCameraActiveRef.current = onCameraActive;
		}, [onCameraActive]);

		useEffect(() => {
			onCapabilitiesChangeRef.current = onCapabilitiesChange;
		}, [onCapabilitiesChange]);

		useEffect(() => {
			onCameraActiveRef.current?.(isCameraActive);
		}, [isCameraActive]);

		useEffect(() => {
			onCapabilitiesChangeRef.current?.(camera.capabilities, camera.settings);
		}, [camera.capabilities, camera.settings]);

		// Stable onScan/onDetected/onFound/onError callbacks so identity churn from
		// inline props doesn't tear down and restart the scanning loop every render.
		const stableOnScan = useCallback((codes: IDetectedBarcode[]) => {
			onScanRef.current?.(codes);

			// Announce the decoded value(s) to screen readers. Writing textContent
			// directly (rather than via state) avoids re-rendering on every scan.
			const region = liveRegionRef.current;

			if (region !== null && codes.length > 0) {
				region.textContent = `Detected: ${codes
					.map((code) => code.rawValue)
					.join(', ')}`;
			}
		}, []);

		const stableOnError = useCallback((error: IScannerError) => {
			setScannerError(error);
			onErrorRef.current?.(error);
		}, []);

		const stableOnDetected = useCallback((codes: IDetectedBarcode[]) => {
			onDetectedRef.current?.(codes);
		}, []);

		const onFoundCallback = useCallback((detectedCodes: IDetectedBarcode[]) => {
			drawTracking(
				detectedCodes,
				videoRef.current,
				trackingLayerRef.current,
				trackerRef.current,
			);
		}, []);

		const effectiveRetryDelay =
			retryDelay ?? (effectiveTracker === undefined ? 500 : 33);

		const { startScanning, stopScanning } = useScanner({
			videoElementRef: videoRef,
			onScan: stableOnScan,
			onFound: onFoundCallback,
			onError: stableOnError,
			onDetected: stableOnDetected,
			formats,
			retryDelay: effectiveRetryDelay,
			scanDelay,
			allowMultiple,
			sound,
		});

		useEffect(() => {
			setIsMounted(true);

			return () => {
				setIsMounted(false);
			};
		}, []);

		useEffect(() => {
			if (!deepEqual(normalizedConstraints, constraintsCached)) {
				setConstraintsCached(normalizedConstraints);
			}
		}, [normalizedConstraints, constraintsCached]);

		const cameraSettings = useMemo(() => {
			return {
				constraints: constraintsCached,
				shouldStream: isMounted && !paused,
			};
		}, [constraintsCached, isMounted, paused]);

		const onCameraChange = useCallback(async () => {
			const videoEl = videoRef.current;
			const canvasEl = pauseFrameRef.current;

			if (videoEl === null || canvasEl === null) return;

			const ctx = canvasEl.getContext('2d');

			if (ctx === null) return;

			try {
				if (cameraSettings.shouldStream) {
					await cameraRef.current.stopCamera();

					setIsCameraActive(false);

					await cameraRef.current.startCamera(videoEl, {
						constraints: cameraSettings.constraints,
					});

					setIsCameraActive(true);
					setScannerError(null);
				} else {
					if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
						canvasEl.width = videoEl.videoWidth;
						canvasEl.height = videoEl.videoHeight;
						ctx.drawImage(
							videoEl,
							0,
							0,
							videoEl.videoWidth,
							videoEl.videoHeight,
						);
					}

					await cameraRef.current.stopCamera();

					setIsCameraActive(false);
				}
			} catch (error) {
				setIsCameraActive(false);

				const scannerErr = createScannerError(error);
				setScannerError(scannerErr);
				onErrorRef.current?.(scannerErr);
			}
		}, [cameraSettings]);

		const onCameraChangeRef = useRef(onCameraChange);

		useEffect(() => {
			onCameraChangeRef.current = onCameraChange;
		}, [onCameraChange]);

		useEffect(() => {
			void onCameraChange();
		}, [onCameraChange]);

		// Recovery path for the status overlay: clear the error so the overlay
		// flips to its loading state, then re-run the camera-start flow.
		const handleStatusRetry = useCallback(() => {
			setScannerError(null);
			void onCameraChangeRef.current();
		}, []);

		const shouldScan = useMemo(() => {
			return cameraSettings.shouldStream && isCameraActive;
		}, [cameraSettings.shouldStream, isCameraActive]);

		useEffect(() => {
			if (shouldScan) {
				clearCanvas(pauseFrameRef.current);
				clearCanvas(trackingLayerRef.current);
				startScanning();
			}

			return () => {
				stopScanning();
			};
		}, [shouldScan, startScanning, stopScanning]);

		useImperativeHandle(
			ref,
			() => ({
				getVideoElement: () => videoRef.current,
				getStream: () => cameraRef.current.getStream(),
				getCameraState: () => ({
					isActive: isCameraActiveRef.current,
					capabilities: cameraRef.current.capabilities,
					settings: cameraRef.current.settings,
				}),
				snapshot: async (options) => {
					const video = videoRef.current;

					if (
						video === null ||
						video.videoWidth === 0 ||
						video.videoHeight === 0
					) {
						return null;
					}

					const canvas = document.createElement('canvas');
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;

					const ctx = canvas.getContext('2d');

					if (ctx === null) return null;

					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

					return new Promise<Blob | null>((resolve) => {
						canvas.toBlob(
							(blob) => resolve(blob),
							options?.type ?? 'image/png',
							options?.quality,
						);
					});
				},
				toggleTorch: async (on) => {
					const next = on ?? !(cameraRef.current.settings.torch ?? false);

					await cameraRef.current.updateConstraints({
						...constraintsCachedRef.current,
						advanced: [{ torch: next }],
					});
				},
				setZoom: async (value) => {
					await cameraRef.current.updateConstraints({
						...constraintsCachedRef.current,
						advanced: [{ zoom: value }],
					});
				},
				restart: async () => {
					await onCameraChangeRef.current();
				},
			}),
			[],
		);

		const containerStyle = useMemo(
			() => ({ ...defaultStyles.container, ...styles?.container }),
			[styles?.container],
		);

		const videoStyle = useMemo<CSSProperties>(
			() => ({
				...defaultStyles.video,
				...styles?.video,
				visibility: paused ? 'hidden' : 'visible',
			}),
			[styles?.video, paused],
		);

		const pauseFrameStyle = useMemo<CSSProperties>(
			() => ({
				...ABSOLUTE_OVERLAY,
				display: paused ? 'block' : 'none',
			}),
			[paused],
		);

		// Opt-in loading/error overlay. Loading = the camera should be streaming
		// but isn't active yet and no error has surfaced.
		const statusOverlay = mergedComponents.statusOverlay;
		const isLoading =
			cameraSettings.shouldStream && !isCameraActive && scannerError === null;

		let statusOverlayNode: ReactNode = null;

		if (statusOverlay) {
			statusOverlayNode =
				typeof statusOverlay === 'function' ? (
					statusOverlay({
						error: scannerError,
						isLoading,
						onRetry: handleStatusRetry,
					})
				) : (
					<StatusOverlay
						error={scannerError}
						isLoading={isLoading}
						onRetry={handleStatusRetry}
					/>
				);
		}

		return (
			<div style={containerStyle} className={classNames?.container}>
				<video
					ref={videoRef}
					style={videoStyle}
					className={classNames?.video}
					aria-label="Barcode scanner camera feed"
					autoPlay
					muted
					playsInline
				/>
				<canvas ref={pauseFrameRef} style={pauseFrameStyle} />
				<canvas ref={trackingLayerRef} style={trackingLayerStyle} />
				<div
					ref={liveRegionRef}
					aria-live="polite"
					aria-atomic="true"
					style={visuallyHiddenStyle}
				/>
				<div style={ABSOLUTE_OVERLAY}>
					{showFinder && (
						<Finder
							scanning={isCameraActive}
							capabilities={camera.capabilities}
							onOff={mergedComponents.onOff}
							color={finderConfig?.color}
							size={finderConfig?.size}
							borderRadius={finderConfig?.borderRadius}
							zoom={
								mergedComponents.zoom && camera.settings.zoom
									? {
											value: camera.settings.zoom,
											onChange: async (value) => {
												try {
													await camera.updateConstraints({
														...constraintsCached,
														advanced: [{ zoom: value }],
													});
												} catch (error) {
													onErrorRef.current?.(createScannerError(error));
												}
											},
										}
									: undefined
							}
							torch={
								mergedComponents.torch
									? {
											status: camera.settings.torch ?? false,
											toggle: async (value) => {
												try {
													await camera.updateConstraints({
														...constraintsCached,
														advanced: [{ torch: value }],
													});
												} catch (error) {
													onErrorRef.current?.(createScannerError(error));
												}
											},
										}
									: undefined
							}
							startScanning={async () => await onCameraChange()}
							stopScanning={async () => {
								try {
									await camera.stopCamera();
									clearCanvas(trackingLayerRef.current);
									setIsCameraActive(false);
								} catch (error) {
									onErrorRef.current?.(createScannerError(error));
								}
							}}
						/>
					)}
					{children}
				</div>
				{statusOverlayNode}
			</div>
		);
	},
);
