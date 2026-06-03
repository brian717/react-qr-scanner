// Snapshot whether the runtime had a native BarcodeDetector before any of
// our other imports run. Importing this module first means the snapshot is
// taken before `barcode-detector/ponyfill` is loaded — and `ponyfill` itself
// does not touch globalThis, so the value stays meaningful.
import './utilities/isBarcodeDetectorSupported';

export type {
	BarcodeFormat,
	DetectedBarcode,
} from 'barcode-detector/ponyfill';
export {
	prepareZXingModule,
	/**
	 * @deprecated Use `prepareZXingModule({ overrides })` instead.
	 * `setZXingModuleOverrides(x)` is the equivalent to
	 * `prepareZXingModule({ overrides: x })`.
	 */
	setZXingModuleOverrides,
} from 'barcode-detector/ponyfill';
export * from './components/Scanner';
export {
	default as useCamera,
	type IUseCameraOptions,
} from './hooks/useCamera';
export * from './hooks/useDevices';
export {
	default as useScanner,
	type IUseScannerProps,
} from './hooks/useScanner';
export * from './misc/overlays';
export * from './types';
export { createScannerError } from './utilities/createScannerError';
export { isBarcodeDetectorSupported } from './utilities/isBarcodeDetectorSupported';
