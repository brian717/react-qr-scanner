// Captured at module-evaluation time, before any side-effect imports
// elsewhere in the package can install a polyfill. The package itself uses
// `barcode-detector/ponyfill` (polyfill-free) so this stays accurate; if a
// consumer separately installs `barcode-detector/polyfill` before importing
// this library, this snapshot can still be a false positive — document that
// edge case in the README.
const HAS_NATIVE_BARCODE_DETECTOR =
	typeof window !== 'undefined' && 'BarcodeDetector' in window;

export function isBarcodeDetectorSupported(): boolean {
	return HAS_NATIVE_BARCODE_DETECTOR;
}
