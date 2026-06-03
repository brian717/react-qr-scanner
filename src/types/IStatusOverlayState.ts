import type { IScannerError } from './IScannerError';

/** State passed to a custom `components.statusOverlay` render function. */
export interface IStatusOverlayState {
	/** The most recent camera/detection error, or `null` if there is none. */
	error: IScannerError | null;
	/** `true` while the camera is starting and not yet active (no error). */
	isLoading: boolean;
	/**
	 * Clears the current error and restarts the camera. Wire this to a retry
	 * control. Provided by `Scanner`; only meaningful while `error` is set.
	 */
	onRetry?: () => void;
}
