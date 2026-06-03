import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusOverlay from '../../src/components/StatusOverlay';
import type { IScannerError } from '../../src/types';

function error(kind: IScannerError['kind']): IScannerError {
	return { kind, message: `raw ${kind}`, cause: null };
}

describe('StatusOverlay', () => {
	it('renders nothing when idle (no error, not loading)', () => {
		const { container } = render(
			<StatusOverlay error={null} isLoading={false} />,
		);

		expect(container.firstChild).toBeNull();
	});

	it('shows a loading status while starting', () => {
		render(<StatusOverlay error={null} isLoading />);

		const status = screen.getByRole('status');
		expect(status.textContent).toContain('Starting camera');
	});

	it('maps known error kinds to friendly alert messages', () => {
		render(
			<StatusOverlay error={error('permission-denied')} isLoading={false} />,
		);

		const alert = screen.getByRole('alert');
		expect(alert.textContent).toMatch(/denied/i);
		// The raw technical message is not surfaced for known kinds.
		expect(alert.textContent).not.toContain('raw permission-denied');
	});

	it('prioritizes the error over the loading state', () => {
		render(<StatusOverlay error={error('no-camera')} isLoading />);

		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.getByRole('alert').textContent).toMatch(/no camera/i);
	});

	it('keeps the backdrop non-blocking so controls beneath stay clickable', () => {
		const { rerender } = render(<StatusOverlay error={null} isLoading />);
		expect(screen.getByRole('status').style.pointerEvents).toBe('none');

		rerender(<StatusOverlay error={error('in-use')} isLoading={false} />);
		expect(screen.getByRole('alert').style.pointerEvents).toBe('none');
	});

	it('renders a clickable retry control for recoverable errors', () => {
		const onRetry = vi.fn();
		render(
			<StatusOverlay
				error={error('in-use')}
				isLoading={false}
				onRetry={onRetry}
			/>,
		);

		const button = screen.getByRole('button', { name: /retry/i });
		// The button opts back into pointer events even though the backdrop is inert.
		expect(button.style.pointerEvents).toBe('auto');

		fireEvent.click(button);
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it('omits the retry control for errors a retry cannot resolve', () => {
		const onRetry = vi.fn();

		for (const kind of ['unsupported', 'insecure-context'] as const) {
			const { unmount } = render(
				<StatusOverlay
					error={error(kind)}
					isLoading={false}
					onRetry={onRetry}
				/>,
			);

			expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
			unmount();
		}
	});

	it('omits the retry control when no handler is provided', () => {
		render(<StatusOverlay error={error('in-use')} isLoading={false} />);

		expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
	});
});
