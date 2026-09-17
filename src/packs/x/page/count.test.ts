import { describe, expect, it } from 'vitest';
import { parseCount } from './count';

describe('parseCount', () => {
	it.each([
		['412', 412],
		['1,234', 1234],
		['1.234', 1234],
		['1.2K', 1200],
		['3,4 mil', 3400],
		['2 M', 2_000_000],
		['412 Replies. Reply', 412],
		['12 Me gusta. Me gusta', 12],
		['Reply', 0],
		['', 0]
	])('%s is %d', (text, n) => expect(parseCount(text)).toBe(n));
});
