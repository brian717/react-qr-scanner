import { render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IScannerHandle } from '../../src/types';

const updateConstraints = vi.fn(async () => undefined);

vi.mock('../../src/hooks/useCamera', () => ({
	default: () => ({
		capabilities: { torch: true, zoom: { min: 1, max: 5, step: 1 } },
		settings: { torch: false, zoom: 2 },
		startCamera: vi.fn(async () => undefined),
		stopCamera: vi.fn(async () => undefined),
		updateConstraints,
		flush: vi.fn(async () => undefined),
		getStream: () => null,
	}),
}));

vi.mock('../../src/hooks/useScanner', () => ({
	default: () => ({ startScanning: vi.fn(), stopScanning: vi.fn() }),
}));

import { Scanner } from '../../src/components/Scanner';

describe('Scanner imperative handle', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('exposes camera state from the active track', () => {
		const ref = createRef<IScannerHandle>();
		render(<Scanner ref={ref} onScan={() => undefined} />);

		const handle = ref.current;
		if (handle === null) throw new Error('ref was not attached');

		const state = handle.getCameraState();
		expect(state.capabilities.torch).toBe(true);
		expect(state.settings.zoom).toBe(2);
	});

	it('resolves snapshot() to null when no frame is available', async () => {
		const ref = createRef<IScannerHandle>();
		render(<Scanner ref={ref} onScan={() => undefined} />);

		const handle = ref.current;
		if (handle === null) throw new Error('ref was not attached');

		// happy-dom video has no intrinsic dimensions.
		await expect(handle.snapshot()).resolves.toBeNull();
	});

	it('proxies torch and zoom through updateConstraints', async () => {
		const ref = createRef<IScannerHandle>();
		render(<Scanner ref={ref} onScan={() => undefined} />);

		const handle = ref.current;
		if (handle === null) throw new Error('ref was not attached');

		await handle.toggleTorch(true);
		expect(updateConstraints).toHaveBeenCalledWith(
			expect.objectContaining({ advanced: [{ torch: true }] }),
		);

		await handle.setZoom(3);
		expect(updateConstraints).toHaveBeenCalledWith(
			expect.objectContaining({ advanced: [{ zoom: 3 }] }),
		);
	});
});
