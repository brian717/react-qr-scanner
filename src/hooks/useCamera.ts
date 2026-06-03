import 'webrtc-adapter';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { IStartCamera } from '../types';
import type { IStartTaskResult, IStopTaskResult } from '../types/internal';

type TaskResult = IStartTaskResult | IStopTaskResult;

export interface IUseCameraOptions {
	/** Maximum time (ms) to wait for the video element to start playing. */
	startTimeoutMs?: number;
	/** Delay (ms) after `play()` before reading capabilities/settings. */
	settleDelayMs?: number;
}

const DEFAULT_START_TIMEOUT_MS = 3000;
const DEFAULT_SETTLE_DELAY_MS = 500;

export default function useCamera(options: IUseCameraOptions = {}) {
	const {
		startTimeoutMs = DEFAULT_START_TIMEOUT_MS,
		settleDelayMs = DEFAULT_SETTLE_DELAY_MS,
	} = options;

	const taskQueue = useRef<Promise<TaskResult>>(
		Promise.resolve({ type: 'stop', data: {} }),
	);
	const currentStream = useRef<MediaStream | null>(null);
	const currentVideoTrack = useRef<MediaStreamTrack | null>(null);

	const [capabilities, setCapabilities] = useState<MediaTrackCapabilities>({});
	const [settings, setSettings] = useState<MediaTrackSettings>({});

	const runStartTask = useCallback(
		async (
			videoEl: HTMLVideoElement,
			constraints: MediaTrackConstraints,
		): Promise<IStartTaskResult> => {
			if (!window.isSecureContext) {
				throw new Error(
					'camera access is only permitted in secure context. Use HTTPS or localhost rather than HTTP.',
				);
			}

			if (navigator?.mediaDevices?.getUserMedia === undefined) {
				throw new Error('this browser has no Stream API support');
			}

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: constraints,
			});

			videoEl.srcObject = stream;

			// Race play() against a timeout. Some cameras legitimately take a
			// while to start (multi-cam phones, USB webcams initializing); the
			// timeout exists so a fully wedged play() doesn't hang the caller.
			let timeoutId: ReturnType<typeof setTimeout> | undefined;

			try {
				await Promise.race([
					videoEl.play(),
					new Promise<never>((_, reject) => {
						timeoutId = setTimeout(
							() =>
								reject(
									new Error(
										`Loading camera stream timed out after ${startTimeoutMs} ms.`,
									),
								),
							startTimeoutMs,
						);
					}),
				]);
			} finally {
				if (timeoutId !== undefined) clearTimeout(timeoutId);
			}

			// Some browsers (notably mobile Safari) report stale track settings
			// immediately after play(); this short wait lets capabilities settle.
			if (settleDelayMs > 0) {
				await new Promise((resolve) => setTimeout(resolve, settleDelayMs));
			}

			const [track] = stream.getVideoTracks();

			setSettings(track.getSettings());
			setCapabilities(track.getCapabilities?.() ?? {});

			currentStream.current = stream;
			currentVideoTrack.current = track;

			return {
				type: 'start',
				data: { videoEl, stream, constraints },
			};
		},
		[startTimeoutMs, settleDelayMs],
	);

	const runStopTask = useCallback(
		async (
			videoEl: HTMLVideoElement,
			stream: MediaStream,
		): Promise<IStopTaskResult> => {
			videoEl.srcObject = null;
			videoEl.removeAttribute('src');
			videoEl.load();

			for (const track of stream.getTracks()) {
				stream.removeTrack(track);
				track.stop();
			}

			currentStream.current = null;
			currentVideoTrack.current = null;

			setSettings({});

			return { type: 'stop', data: {} };
		},
		[],
	);

	const startCamera = useCallback(
		async (
			videoEl: HTMLVideoElement,
			{ constraints, restart = false }: IStartCamera,
		) => {
			let startError: unknown = null;

			taskQueue.current = taskQueue.current
				.then((prevTaskResult) => {
					if (prevTaskResult.type === 'start') {
						const {
							data: {
								videoEl: prevVideoEl,
								stream: prevStream,
								constraints: prevConstraints,
							},
						} = prevTaskResult;

						if (
							!restart &&
							videoEl === prevVideoEl &&
							constraints === prevConstraints
						) {
							return prevTaskResult;
						}

						return runStopTask(prevVideoEl, prevStream).then(() =>
							runStartTask(videoEl, constraints),
						);
					}

					return runStartTask(videoEl, constraints);
				})
				.catch((error): IStopTaskResult => {
					startError = error;
					return { type: 'stop', data: {} };
				});

			const taskResult = await taskQueue.current;

			if (startError) throw startError;

			if (taskResult.type === 'stop') {
				throw new Error(
					'Something went wrong with the camera task queue (start task).',
				);
			}
		},
		[runStartTask, runStopTask],
	);

	const stopCamera = useCallback(async () => {
		taskQueue.current = taskQueue.current.then((prevTaskResult) => {
			if (prevTaskResult.type === 'stop') {
				return prevTaskResult;
			}

			const {
				data: { videoEl, stream },
			} = prevTaskResult;

			return runStopTask(videoEl, stream);
		});

		const taskResult = await taskQueue.current;

		if (taskResult.type === 'start') {
			throw new Error(
				'Something went wrong with the camera task queue (stop task).',
			);
		}
	}, [runStopTask]);

	const updateConstraints = useCallback(
		async (newConstraints: MediaTrackConstraints) => {
			// Route through the task queue so updates can't race with start/stop.
			// On failure, preserve the previous start-task result so stopCamera()
			// can still tear down the live stream — synthesizing a fake `stop`
			// result here would corrupt the queue and orphan the camera hardware.
			let updateError: unknown = null;

			taskQueue.current = taskQueue.current.then(
				async (prevTaskResult): Promise<TaskResult> => {
					const videoTrack = currentVideoTrack.current;

					if (!videoTrack || prevTaskResult.type !== 'start') {
						updateError = new Error('No active video track found.');

						return prevTaskResult;
					}

					try {
						// Mobile browsers can't mix ImageCapture (torch) and non-ImageCapture
						// (zoom) constraints. If the zoom is being applied while the torch is on,
						// disable the torch first and sync the React state so the UI reflects it.
						if (newConstraints.advanced?.[0]?.zoom) {
							const caps = videoTrack.getCapabilities();

							if (caps.torch) {
								await videoTrack.applyConstraints({
									advanced: [{ torch: false }],
								});

								setSettings(videoTrack.getSettings());
							}
						}

						await videoTrack.applyConstraints(newConstraints);

						setCapabilities(videoTrack.getCapabilities());
						setSettings(videoTrack.getSettings());
					} catch (err) {
						updateError = err;
					}

					return prevTaskResult;
				},
			);

			await taskQueue.current;

			if (updateError) throw updateError;
		},
		[],
	);

	const flush = useCallback(async () => {
		try {
			await taskQueue.current;
		} catch {
			// Already settled; error path doesn't matter for flush.
		}
	}, []);

	useEffect(() => {
		return () => {
			// Best-effort cleanup. Tasks already in the queue will still run;
			// callers that need deterministic teardown should await stopCamera()
			// (and optionally flush()) before unmounting.
			void stopCamera();
		};
	}, [stopCamera]);

	return {
		capabilities,
		settings,
		startCamera,
		stopCamera,
		updateConstraints,
		flush,
		getStream: () => currentStream.current,
	};
}
