import type { IDetectedBarcode } from '../types';

/**
 * Tracker overlay that draws an outline connecting the four corner points
 * of every detected barcode.
 */
export function outline(
	detectedCodes: IDetectedBarcode[],
	ctx: CanvasRenderingContext2D,
) {
	for (const detectedCode of detectedCodes) {
		const [firstPoint, ...otherPoints] = detectedCode.cornerPoints;

		ctx.lineWidth = 2;
		ctx.strokeStyle = 'yellow';

		ctx.beginPath();
		ctx.moveTo(firstPoint.x, firstPoint.y);

		for (const { x, y } of otherPoints) {
			ctx.lineTo(x, y);
		}

		ctx.lineTo(firstPoint.x, firstPoint.y);
		ctx.closePath();
		ctx.stroke();
	}
}

/**
 * Tracker overlay that draws an axis-aligned bounding box around each barcode.
 */
export function boundingBox(
	detectedCodes: IDetectedBarcode[],
	ctx: CanvasRenderingContext2D,
) {
	for (const detectedCode of detectedCodes) {
		const {
			boundingBox: { x, y, width, height },
		} = detectedCode;

		ctx.lineWidth = 2;
		ctx.strokeStyle = 'yellow';
		ctx.strokeRect(x, y, width, height);
	}
}

interface IParsedSegments {
	lines: string[];
	parsedLines: Array<
		Array<{ text: string; color: 'black' | 'blue' | 'green' }>
	>;
}

const PROPERTY_RE = /"([^"]+)":/g;
const VALUE_RE = /:\s*("[^"]*"|\d+|true|false|null)/g;

const TEXT_CACHE = new Map<string, IParsedSegments>();
const TEXT_CACHE_LIMIT = 32;

function parseRawValue(rawValue: string): IParsedSegments {
	const cached = TEXT_CACHE.get(rawValue);

	if (cached !== undefined) return cached;

	let formatted: string;

	try {
		formatted = JSON.stringify(JSON.parse(rawValue), null, 2);
	} catch {
		formatted = rawValue;
	}

	const lines = formatted.split('\n');
	const parsedLines = lines.map((line) => {
		const segments: Array<{ text: string; color: 'black' | 'blue' | 'green' }> =
			[];
		const propertyMatches = [...line.matchAll(PROPERTY_RE)];
		const valueMatches = [...line.matchAll(VALUE_RE)];
		let lastIndex = 0;

		propertyMatches.forEach((match, matchIndex) => {
			const property = match[0].replace(':', '');
			const matchIdx = match.index ?? 0;
			const beforeProperty = line.substring(lastIndex, matchIdx);

			if (beforeProperty.length > 0) {
				segments.push({ text: beforeProperty, color: 'black' });
			}

			segments.push({ text: property, color: 'blue' });
			segments.push({ text: ': ', color: 'black' });
			lastIndex = matchIdx + property.length;

			if (matchIndex < valueMatches.length) {
				const valueMatch = valueMatches[matchIndex];
				const valueIdx = valueMatch.index ?? 0;
				const beforeValue = line.substring(lastIndex, valueIdx);

				if (beforeValue.length > 0) {
					segments.push({ text: beforeValue, color: 'black' });
				}

				const value = valueMatch[0].match(/:\s*(.*)/)?.[1] ?? '';

				segments.push({ text: value, color: 'green' });
				lastIndex = valueIdx + valueMatch[0].length;
			}
		});

		const remaining = line.substring(lastIndex);

		if (remaining.length > 0) {
			segments.push({ text: remaining, color: 'black' });
		}

		return segments;
	});

	const parsed: IParsedSegments = { lines, parsedLines };

	if (TEXT_CACHE.size >= TEXT_CACHE_LIMIT) {
		const firstKey = TEXT_CACHE.keys().next().value;

		if (firstKey !== undefined) TEXT_CACHE.delete(firstKey);
	}

	TEXT_CACHE.set(rawValue, parsed);

	return parsed;
}

/**
 * Tracker overlay that draws the barcode's `rawValue` centered on the detected
 * region, with JSON-aware syntax highlighting when the value parses as JSON.
 *
 * Parsed output is cached per `rawValue` (bounded LRU, 32 entries) so each
 * frame only re-runs the JSON parse + regex split when a new value appears.
 */
export function centerText(
	detectedCodes: IDetectedBarcode[],
	ctx: CanvasRenderingContext2D,
) {
	for (const detectedCode of detectedCodes) {
		const { boundingBox, rawValue } = detectedCode;
		const centerX = boundingBox.x + boundingBox.width / 2;
		const centerY = boundingBox.y + boundingBox.height / 2;
		const fontSize = Math.max(12, (50 * boundingBox.width) / ctx.canvas.width);
		const lineHeight = fontSize;

		ctx.font = `${fontSize}px sans-serif`;
		ctx.textAlign = 'left';

		const { lines, parsedLines } = parseRawValue(rawValue);

		const textWidth = Math.max(
			...lines.map((line) => ctx.measureText(line).width),
		);
		const textHeight = lines.length * lineHeight;
		const padding = 10;
		const rectX = centerX - textWidth / 2 - padding;
		const rectY = centerY - textHeight / 2 - padding;
		const rectWidth = textWidth + padding * 2;
		const rectHeight = textHeight + padding;
		const radius = 8;

		ctx.beginPath();
		ctx.moveTo(rectX + radius, rectY);
		ctx.lineTo(rectX + rectWidth - radius, rectY);
		ctx.quadraticCurveTo(
			rectX + rectWidth,
			rectY,
			rectX + rectWidth,
			rectY + radius,
		);
		ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
		ctx.quadraticCurveTo(
			rectX + rectWidth,
			rectY + rectHeight,
			rectX + rectWidth - radius,
			rectY + rectHeight,
		);
		ctx.lineTo(rectX + radius, rectY + rectHeight);
		ctx.quadraticCurveTo(
			rectX,
			rectY + rectHeight,
			rectX,
			rectY + rectHeight - radius,
		);
		ctx.lineTo(rectX, rectY + radius);
		ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
		ctx.closePath();
		ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
		ctx.fill();

		parsedLines.forEach((segments, index) => {
			const y =
				centerY + index * lineHeight - ((lines.length - 1) * lineHeight) / 2;
			let currentX = centerX - textWidth / 2;

			for (const { text, color } of segments) {
				ctx.fillStyle = color;
				ctx.fillText(text, currentX, y);
				currentX += ctx.measureText(text).width;
			}
		});
	}
}
