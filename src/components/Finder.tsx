import type { CSSProperties } from 'react';

import ControlFocusStyle from './ControlFocusStyle';
import OnOff from './OnOff';
import Torch from './Torch';
import Zoom from './Zoom';

const DEFAULT_COLOR = '#ef4444';
const DEFAULT_SIZE = '70%';
const DEFAULT_RADIUS = '0.5rem';

const fullContainer: CSSProperties = {
	width: '100%',
	height: '100%',
	position: 'relative',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	overflow: 'hidden',
};

const innerContainer: CSSProperties = {
	width: '100%',
	height: '100%',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	position: 'relative',
};

const overlay: CSSProperties = {
	position: 'absolute',
	top: 0,
	right: 0,
	bottom: 0,
	left: 0,
	pointerEvents: 'none',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
};

const cornerBase: CSSProperties = {
	position: 'absolute',
	width: '15%',
	height: '15%',
};

export interface IFinderProps {
	scanning: boolean;
	capabilities: MediaTrackCapabilities;
	onOff?: boolean;
	color?: string;
	size?: string;
	borderRadius?: string;
	startScanning: (deviceId?: string | undefined) => void;
	stopScanning: () => void;
	torch?: {
		status: boolean;
		toggle: (value: boolean) => void;
	};
	zoom?: {
		value: number;
		onChange: (value: number) => void;
	};
}

export default function Finder(props: IFinderProps) {
	const {
		scanning,
		capabilities,
		onOff,
		torch,
		zoom,
		color = DEFAULT_COLOR,
		size = DEFAULT_SIZE,
		borderRadius = DEFAULT_RADIUS,
		startScanning,
		stopScanning,
	} = props;

	const borderBox: CSSProperties = {
		position: 'relative',
		width: size,
		aspectRatio: '1 / 1',
		border: `2px dashed ${color}66`,
		borderRadius,
	};

	const corner = `4px solid ${color}`;

	return (
		<div style={fullContainer}>
			<ControlFocusStyle />
			<div style={innerContainer}>
				<div style={overlay}>
					<div style={borderBox}>
						<div
							style={{
								...cornerBase,
								top: 0,
								left: 0,
								borderTop: corner,
								borderLeft: corner,
								borderTopLeftRadius: borderRadius,
							}}
						></div>
						<div
							style={{
								...cornerBase,
								top: 0,
								right: 0,
								borderTop: corner,
								borderRight: corner,
								borderTopRightRadius: borderRadius,
							}}
						></div>
						<div
							style={{
								...cornerBase,
								bottom: 0,
								left: 0,
								borderBottom: corner,
								borderLeft: corner,
								borderBottomLeftRadius: borderRadius,
							}}
						></div>
						<div
							style={{
								...cornerBase,
								bottom: 0,
								right: 0,
								borderBottom: corner,
								borderRight: corner,
								borderBottomRightRadius: borderRadius,
							}}
						></div>
					</div>
				</div>
				{onOff && (
					<OnOff
						scanning={scanning}
						startScanning={startScanning}
						stopScanning={stopScanning}
					/>
				)}
				{torch && capabilities.torch && (
					<Torch
						scanning={scanning}
						status={torch.status}
						torchToggle={torch.toggle}
					/>
				)}
				{zoom && capabilities.zoom && (
					<Zoom
						scanning={scanning}
						capabilities={capabilities.zoom}
						value={zoom.value}
						onZoom={zoom.onChange}
					/>
				)}
			</div>
		</div>
	);
}
