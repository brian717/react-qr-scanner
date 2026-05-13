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
	IDetectedBarcode,
	IPoint,
	IScannerClassNames,
	IScannerComponents,
	IScannerError,
	IScannerHandle,
	IScannerStyles,
	TrackFunction,
} from '../types';
import { createScannerError } from '../utilities/createScannerError';
import deepEqual from '../utilities/deepEqual';
import Finder from './Finder';

export interface IScannerProps {
	/** Called when one or more barcodes are detected. */
	onScan: (detectedCodes: IDetectedBarcode[]) => void;
	/** Called when the scanner can't start the camera or detection fails. */
	onError?: (error: IScannerError) => void;
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

const overlayStyle: CSSProperties = {
	position: 'absolute',
	width: '100%',
	height: '100%',
};

const pauseFrameStyleBase: CSSProperties = {
	position: 'absolute',
	width: '100%',
	height: '100%',
};

const trackingLayerStyle: CSSProperties = {
	position: 'absolute',
	width: '100%',
	height: '100%',
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

	const largerRatio = Math.max(
		displayWidth / resolutionWidth,
		displayHeight / resolutionHeight,
	);
	const uncutWidth = resolutionWidth * largerRatio;
	const uncutHeight = resolutionHeight * largerRatio;

	const xScalar = uncutWidth / resolutionWidth;
	const yScalar = uncutHeight / resolutionHeight;
	const xOffset = (displayWidth - uncutWidth) / 2;
	const yOffset = (displayHeight - uncutHeight) / 2;

	const scale = ({ x, y }: IPoint): IPoint => ({
		x: Math.floor(x * xScalar),
		y: Math.floor(y * yScalar),
	});

	const translate = ({ x, y }: IPoint): IPoint => ({
		x: Math.floor(x + xOffset),
		y: Math.floor(y + yOffset),
	});

	const adjustedCodes = detectedCodes.map((detectedCode) => {
		const { boundingBox, cornerPoints } = detectedCode;

		const { x, y } = translate(scale({ x: boundingBox.x, y: boundingBox.y }));
		const { x: width, y: height } = scale({
			x: boundingBox.width,
			y: boundingBox.height,
		});

		return {
			...detectedCode,
			cornerPoints: cornerPoints.map((point) => translate(scale(point))),
			boundingBox: DOMRectReadOnly.fromRect({ x, y, width, height }),
		};
	});

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
			formats = ['any' as BarcodeFormat],
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
			sound,
			startTimeoutMs,
			settleDelayMs,
		} = props;

		const videoRef = useRef<HTMLVideoElement>(null);
		const pauseFrameRef = useRef<HTMLCanvasElement>(null);
		const trackingLayerRef = useRef<HTMLCanvasElement>(null);

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

		const [isMounted, setIsMounted] = useState(false);
		const [isCameraActive, setIsCameraActive] = useState(false);
		const [constraintsCached, setConstraintsCached] = useState(
			normalizedConstraints,
		);

		const camera = useCamera({ startTimeoutMs, settleDelayMs });

		const cameraRef = useRef(camera);
		const onScanRef = useRef(onScan);
		const onErrorRef = useRef(onError);
		const trackerRef = useRef<TrackFunction | undefined>(effectiveTracker);

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
			trackerRef.current = effectiveTracker;
		}, [effectiveTracker]);

		// Stable onScan/onFound/onError callbacks so identity churn from inline
		// props doesn't tear down and restart the scanning loop on every render.
		const stableOnScan = useCallback((codes: IDetectedBarcode[]) => {
			onScanRef.current?.(codes);
		}, []);

		const stableOnError = useCallback((error: IScannerError) => {
			onErrorRef.current?.(error);
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

				onErrorRef.current?.(createScannerError(error));
			}
		}, [cameraSettings]);

		useEffect(() => {
			void onCameraChange();
		}, [onCameraChange]);

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
				...pauseFrameStyleBase,
				display: paused ? 'block' : 'none',
			}),
			[paused],
		);

		return (
			<div style={containerStyle} className={classNames?.container}>
				<video
					ref={videoRef}
					style={videoStyle}
					className={classNames?.video}
					autoPlay
					muted
					playsInline
				/>
				<canvas ref={pauseFrameRef} style={pauseFrameStyle} />
				<canvas ref={trackingLayerRef} style={trackingLayerStyle} />
				<div style={overlayStyle}>
					{mergedComponents.finder && (
						<Finder
							scanning={isCameraActive}
							capabilities={camera.capabilities}
							onOff={mergedComponents.onOff}
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
			</div>
		);
	},
);
