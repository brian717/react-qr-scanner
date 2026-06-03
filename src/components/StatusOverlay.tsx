import type { CSSProperties } from 'react';
import type { ScannerErrorKind } from '../types';
import type { IStatusOverlayState } from '../types/IStatusOverlayState';

const ERROR_MESSAGES: Record<ScannerErrorKind, string> = {
	'permission-denied': 'Camera access was denied. Please allow it and retry.',
	'no-camera': 'No camera was found on this device.',
	'in-use': 'The camera is being used by another application.',
	overconstrained: "The requested camera settings aren't supported.",
	'insecure-context': 'Camera access requires a secure (HTTPS) connection.',
	unsupported: "This browser doesn't support camera access.",
	aborted: 'The camera request was interrupted. Please retry.',
	security: 'Camera access was blocked for security reasons.',
	'type-error': 'The camera could not be started.',
	unknown: 'Something went wrong while accessing the camera.',
};

// Errors a retry can never resolve: a missing secure context needs an HTTPS
// reload, and an unsupported browser won't gain support by trying again.
const NON_RETRYABLE: ReadonlySet<ScannerErrorKind> = new Set([
	'insecure-context',
	'unsupported',
]);

const containerStyle: CSSProperties = {
	position: 'absolute',
	inset: 0,
	zIndex: 3,
	// The backdrop is passive feedback, not a modal. Letting clicks pass through
	// keeps the controls beneath (on/off, torch, zoom) reachable; interactive
	// children below opt back in with `pointerEvents: 'auto'`.
	pointerEvents: 'none',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	textAlign: 'center',
	padding: 16,
	color: '#fff',
	background: 'rgba(0, 0, 0, 0.6)',
	font: '500 14px/1.4 system-ui, sans-serif',
};

const errorContentStyle: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	gap: 12,
};

const retryButtonStyle: CSSProperties = {
	pointerEvents: 'auto',
	cursor: 'pointer',
	padding: '8px 16px',
	borderRadius: 6,
	border: '1px solid rgba(255, 255, 255, 0.6)',
	background: 'rgba(255, 255, 255, 0.12)',
	color: '#fff',
	font: 'inherit',
};

const loadingContentStyle: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
};

const spinnerStyle: CSSProperties = {
	width: 28,
	height: 28,
	marginBottom: 12,
	borderRadius: '50%',
	border: '3px solid rgba(255, 255, 255, 0.35)',
	borderTopColor: '#fff',
	animation: 'rqs-spin 0.8s linear infinite',
};

// Keyframes can't live in inline styles; the spinner animation respects
// reduced-motion preferences by pausing the rotation.
const SPINNER_CSS = `@keyframes rqs-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){.rqs-spinner{animation:none}}`;

/**
 * Built-in loading / error overlay. Enabled via `components.statusOverlay`.
 * Maps an {@link IStatusOverlayState} to accessible, human-readable feedback.
 */
export default function StatusOverlay(props: IStatusOverlayState) {
	const { error, isLoading, onRetry } = props;

	if (error !== null) {
		const canRetry = onRetry !== undefined && !NON_RETRYABLE.has(error.kind);

		return (
			<div style={containerStyle} role="alert">
				<div style={errorContentStyle}>
					<span>{ERROR_MESSAGES[error.kind] ?? error.message}</span>
					{canRetry && (
						<button
							type="button"
							className="rqs-control"
							style={retryButtonStyle}
							onClick={() => onRetry?.()}
						>
							Retry
						</button>
					)}
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div style={containerStyle} role="status">
				<style>{SPINNER_CSS}</style>
				<div style={loadingContentStyle}>
					<div className="rqs-spinner" style={spinnerStyle} />
					<span>Starting camera…</span>
				</div>
			</div>
		);
	}

	return null;
}
