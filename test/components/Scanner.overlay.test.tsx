import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { startCamera, stopCamera } = vi.hoisted(() => ({
	startCamera: vi.fn(async () => undefined),
	stopCamera: vi.fn(async () => undefined),
}));

vi.mock('../../src/hooks/useCamera', () => ({
	default: () => ({
		capabilities: {},
		settings: {},
		startCamera,
		stopCamera,
		updateConstraints: vi.fn(async () => undefined),
		flush: vi.fn(async () => undefined),
		getStream: () => null,
	}),
}));

vi.mock('../../src/hooks/useScanner', () => ({
	default: () => ({ startScanning: vi.fn(), stopScanning: vi.fn() }),
}));

import { Scanner } from '../../src';

describe('Scanner status overlay recovery', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		// happy-dom has no 2D canvas; Scanner only needs a context handle to
		// snapshot frames, so a stub with the methods it calls is enough.
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D);
		startCamera.mockReset();
		stopCamera.mockReset().mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function flushAsyncWork() {
		for (let i = 0; i < 10; i++) {
			await new Promise((r) => setTimeout(r, 0));
		}
	}

	it('shows a non-blocking error overlay with a working retry after a start failure', async () => {
		startCamera.mockRejectedValue(new Error('boom'));

		render(
			<Scanner
				onScan={() => undefined}
				components={{ statusOverlay: true, onOff: true }}
			/>,
		);

		await flushAsyncWork();

		const alert = await screen.findByRole('alert');
		// The backdrop must not intercept clicks meant for the controls beneath.
		expect(alert.style.pointerEvents).toBe('none');
		// The built-in on/off control still exists underneath the overlay.
		expect(
			screen.getByRole('button', { name: /turn camera on/i }),
		).toBeTruthy();

		const callsBeforeRetry = startCamera.mock.calls.length;
		startCamera.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /retry/i }));
		await flushAsyncWork();

		// Retry routes back through the camera-start path.
		expect(startCamera.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
	});
});
