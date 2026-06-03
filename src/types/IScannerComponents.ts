import type { ReactNode } from 'react';
import type {
	IFinderConfig,
	IStatusOverlayState,
	TrackFunction,
} from './index';

export interface IScannerComponents {
	/**
	 * Show the built-in finder overlay. Pass an {@link IFinderConfig} object to
	 * theme its color, size, and border radius instead of just `true`.
	 */
	finder?: boolean | IFinderConfig;
	torch?: boolean;
	tracker?: TrackFunction;
	onOff?: boolean;
	zoom?: boolean;
	/**
	 * Show a built-in loading/error overlay. Pass `true` for the default UI, or
	 * a render function to fully customize it from the current overlay state.
	 */
	statusOverlay?: boolean | ((state: IStatusOverlayState) => ReactNode);
}
