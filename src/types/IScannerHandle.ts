import type {
	ICameraCapabilities,
	ICameraSettings,
} from './ICameraCapabilities';

/** Options for capturing a still frame via {@link IScannerHandle.snapshot}. */
export interface ISnapshotOptions {
	/** Image MIME type, e.g. `'image/png'` (default) or `'image/jpeg'`. */
	type?: string;
	/** Quality 0–1 for lossy types like `'image/jpeg'`. */
	quality?: number;
}

/** A snapshot of camera activity, capabilities, and track settings. */
export interface ICameraState {
	isActive: boolean;
	capabilities: ICameraCapabilities;
	settings: ICameraSettings;
}

export interface IScannerHandle {
	/** The underlying `<video>` element, or `null` before mount / after unmount. */
	getVideoElement: () => HTMLVideoElement | null;
	/** The active `MediaStream`, or `null` when the camera is stopped. */
	getStream: () => MediaStream | null;
	/** Reads camera activity, capabilities, and track settings at call time. */
	getCameraState: () => ICameraState;
	/**
	 * Captures the current video frame as a `Blob`. Resolves to `null` if no
	 * frame is available yet (camera not started / no dimensions).
	 */
	snapshot: (options?: ISnapshotOptions) => Promise<Blob | null>;
	/** Toggles the torch (flashlight); pass a boolean to set it explicitly. */
	toggleTorch: (on?: boolean) => Promise<void>;
	/** Sets the zoom level (the device clamps it to its supported range). */
	setZoom: (value: number) => Promise<void>;
	/** Stops and restarts the camera with the current constraints. */
	restart: () => Promise<void>;
}
