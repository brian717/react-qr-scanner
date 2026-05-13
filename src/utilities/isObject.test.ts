import { describe, expect, it } from 'vitest';
import isObject from './isObject';

describe('isObject', () => {
	it('returns true for plain objects', () => {
		expect(isObject({})).toBe(true);
		expect(isObject({ a: 1 })).toBe(true);
	});

	it('returns false for arrays', () => {
		expect(isObject([])).toBe(false);
		expect(isObject([1, 2])).toBe(false);
	});

	it('returns false for null and undefined', () => {
		expect(isObject(null)).toBe(false);
		expect(isObject(undefined)).toBe(false);
	});

	it('returns false for primitives', () => {
		expect(isObject(1)).toBe(false);
		expect(isObject('a')).toBe(false);
		expect(isObject(true)).toBe(false);
	});

	it('returns false for Date instances', () => {
		expect(isObject(new Date())).toBe(false);
	});
});
