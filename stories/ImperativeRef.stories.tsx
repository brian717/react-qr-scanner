import { type CSSProperties, useRef, useState } from 'react';

import { type IScannerHandle, Scanner as ScannerComp } from '../src';

const containerStyle: CSSProperties = {
	width: '80%',
	maxWidth: 500,
	margin: 'auto',
};

const buttonRowStyle: CSSProperties = {
	display: 'flex',
	gap: 8,
	marginBottom: 8,
};

const infoStyle: CSSProperties = {
	marginTop: 8,
	padding: 8,
	background: '#f3f4f6',
	borderRadius: 4,
	fontFamily: 'monospace',
	fontSize: 12,
};

function Template() {
	const scannerRef = useRef<IScannerHandle>(null);
	const [info, setInfo] = useState<string>('');

	function inspectStream() {
		const stream = scannerRef.current?.getStream();
		if (stream === null || stream === undefined) {
			setInfo('No active stream.');
			return;
		}
		const tracks = stream
			.getTracks()
			.map((t) => `${t.kind}: ${t.label || t.id}`);
		setInfo(`Stream id ${stream.id}\nTracks:\n  ${tracks.join('\n  ')}`);
	}

	function inspectVideo() {
		const video = scannerRef.current?.getVideoElement();
		if (video === null || video === undefined) {
			setInfo('No video element.');
			return;
		}
		setInfo(
			`videoWidth=${video.videoWidth} videoHeight=${video.videoHeight} ` +
				`readyState=${video.readyState} paused=${video.paused}`,
		);
	}

	return (
		<div style={containerStyle}>
			<div style={buttonRowStyle}>
				<button type="button" onClick={inspectStream}>
					Inspect stream
				</button>
				<button type="button" onClick={inspectVideo}>
					Inspect video element
				</button>
			</div>
			<ScannerComp ref={scannerRef} onScan={() => undefined} />
			{info.length > 0 && <pre style={infoStyle}>{info}</pre>}
		</div>
	);
}

export const ImperativeRef = Template.bind({});

export default {
	title: 'Imperative Ref',
};
