export interface IScannerHandle {
	getVideoElement: () => HTMLVideoElement | null;
	getStream: () => MediaStream | null;
}
