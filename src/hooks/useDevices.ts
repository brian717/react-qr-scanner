import { useCallback, useEffect, useState } from 'react';

/**
 * Returns the list of available video input devices.
 *
 * The list is fetched on mount and refreshed whenever the browser fires a
 * `devicechange` event (e.g., when a camera is plugged in or unplugged, or
 * when the user grants/revokes camera permission). Errors from
 * `enumerateDevices()` produce an empty list rather than throwing.
 *
 * Device labels are only populated after the user has granted camera
 * permission to the origin. Before that, the list still contains the devices
 * but each `label` is an empty string.
 */
export function useDevices(): MediaDeviceInfo[] {
	const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

	const getDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
		if (
			typeof navigator === 'undefined' ||
			!navigator.mediaDevices?.enumerateDevices
		) {
			return [];
		}

		try {
			const all = await navigator.mediaDevices.enumerateDevices();

			return all.filter((d) => d.kind === 'videoinput');
		} catch {
			return [];
		}
	}, []);

	useEffect(() => {
		let cancelled = false;

		const update = async () => {
			const next = await getDevices();

			if (!cancelled) setDevices(next);
		};

		void update();

		if (
			typeof navigator !== 'undefined' &&
			navigator.mediaDevices?.addEventListener
		) {
			navigator.mediaDevices.addEventListener('devicechange', update);

			return () => {
				cancelled = true;
				navigator.mediaDevices.removeEventListener('devicechange', update);
			};
		}

		return () => {
			cancelled = true;
		};
	}, [getDevices]);

	return devices;
}
