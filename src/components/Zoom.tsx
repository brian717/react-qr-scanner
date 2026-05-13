import { type CSSProperties, Fragment } from 'react';

import ZoomInIcon from '../assets/ZoomInIcon';
import ZoomOutIcon from '../assets/ZoomOutIcon';

interface IZoomProps {
	scanning: boolean;
	capabilities: { min: number; max: number; step: number };
	value: number;
	onZoom: (value: number) => void;
}

const zoomOutButtonStyle: CSSProperties = {
	bottom: 130,
	right: 8,
	position: 'absolute',
	zIndex: 2,
	background: 'transparent',
	border: 0,
	padding: 4,
	margin: 0,
	cursor: 'pointer',
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
};

const zoomInButtonStyle: CSSProperties = {
	...zoomOutButtonStyle,
	bottom: 180,
};

export default function Zoom(props: IZoomProps) {
	const { scanning, capabilities, onZoom, value } = props;

	if (!scanning) return null;

	const step = capabilities.step > 0 ? capabilities.step : 1;

	function handleZoomIn() {
		onZoom(Math.min(value + step, capabilities.max));
	}

	function handleZoomOut() {
		onZoom(Math.max(value - step, capabilities.min));
	}

	const atMin = value <= capabilities.min;
	const atMax = value >= capabilities.max;

	return (
		<Fragment>
			<button
				type="button"
				aria-label="Zoom out"
				disabled={atMin}
				onClick={handleZoomOut}
				style={{
					...zoomOutButtonStyle,
					cursor: atMin ? 'default' : 'pointer',
				}}
			>
				<ZoomOutIcon disabled={atMin} />
			</button>
			<button
				type="button"
				aria-label="Zoom in"
				disabled={atMax}
				onClick={handleZoomIn}
				style={{
					...zoomInButtonStyle,
					cursor: atMax ? 'default' : 'pointer',
				}}
			>
				<ZoomInIcon disabled={atMax} />
			</button>
		</Fragment>
	);
}
