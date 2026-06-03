import { type CSSProperties, useEffect, useRef, useState } from 'react';

import CameraOffIcon from '../assets/CameraOffIcon';
import CameraOnIcon from '../assets/CameraOnIcon';

interface IOnOffProps {
	scanning: boolean;
	startScanning: (deviceId?: string | undefined) => void;
	stopScanning: () => void;
}

const buttonStyle: CSSProperties = {
	bottom: 85,
	insetInlineEnd: 8,
	position: 'absolute',
	zIndex: 2,
	background: 'transparent',
	border: 0,
	padding: 4,
	margin: 0,
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
};

export default function OnOff(props: IOnOffProps) {
	const { scanning, startScanning, stopScanning } = props;

	const [buttonDisabled, setButtonDisabled] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
		};
	}, []);

	function toggleScanning() {
		if (buttonDisabled) return;

		setButtonDisabled(true);

		if (scanning) {
			stopScanning();
		} else {
			startScanning();
		}

		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = setTimeout(() => {
			setButtonDisabled(false);
			timeoutRef.current = null;
		}, 1000);
	}

	const label = scanning ? 'Turn camera off' : 'Turn camera on';

	return (
		<button
			type="button"
			className="rqs-control"
			aria-label={label}
			aria-pressed={scanning}
			disabled={buttonDisabled}
			onClick={toggleScanning}
			style={{
				...buttonStyle,
				cursor: buttonDisabled ? 'default' : 'pointer',
				opacity: buttonDisabled ? 0.5 : 1,
			}}
		>
			{scanning ? (
				<CameraOffIcon disabled={buttonDisabled} />
			) : (
				<CameraOnIcon disabled={buttonDisabled} />
			)}
		</button>
	);
}
