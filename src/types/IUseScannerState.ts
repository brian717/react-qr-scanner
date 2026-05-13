export interface IUseScannerState {
	lastScan: number;
	lastOnScan: number;
	contentBefore: Set<string>;
	lastScanHadContent: boolean;
}
