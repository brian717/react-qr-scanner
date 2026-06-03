// Internal implementation types — NOT part of the public API and intentionally
// not re-exported from `./index`. They describe the camera task-queue results
// (useCamera) and the per-frame scanner state machine (useScanner).

export interface IStartTaskResult {
	type: 'start';
	data: {
		videoEl: HTMLVideoElement;
		stream: MediaStream;
		constraints: MediaTrackConstraints;
	};
}

export interface IStopTaskResult {
	type: 'stop';
	data: {};
}

export interface IUseScannerState {
	lastScan: number;
	lastOnScan: number;
	contentBefore: Set<string>;
	lastScanHadContent: boolean;
}
