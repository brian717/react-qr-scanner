import { type CSSProperties, useState } from 'react';

import { Scanner as ScannerComp } from '../src';

const containerStyle: CSSProperties = {
	width: '80%',
	maxWidth: 500,
	margin: 'auto',
};

const infoStyle: CSSProperties = {
	marginTop: 8,
	padding: 8,
	background: '#f3f4f6',
	borderRadius: 4,
	fontFamily: 'monospace',
	fontSize: 12,
};

function ThemedFinderTemplate() {
	return (
		<div style={containerStyle}>
			<ScannerComp
				onScan={() => undefined}
				components={{
					finder: { color: '#22c55e', size: '60%', borderRadius: '1rem' },
					onOff: true,
					torch: true,
					zoom: true,
				}}
			/>
		</div>
	);
}

function StatusOverlayTemplate() {
	return (
		<div style={containerStyle}>
			{/* Pass a non-existent deviceId to force an error and show the overlay. */}
			<ScannerComp
				onScan={() => undefined}
				constraints={{ deviceId: 'does-not-exist' }}
				components={{ statusOverlay: true }}
			/>
		</div>
	);
}

function ObservabilityTemplate() {
	const [active, setActive] = useState(false);
	const [lastDetected, setLastDetected] = useState('—');
	const [torch, setTorch] = useState(false);
	const [zoom, setZoom] = useState(false);

	return (
		<div style={containerStyle}>
			<ScannerComp
				onScan={() => undefined}
				onCameraActive={setActive}
				onDetected={(codes) =>
					setLastDetected(codes.map((c) => c.rawValue).join(', '))
				}
				onCapabilitiesChange={(capabilities) => {
					// `torch`/`zoom` are typed via ICameraCapabilities — no global
					// augmentation needed in consumer code.
					setTorch(Boolean(capabilities.torch));
					setZoom(Boolean(capabilities.zoom));
				}}
			/>
			<pre style={infoStyle}>
				{`cameraActive=${active}\n` +
					`torchSupported=${torch} zoomSupported=${zoom}\n` +
					`lastDetected=${lastDetected}`}
			</pre>
		</div>
	);
}

export const ThemedFinder = ThemedFinderTemplate.bind({});
export const StatusOverlay = StatusOverlayTemplate.bind({});
export const Observability = ObservabilityTemplate.bind({});

export default {
	title: 'Customization',
};
