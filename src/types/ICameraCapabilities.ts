/**
 * Camera track capabilities, including the non-standard `torch`/`zoom` that the
 * Barcode/MediaStream specs don't type. Exposed explicitly (rather than via the
 * library's internal global augmentation), so consumers of `getCameraState()` and
 * `onCapabilitiesChange` get these typed without extra setup.
 */
export interface ICameraCapabilities extends MediaTrackCapabilities {
	torch?: boolean;
	zoom?: { min: number; max: number; step: number };
}

/** Camera track settings, including the non-standard `torch`/`zoom`. */
export interface ICameraSettings extends MediaTrackSettings {
	torch?: boolean;
	zoom?: number;
}
