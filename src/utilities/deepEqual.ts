import isDateObject from './isDateObject';
import isObject from './isObject';
import isPrimitive from './isPrimitive';

export default function deepEqual(object1: unknown, object2: unknown): boolean {
	if (isPrimitive(object1) || isPrimitive(object2)) {
		return object1 === object2;
	}

	if (isDateObject(object1) && isDateObject(object2)) {
		return object1.getTime() === object2.getTime();
	}

	if (Array.isArray(object1) && Array.isArray(object2)) {
		if (object1.length !== object2.length) return false;

		for (let i = 0; i < object1.length; i++) {
			if (!deepEqual(object1[i], object2[i])) return false;
		}

		return true;
	}

	if (!isObject(object1) || !isObject(object2)) return false;

	const obj1 = object1 as Record<string, unknown>;
	const obj2 = object2 as Record<string, unknown>;

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	if (keys1.length !== keys2.length) return false;

	const keys2Set = new Set(keys2);

	for (const key of keys1) {
		if (!keys2Set.has(key)) return false;

		// React refs are compared by props identity downstream; their
		// internal `.current` mutates without a re-render, so skipping
		// avoids false positives when comparing props/constraints.
		if (key === 'ref') continue;

		const val1 = obj1[key];
		const val2 = obj2[key];

		const bothObjects = isObject(val1) && isObject(val2);
		const bothArrays = Array.isArray(val1) && Array.isArray(val2);
		const bothDates = isDateObject(val1) && isDateObject(val2);

		if (bothObjects || bothArrays || bothDates) {
			if (!deepEqual(val1, val2)) return false;
		} else if (val1 !== val2) {
			return false;
		}
	}

	return true;
}
