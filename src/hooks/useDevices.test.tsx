import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDevices } from './useDevices';

type DeviceListener = (event: Event) => void;

function makeMockMediaDevices(devices: MediaDeviceInfo[]) {
	const listeners = new Set<DeviceListener>();
	let current = devices;

	return {
		enumerateDevices: vi.fn(async () => current),
		addEventListener: vi.fn((event: string, cb: DeviceListener) => {
			if (event === 'devicechange') listeners.add(cb);
		}),
		removeEventListener: vi.fn((event: string, cb: DeviceListener) => {
			if (event === 'devicechange') listeners.delete(cb);
		}),
		setDevices(next: MediaDeviceInfo[]) {
			current = next;
		},
		fireChange() {
			for (const l of listeners) l(new Event('devicechange'));
		},
	};
}

function makeDevice(
	deviceId: string,
	kind: MediaDeviceKind,
	label = '',
): MediaDeviceInfo {
	return {
		deviceId,
		groupId: 'group',
		kind,
		label,
		toJSON() {
			return this;
		},
	} as MediaDeviceInfo;
}

describe('useDevices', () => {
	let mock: ReturnType<typeof makeMockMediaDevices>;

	beforeEach(() => {
		mock = makeMockMediaDevices([
			makeDevice('cam1', 'videoinput', 'Front'),
			makeDevice('mic1', 'audioinput'),
			makeDevice('cam2', 'videoinput', 'Back'),
		]);
		Object.defineProperty(navigator, 'mediaDevices', {
			configurable: true,
			value: mock,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns only video inputs', async () => {
		const { result } = renderHook(() => useDevices());

		await waitFor(() => expect(result.current).toHaveLength(2));
		expect(result.current.map((d) => d.deviceId)).toEqual(['cam1', 'cam2']);
	});

	it('refreshes on devicechange', async () => {
		const { result } = renderHook(() => useDevices());
		await waitFor(() => expect(result.current).toHaveLength(2));

		await act(async () => {
			mock.setDevices([makeDevice('cam1', 'videoinput', 'Front')]);
			mock.fireChange();
		});

		await waitFor(() => expect(result.current).toHaveLength(1));
	});

	it('returns empty array if enumerateDevices throws', async () => {
		mock.enumerateDevices.mockRejectedValueOnce(new Error('blocked'));
		const { result } = renderHook(() => useDevices());

		await waitFor(() => {
			expect(mock.enumerateDevices).toHaveBeenCalled();
		});
		expect(result.current).toEqual([]);
	});
});
