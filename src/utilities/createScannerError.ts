import type { IScannerError, ScannerErrorKind } from '../types';

const NAME_TO_KIND: Record<string, ScannerErrorKind> = {
	NotAllowedError: 'permission-denied',
	PermissionDeniedError: 'permission-denied',
	NotFoundError: 'no-camera',
	DevicesNotFoundError: 'no-camera',
	NotReadableError: 'in-use',
	TrackStartError: 'in-use',
	OverconstrainedError: 'overconstrained',
	ConstraintNotSatisfiedError: 'overconstrained',
	AbortError: 'aborted',
	SecurityError: 'security',
	TypeError: 'type-error',
};

export function createScannerError(cause: unknown): IScannerError {
	if (cause instanceof DOMException || cause instanceof Error) {
		const name = (cause as { name?: string }).name ?? '';
		const message = cause.message ?? String(cause);

		if (message.includes('secure context')) {
			return { kind: 'insecure-context', message, cause };
		}

		if (message.includes('Stream API')) {
			return { kind: 'unsupported', message, cause };
		}

		const kind = NAME_TO_KIND[name] ?? 'unknown';

		return { kind, message, cause };
	}

	return {
		kind: 'unknown',
		message: typeof cause === 'string' ? cause : 'Unknown scanner error',
		cause,
	};
}
