import { type CSSProperties, useState } from 'react';

import {
	type IScannerError,
	type IScannerProps,
	Scanner as ScannerComp,
} from '../src';

const containerStyle: CSSProperties = {
	width: '80%',
	maxWidth: 500,
	margin: 'auto',
};

const errorBoxStyle: CSSProperties = {
	marginTop: 12,
	padding: 12,
	border: '1px solid #ef4444',
	borderRadius: 6,
	background: '#fff5f5',
	fontFamily: 'monospace',
	fontSize: 13,
};

const guidanceByKind: Record<IScannerError['kind'], string> = {
	'permission-denied':
		'Camera access was denied. Re-enable it in your browser settings and remount.',
	'no-camera': 'No camera detected. Plug one in or try a different device.',
	'in-use':
		'Another app or tab is holding the camera. Close it and remount the scanner.',
	overconstrained:
		"The requested camera constraints can't be satisfied. Try removing deviceId/facingMode.",
	'insecure-context': 'Serve this page over HTTPS or localhost.',
	unsupported: 'This browser does not support the required camera APIs.',
	aborted: 'Camera startup was aborted. Try again.',
	security: 'A security policy blocked camera access.',
	'type-error': 'Invalid input passed to the camera API.',
	unknown: 'An unknown error occurred. Check error.cause for details.',
};

function Template(args: IScannerProps) {
	const [error, setError] = useState<IScannerError | null>(null);

	return (
		<div style={containerStyle}>
			<ScannerComp
				{...args}
				onScan={() => undefined}
				onError={(err) => {
					setError(err);
				}}
				constraints={{ deviceId: 'definitely-not-a-real-device-id' }}
			/>

			{error !== null && (
				<div style={errorBoxStyle}>
					<div>
						<strong>kind:</strong> {error.kind}
					</div>
					<div>
						<strong>message:</strong> {error.message}
					</div>
					<div style={{ marginTop: 6 }}>{guidanceByKind[error.kind]}</div>
				</div>
			)}
		</div>
	);
}

export const ErrorHandling = Template.bind({});

// @ts-expect-error stories args spread typing
ErrorHandling.args = {};

export default {
	title: 'Error Handling',
};
