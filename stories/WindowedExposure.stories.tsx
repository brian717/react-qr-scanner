import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { action } from 'storybook/actions';

import {
	type IScannerHandle,
	Scanner as ScannerComp,
	useDevices,
	useWindowedExposure,
} from '../src';

const containerStyle: CSSProperties = {
	width: '80%',
	maxWidth: 500,
	margin: 'auto',
};

const controlsStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	alignItems: 'center',
	gap: 8,
	marginBottom: 8,
};

const videoWrapStyle: CSSProperties = {
	position: 'relative',
};

const meteringBoxStyle: CSSProperties = {
	position: 'absolute',
	top: '50%',
	left: '50%',
	transform: 'translate(-50%, -50%)',
	border: '2px solid #22c55e',
	pointerEvents: 'none',
};

const infoStyle: CSSProperties = {
	marginTop: 8,
	padding: 8,
	background: '#f3f4f6',
	borderRadius: 4,
	fontFamily: 'monospace',
	fontSize: 12,
	whiteSpace: 'pre-wrap',
};

function Template() {
	const scannerRef = useRef<IScannerHandle>(null);
	const devices = useDevices();

	const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
	const [targetAPL, setTargetAPL] = useState(100);
	const [lastError, setLastError] = useState('');
	const [diagnostics, setDiagnostics] = useState('waiting for camera…');
	const [meteringBox, setMeteringBox] = useState<{
		width: number;
		height: number;
	} | null>(null);

	const { setVideoElement, setVideoTrack, setPaused, paused } =
		useWindowedExposure({
			targetAPL,
			onError: (error) => setLastError(`${error.kind}: ${error.message}`),
		});

	// Wire the scanner's video element and track into the hook, and poll the
	// track settings so the exposure the controller applies is visible live.
	// Polling (instead of one-shot wiring) also picks up device switches.
	useEffect(() => {
		const id = window.setInterval(() => {
			const video = scannerRef.current?.getVideoElement() ?? null;
			const track =
				scannerRef.current?.getStream()?.getVideoTracks()[0] ?? null;

			setVideoElement(video);
			setVideoTrack(track);

			if (track === null) {
				setDiagnostics('waiting for camera…');
				setMeteringBox(null);

				return;
			}

			const capabilities = track.getCapabilities?.() ?? {};
			const settings = track.getSettings();
			const supported =
				capabilities.exposureTime !== undefined &&
				capabilities.exposureMode?.includes('manual');

			setDiagnostics(
				[
					`track: ${track.label || track.id}`,
					`manual exposure supported: ${supported ? 'yes' : 'NO'}`,
					capabilities.exposureTime
						? `exposureTime range: ${capabilities.exposureTime.min}–${capabilities.exposureTime.max} (step ${capabilities.exposureTime.step})`
						: undefined,
					`current exposureMode: ${settings.exposureMode ?? 'n/a'}`,
					`current exposureTime: ${settings.exposureTime ?? 'n/a'}`,
				]
					.filter((line) => line !== undefined)
					.join('\n'),
			);

			// Mirror the hook's default metering window (centered square, 20% of
			// the smaller video dimension) into display coordinates. The video
			// uses object-fit: cover, so scale by the larger dimension ratio.
			if (video !== null && video.videoWidth > 0 && video.offsetWidth > 0) {
				const scale = Math.max(
					video.offsetWidth / video.videoWidth,
					video.offsetHeight / video.videoHeight,
				);
				const size =
					Math.min(video.videoWidth, video.videoHeight) * 0.2 * scale;

				setMeteringBox((prev) =>
					prev !== null && prev.width === size
						? prev
						: { width: size, height: size },
				);
			}
		}, 250);

		return () => window.clearInterval(id);
	}, [setVideoElement, setVideoTrack]);

	return (
		<div style={containerStyle}>
			<div style={controlsStyle}>
				<select onChange={(e) => setDeviceId(e.target.value || undefined)}>
					<option value="">Default camera</option>
					{devices.map((device) => (
						<option key={device.deviceId} value={device.deviceId}>
							{device.label || device.deviceId}
						</option>
					))}
				</select>
				<button type="button" onClick={() => setPaused(!paused)}>
					{paused ? 'Resume metering' : 'Pause metering'}
				</button>
				<label>
					target APL: {targetAPL}{' '}
					<input
						type="range"
						min={20}
						max={220}
						value={targetAPL}
						onChange={(e) => setTargetAPL(Number(e.target.value))}
					/>
				</label>
			</div>
			<div style={videoWrapStyle}>
				<ScannerComp
					ref={scannerRef}
					onScan={action('onScan')}
					constraints={deviceId ? { deviceId } : undefined}
					components={{ finder: false }}
				/>
				{meteringBox !== null && (
					<div
						style={{
							...meteringBoxStyle,
							width: meteringBox.width,
							height: meteringBox.height,
						}}
					/>
				)}
			</div>
			<pre style={infoStyle}>
				{diagnostics}
				{lastError.length > 0 ? `\nlast error → ${lastError}` : ''}
			</pre>
		</div>
	);
}

export const WindowedExposure = Template.bind({});

export default {
	title: 'Windowed Exposure',
};
