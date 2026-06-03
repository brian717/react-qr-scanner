import { describe, expect, it } from 'vitest';
import deepEqual from '../../src/utilities/deepEqual';

describe('deepEqual', () => {
	it('compares primitives by identity', () => {
		expect(deepEqual(1, 1)).toBe(true);
		expect(deepEqual(1, 2)).toBe(false);
		expect(deepEqual('a', 'a')).toBe(true);
		expect(deepEqual(null, null)).toBe(true);
		expect(deepEqual(null, undefined)).toBe(false);
	});

	it('compares dates by time', () => {
		expect(deepEqual(new Date(0), new Date(0))).toBe(true);
		expect(deepEqual(new Date(0), new Date(1))).toBe(false);
	});

	it('compares flat objects', () => {
		expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
		expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
		expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
		expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
	});

	it('compares nested objects recursively', () => {
		expect(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } })).toBe(
			true,
		);
		expect(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } })).toBe(
			false,
		);
	});

	it('compares arrays by element', () => {
		expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
		expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
		expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false);
	});

	it('compares nested arrays of objects', () => {
		expect(deepEqual([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 2 }])).toBe(true);
		expect(deepEqual([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 3 }])).toBe(false);
	});

	it('treats ref keys as equal regardless of value', () => {
		const aRef = { current: 1 };
		const bRef = { current: 999 };
		expect(deepEqual({ ref: aRef, x: 1 }, { ref: bRef, x: 1 })).toBe(true);
	});

	it('rejects when key counts differ', () => {
		expect(deepEqual({ a: 1 }, {})).toBe(false);
	});

	it('handles MediaTrackConstraints-shaped objects', () => {
		const a: MediaTrackConstraints = {
			facingMode: 'environment',
			width: { ideal: 720 },
		};
		const b: MediaTrackConstraints = {
			facingMode: 'environment',
			width: { ideal: 720 },
		};
		expect(deepEqual(a, b)).toBe(true);

		const c: MediaTrackConstraints = {
			facingMode: 'environment',
			width: { ideal: 1080 },
		};
		expect(deepEqual(a, c)).toBe(false);
	});
});
