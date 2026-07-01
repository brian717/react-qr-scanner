/**
 * Region of the video frame metered by `useWindowedExposure`, in video pixel
 * coordinates (i.e. relative to `videoWidth`/`videoHeight`, not display size).
 */
export interface IAPLWindow {
	startX: number;
	startY: number;
	width: number;
	height: number;
}
