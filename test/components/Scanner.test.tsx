import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/hooks/useCamera', () => ({
	default: () => ({
		capabilities: {},
		settings: {},
		startCamera: vi.fn(async () => undefined),
		stopCamera: vi.fn(async () => undefined),
		updateConstraints: vi.fn(async () => undefined),
		flush: vi.fn(async () => undefined),
		getStream: () => null,
	}),
}));

vi.mock('../../src/hooks/useScanner', () => ({
	default: () => ({
		startScanning: vi.fn(),
		stopScanning: vi.fn(),
	}),
}));

import { Scanner } from '../../src/components/Scanner';

describe('Scanner', () => {
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		errorSpy.mockRestore();
		vi.restoreAllMocks();
	});

	function findMaxUpdateDepthError() {
		return errorSpy.mock.calls.find((call: unknown[]) =>
			String(call[0] ?? '').includes('Maximum update depth'),
		);
	}

	async function flushAsyncWork() {
		// Multiple microtask+macrotask flushes so any pending render cascade
		// has a chance to run. If the constraints-normalization effect
		// doesn't converge, this triggers React's "Maximum update depth"
		// guard.
		for (let i = 0; i < 10; i++) {
			await new Promise((r) => setTimeout(r, 0));
		}
	}

	it('does not infinite-loop when constraints change from undefined to a deviceId', async () => {
		const { rerender } = render(<Scanner onScan={() => undefined} />);

		await flushAsyncWork();

		rerender(
			<Scanner onScan={() => undefined} constraints={{ deviceId: 'cam-1' }} />,
		);

		await flushAsyncWork();

		expect(findMaxUpdateDepthError()).toBeUndefined();
	});

	it('does not infinite-loop when constraints flip back and forth', async () => {
		const { rerender } = render(
			<Scanner onScan={() => undefined} constraints={{ deviceId: 'cam-1' }} />,
		);

		await flushAsyncWork();

		rerender(<Scanner onScan={() => undefined} constraints={{}} />);
		await flushAsyncWork();

		rerender(
			<Scanner onScan={() => undefined} constraints={{ deviceId: 'cam-2' }} />,
		);
		await flushAsyncWork();

		expect(findMaxUpdateDepthError()).toBeUndefined();
	});

	it('does not infinite-loop when only non-deviceId constraints change', async () => {
		const { rerender } = render(
			<Scanner
				onScan={() => undefined}
				constraints={{ width: { ideal: 720 } }}
			/>,
		);

		await flushAsyncWork();

		rerender(
			<Scanner
				onScan={() => undefined}
				constraints={{ width: { ideal: 1080 } }}
			/>,
		);

		await flushAsyncWork();

		expect(findMaxUpdateDepthError()).toBeUndefined();
	});
});
