import type { CSSProperties } from 'react';

import TorchOffIcon from '../assets/TorchOffIcon';
import TorchOnIcon from '../assets/TorchOnIcon';

interface ITorchProps {
	scanning: boolean;
	status: boolean;
	torchToggle: (value: boolean) => void;
}

const buttonStyle: CSSProperties = {
	bottom: 35,
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

export default function Torch(props: ITorchProps) {
	const { status, scanning, torchToggle } = props;

	if (!scanning) return null;

	const label = status ? 'Turn flashlight off' : 'Turn flashlight on';

	return (
		<button
			type="button"
			aria-label={label}
			aria-pressed={status}
			onClick={() => torchToggle(!status)}
			style={buttonStyle}
		>
			{status ? <TorchOffIcon /> : <TorchOnIcon />}
		</button>
	);
}
