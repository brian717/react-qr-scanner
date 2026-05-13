import type { CSSProperties } from 'react';

import {
	boundingBox,
	centerText,
	outline,
	Scanner as ScannerComp,
} from '../src';

const containerStyle: CSSProperties = {
	width: '80%',
	maxWidth: 500,
	margin: 'auto',
};

export const Outline = () => (
	<div style={containerStyle}>
		<ScannerComp onScan={() => undefined} tracker={outline} />
	</div>
);

export const BoundingBox = () => (
	<div style={containerStyle}>
		<ScannerComp onScan={() => undefined} tracker={boundingBox} />
	</div>
);

export const CenterText = () => (
	<div style={containerStyle}>
		<ScannerComp onScan={() => undefined} tracker={centerText} />
	</div>
);

export const NoTracker = () => (
	<div style={containerStyle}>
		<ScannerComp onScan={() => undefined} />
	</div>
);

export default {
	title: 'Trackers',
};
