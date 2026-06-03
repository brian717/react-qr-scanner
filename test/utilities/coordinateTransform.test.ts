import { describe, expect, it } from 'vitest';
import type { IDetectedBarcode } from '../../src/types';
import {
	adjustBarcodeCoordinates,
	computeTransform,
	scalePoint,
	translatePoint,
} from '../../src/utilities/coordinateTransform';

describe('computeTransform', () => {
	it('returns a uniform 1:1 transform when display matches resolution', () => {
		const t = computeTransform({
			displayWidth: 100,
			displayHeight: 100,
			resolutionWidth: 100,
			resolutionHeight: 100,
		});

		expect(t).toEqual({ xScalar: 1, yScalar: 1, xOffset: 0, yOffset: 0 });
	});

	it('scales uniformly and keeps zero offset when aspect ratios match', () => {
		const t = computeTransform({
			displayWidth: 200,
			displayHeight: 200,
			resolutionWidth: 100,
			resolutionHeight: 100,
		});

		expect(t).toEqual({ xScalar: 2, yScalar: 2, xOffset: 0, yOffset: 0 });
	});

	it('uses the larger ratio and centers the cropped axis (object-fit: cover)', () => {
		// Wider display than the source: width drives the scale (×2), and the
		// vertical overflow is centered with a negative offset (top/bottom crop).
		const t = computeTransform({
			displayWidth: 200,
			displayHeight: 100,
			resolutionWidth: 100,
			resolutionHeight: 100,
		});

		expect(t.xScalar).toBe(2);
		expect(t.yScalar).toBe(2);
		expect(t.xOffset).toBe(0);
		expect(t.yOffset).toBe(-50);
	});

	it('returns a zeroed transform when the resolution is unknown', () => {
		expect(
			computeTransform({
				displayWidth: 200,
				displayHeight: 200,
				resolutionWidth: 0,
				resolutionHeight: 0,
			}),
		).toEqual({ xScalar: 0, yScalar: 0, xOffset: 0, yOffset: 0 });
	});
});

describe('scalePoint / translatePoint', () => {
	const transform = { xScalar: 2, yScalar: 2, xOffset: 0, yOffset: -50 };

	it('scales and floors', () => {
		expect(scalePoint({ x: 10, y: 21 }, transform)).toEqual({ x: 20, y: 42 });
	});

	it('translates by the offset and floors', () => {
		expect(translatePoint({ x: 20, y: 42 }, transform)).toEqual({
			x: 20,
			y: -8,
		});
	});
});

describe('adjustBarcodeCoordinates', () => {
	it('maps boundingBox and cornerPoints into display space', () => {
		const code: IDetectedBarcode = {
			boundingBox: { x: 10, y: 20, width: 30, height: 40 },
			cornerPoints: [
				{ x: 10, y: 20 },
				{ x: 40, y: 20 },
				{ x: 40, y: 60 },
				{ x: 10, y: 60 },
			],
			format: 'qr_code',
			rawValue: 'hello',
		};

		const transform = computeTransform({
			displayWidth: 200,
			displayHeight: 200,
			resolutionWidth: 100,
			resolutionHeight: 100,
		});

		const adjusted = adjustBarcodeCoordinates(code, transform);

		// ×2 uniform scale, no offset.
		expect(adjusted.boundingBox).toEqual({
			x: 20,
			y: 40,
			width: 60,
			height: 80,
		});
		expect(adjusted.cornerPoints).toEqual([
			{ x: 20, y: 40 },
			{ x: 80, y: 40 },
			{ x: 80, y: 120 },
			{ x: 20, y: 120 },
		]);
		// Non-coordinate fields are preserved.
		expect(adjusted.format).toBe('qr_code');
		expect(adjusted.rawValue).toBe('hello');
	});
});
