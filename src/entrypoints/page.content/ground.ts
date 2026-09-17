/** Whether the page is on a light ground or a dark one. */
export type Ground = 'light' | 'dark';

/** Red, green and blue add up to 765 on white and to 0 on black. */
const HALF_BRIGHT = 382;

export function ground(): Ground {
	const [r = 255, g = 255, b = 255, alpha = 1] = (
		getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) ?? []
	).map(Number);
	// A body with no colour of its own shows the browser's white.
	if (alpha === 0) return 'light';
	return r + g + b > HALF_BRIGHT ? 'light' : 'dark';
}
