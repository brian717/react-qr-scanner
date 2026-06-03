import type { IDetectedBarcode, IPoint } from '../types';

/** Display vs. intrinsic dimensions of the video element. */
export interface IDisplayGeometry {
	/** Rendered width of the video element (CSS pixels). */
	displayWidth: number;
	/** Rendered height of the video element (CSS pixels). */
	displayHeight: number;
	/** Intrinsic width of the video stream. */
	resolutionWidth: number;
	/** Intrinsic height of the video stream. */
	resolutionHeight: number;
}

/** Scale + offset that maps resolution-space coordinates to display space. */
export interface ICoordinateTransform {
	xScalar: number;
	yScalar: number;
	xOffset: number;
	yOffset: number;
}

/**
 * Computes the scale and centering offset that maps a barcode coordinate from
 * the video's intrinsic resolution space into the displayed element's space.
 *
 * The video is rendered with `object-fit: cover`, so the larger dimension ratio
 * is used, and the overflow is centered (which yields a negative offset on the
 * cropped axis). Returns zeroed scalars when the resolution is unknown, so the
 * caller can skip drawing.
 */
export function computeTransform(
	geometry: IDisplayGeometry,
): ICoordinateTransform {
	const { displayWidth, displayHeight, resolutionWidth, resolutionHeight } =
		geometry;

	if (resolutionWidth === 0 || resolutionHeight === 0) {
		return { xScalar: 0, yScalar: 0, xOffset: 0, yOffset: 0 };
	}

	const largerRatio = Math.max(
		displayWidth / resolutionWidth,
		displayHeight / resolutionHeight,
	);

	const uncutWidth = resolutionWidth * largerRatio;
	const uncutHeight = resolutionHeight * largerRatio;

	return {
		xScalar: uncutWidth / resolutionWidth,
		yScalar: uncutHeight / resolutionHeight,
		xOffset: (displayWidth - uncutWidth) / 2,
		yOffset: (displayHeight - uncutHeight) / 2,
	};
}

/** Scales a point from resolution space toward display space. */
export function scalePoint(
	point: IPoint,
	transform: ICoordinateTransform,
): IPoint {
	return {
		x: Math.floor(point.x * transform.xScalar),
		y: Math.floor(point.y * transform.yScalar),
	};
}

/** Translates a (scaled) point by the centering offset. */
export function translatePoint(
	point: IPoint,
	transform: ICoordinateTransform,
): IPoint {
	return {
		x: Math.floor(point.x + transform.xOffset),
		y: Math.floor(point.y + transform.yOffset),
	};
}

/**
 * Maps a detected barcode's `boundingBox` and `cornerPoints` from resolution
 * space into display space, so a tracker overlay drawn on the display-sized
 * canvas lines up with what the user sees.
 */
export function adjustBarcodeCoordinates(
	detectedCode: IDetectedBarcode,
	transform: ICoordinateTransform,
): IDetectedBarcode {
	const { boundingBox, cornerPoints } = detectedCode;

	const topLeft = translatePoint(
		scalePoint({ x: boundingBox.x, y: boundingBox.y }, transform),
		transform,
	);
	const size = scalePoint(
		{ x: boundingBox.width, y: boundingBox.height },
		transform,
	);

	return {
		...detectedCode,
		cornerPoints: cornerPoints.map((point) =>
			translatePoint(scalePoint(point, transform), transform),
		),
		boundingBox: {
			x: topLeft.x,
			y: topLeft.y,
			width: size.x,
			height: size.y,
		},
	};
}
