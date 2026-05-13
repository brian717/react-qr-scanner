// Snapshot whether the runtime had a native BarcodeDetector before any of
// our other imports run. Importing this module first means the snapshot is
// taken before `barcode-detector/ponyfill` is loaded — and `ponyfill` itself
// does not touch globalThis, so the value stays meaningful.
import './utilities/isBarcodeDetectorSupported';

export {
	prepareZXingModule,
	setZXingModuleOverrides,
} from 'barcode-detector/ponyfill';
export * from './components/Scanner';
export * from './hooks/useDevices';
export * from './misc/overlays';
export * from './types';
export { createScannerError } from './utilities/createScannerError';
export { isBarcodeDetectorSupported } from './utilities/isBarcodeDetectorSupported';
